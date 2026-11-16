<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\InventoryBalance;
use App\Models\PickList;
use App\Models\PickListItem;
use App\Models\SalesOrder;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class PickingController extends Controller
{
    private const PICKABLE_ORDER_STATUSES = ['confirmed', 'picking'];

    public function __construct(
        private InventoryService $inventoryService
    ) {}

    public function index(Request $request)
    {
        $query = PickList::with(['salesOrder.customer', 'warehouse', 'items.product', 'items.bin'])
            ->whereHas('salesOrder');

        if ($status = $request->input('status')) {
            $query->whereIn('status', explode(',', $status));
        }

        if ($warehouseId = $request->input('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);

        return $this->paginated($query->orderByDesc('created_at')->paginate($perPage));
    }

    public function show(SalesOrder $salesOrder)
    {
        $pickList = PickList::where('sales_order_id', $salesOrder->id)->first();

        if (! $pickList) {
            if (! in_array($salesOrder->status, self::PICKABLE_ORDER_STATUSES, true)) {
                return $this->error('Only confirmed sales orders can be picked.', 422);
            }
            $pickList = self::createPickListForOrder($salesOrder);
        }

        return $this->success($this->withBinStock($pickList));
    }

    public function pick(Request $request, SalesOrder $salesOrder)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.pick_list_item_id' => 'required|integer',
            'items.*.picked_quantity' => 'required|numeric|min:0',
            'items.*.bin_id' => 'nullable|exists:bins,id',
        ]);

        $pickList = PickList::where('sales_order_id', $salesOrder->id)->firstOrFail();

        if (! in_array($pickList->status, ['pending', 'in_progress'], true)) {
            return $this->error('Pick list is not in a pickable state.', 422);
        }

        DB::transaction(function () use ($pickList, $request, $salesOrder) {
            if ($pickList->status === 'pending') {
                $pickList->update(['status' => 'in_progress', 'started_at' => now()]);
            }
            if ($salesOrder->status === 'confirmed') {
                $salesOrder->update(['status' => 'picking']);
            }

            foreach ($request->input('items') as $item) {
                $pickItem = PickListItem::where('pick_list_id', $pickList->id)
                    ->whereKey($item['pick_list_item_id'])
                    ->first();

                if (! $pickItem) {
                    throw new InvalidArgumentException("Pick line {$item['pick_list_item_id']} does not belong to this pick list.");
                }

                $pickedQty = (float) $item['picked_quantity'];
                if ($pickedQty <= 0) {
                    continue;
                }

                $remaining = (float) $pickItem->required_quantity - (float) $pickItem->picked_quantity;
                if ($pickedQty > $remaining + 1e-9) {
                    throw new InvalidArgumentException(
                        "Cannot pick more than the remaining {$remaining} units for {$pickItem->product?->sku}."
                    );
                }

                $binId = $item['bin_id'] ?? $pickItem->bin_id;
                if ($binId) {
                    $binStock = (float) InventoryBalance::where('product_id', $pickItem->product_id)
                        ->where('product_variant_id', $pickItem->product_variant_id)
                        ->where('warehouse_id', $pickList->warehouse_id)
                        ->where('bin_id', $binId)
                        ->value('quantity_on_hand');
                    if ($binStock + 1e-9 < $pickedQty) {
                        throw new InvalidArgumentException(
                            "Bin does not hold enough stock for {$pickItem->product?->sku}. On hand in bin: {$binStock}."
                        );
                    }
                }

                $pickItem->picked_quantity = (float) $pickItem->picked_quantity + $pickedQty;
                $pickItem->bin_id = $binId;
                $pickItem->status = (float) $pickItem->picked_quantity + 1e-9 >= (float) $pickItem->required_quantity ? 'picked' : 'in_progress';
                $pickItem->save();
            }

            $allPicked = $pickList->items()->get()->every(fn ($i) => (float) $i->picked_quantity + 1e-9 >= (float) $i->required_quantity);
            if ($allPicked) {
                $pickList->update(['status' => 'completed', 'completed_at' => now(), 'completed_by' => $request->user()->id]);
                $salesOrder->update(['status' => 'picked']);
            }
        });

        return $this->success($this->withBinStock($pickList->fresh()), 'Items picked.');
    }

    public function complete(Request $request, SalesOrder $salesOrder)
    {
        $pickList = PickList::where('sales_order_id', $salesOrder->id)->firstOrFail();

        if ($pickList->status === 'completed') {
            return $this->success($this->withBinStock($pickList), 'Picking already completed.');
        }

        $allPicked = $pickList->items()->get()->every(fn ($i) => (float) $i->picked_quantity + 1e-9 >= (float) $i->required_quantity);
        if (! $allPicked) {
            return $this->error('Not all items have been fully picked.', 422);
        }

        $pickList->update([
            'status' => 'completed',
            'completed_at' => now(),
            'completed_by' => $request->user()->id,
        ]);

        $salesOrder->update(['status' => 'picked']);

        return $this->success($this->withBinStock($pickList->fresh()), 'Picking completed.');
    }

    /**
     * Build a pick list with a suggested bin for every line (largest stock first).
     */
    public static function createPickListForOrder(SalesOrder $salesOrder): PickList
    {
        return DB::transaction(function () use ($salesOrder) {
            $pickList = PickList::create([
                'number' => 'PL-' . now()->format('Ymd') . '-' . str_pad((string) ((int) PickList::max('id') + 1), 5, '0', STR_PAD_LEFT),
                'sales_order_id' => $salesOrder->id,
                'warehouse_id' => $salesOrder->warehouse_id,
                'status' => 'pending',
                'created_by' => $salesOrder->created_by,
            ]);

            $lines = $salesOrder->items()->get()->groupBy(fn ($i) => $i->product_id . ':' . ($i->product_variant_id ?? ''));

            foreach ($lines as $group) {
                $first = $group->first();
                $qty = (float) $group->sum('quantity');

                $suggestedBin = InventoryBalance::where('product_id', $first->product_id)
                    ->where('product_variant_id', $first->product_variant_id)
                    ->where('warehouse_id', $salesOrder->warehouse_id)
                    ->whereNotNull('bin_id')
                    ->where('quantity_on_hand', '>', 0)
                    ->orderByRaw('CASE WHEN quantity_on_hand >= ? THEN 0 ELSE 1 END', [$qty])
                    ->orderByDesc('quantity_on_hand')
                    ->value('bin_id');

                PickListItem::create([
                    'pick_list_id' => $pickList->id,
                    'product_id' => $first->product_id,
                    'product_variant_id' => $first->product_variant_id,
                    'bin_id' => $suggestedBin,
                    'required_quantity' => $qty,
                    'picked_quantity' => 0,
                    'status' => 'pending',
                ]);
            }

            return $pickList->fresh();
        });
    }

    private function withBinStock(PickList $pickList): PickList
    {
        $pickList->load(['items.product', 'items.bin', 'warehouse', 'salesOrder.customer']);
        $pickList->items->each(fn ($i) => $i->bin?->setAttribute('code', $i->bin->loadMissing('shelf.rack.aisle.zone')->full_code));

        foreach ($pickList->items as $item) {
            $item->setAttribute('bin_stock', InventoryBalance::with('bin.shelf.rack.aisle.zone')
                ->where('product_id', $item->product_id)
                ->where('product_variant_id', $item->product_variant_id)
                ->where('warehouse_id', $pickList->warehouse_id)
                ->whereNotNull('bin_id')
                ->where('quantity_on_hand', '>', 0)
                ->orderByDesc('quantity_on_hand')
                ->get(['bin_id', 'quantity_on_hand'])
                ->map(fn ($b) => ['bin_id' => $b->bin_id, 'code' => $b->bin?->full_code, 'on_hand' => (float) $b->quantity_on_hand])
                ->values());
        }

        return $pickList;
    }

    private function error(string $message, int $status): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => (object) [],
            'data' => null,
            'meta' => [],
        ], $status);
    }
}
