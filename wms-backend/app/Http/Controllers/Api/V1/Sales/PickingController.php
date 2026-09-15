<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\PickList;
use App\Models\PickListItem;
use App\Models\SalesOrder;
use App\Services\InventoryService;
use App\Services\ReservationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class PickingController extends Controller
{
    public function __construct(
        private InventoryService $inventoryService,
        private ReservationService $reservationService
    ) {}

    public function index(Request $request)
    {
        $query = PickList::with(['salesOrder.customer', 'warehouse', 'items.product'])
            ->whereHas('salesOrder');

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }
        if ($warehouseId = $request->input('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        return $this->paginated($query->orderByDesc('created_at')->paginate($perPage));
    }

    public function show(SalesOrder $salesOrder)
    {
        $pickList = PickList::with(['items.product', 'items.bin', 'warehouse'])
            ->where('sales_order_id', $salesOrder->id)
            ->first();

        if (! $pickList) {
            $pickList = $this->createPickListForOrder($salesOrder);
        }

        return $this->success($pickList);
    }

    public function pick(Request $request, SalesOrder $salesOrder)
    {
        $request->validate([
            'items' => 'required|array',
            'items.*.pick_list_item_id' => 'required|exists:pick_list_items,id',
            'items.*.picked_quantity' => 'required|numeric|min:0',
            'items.*.bin_id' => 'nullable|exists:bins,id',
        ]);

        $pickList = PickList::where('sales_order_id', $salesOrder->id)->firstOrFail();

        if ($pickList->status !== 'pending' && $pickList->status !== 'in_progress') {
            return $this->error('Pick list is not in a pickable state.', 422);
        }

        DB::transaction(function () use ($pickList, $request, $salesOrder) {
            if ($pickList->status === 'pending') {
                $pickList->update(['status' => 'in_progress', 'started_at' => now()]);
            }

            foreach ($request->input('items') as $item) {
                $pickItem = PickListItem::findOrFail($item['pick_list_item_id']);
                $pickedQty = (float) $item['picked_quantity'];

                if ($pickedQty <= 0) {
                    continue;
                }

                $remaining = (float) $pickItem->required_quantity - (float) $pickItem->picked_quantity;
                if ($pickedQty > $remaining) {
                    throw new InvalidArgumentException(
                        "Cannot pick more than remaining quantity for item {$pickItem->id}."
                    );
                }

                $pickItem->increment('picked_quantity', $pickedQty);
                $pickItem->update(['bin_id' => $item['bin_id'] ?? $pickItem->bin_id]);

                if ($pickItem->picked_quantity >= $pickItem->required_quantity) {
                    $pickItem->update(['status' => 'picked']);
                }
            }

$allPicked = $pickList->items()->get()->every(fn($i) => $i->picked_quantity >= $i->required_quantity);
            if ($allPicked) {
                $pickList->update(['status' => 'completed', 'completed_at' => now(), 'completed_by' => $request->user()->id]);
                $salesOrder->update(['status' => 'picked']);
            }
        });

        return $this->success($pickList->fresh('items'), 'Items picked.');
    }

    public function complete(Request $request, SalesOrder $salesOrder)
    {
        $pickList = PickList::where('sales_order_id', $salesOrder->id)->firstOrFail();

        if ($pickList->status !== 'in_progress') {
            return $this->error('Pick list must be in progress to complete.', 422);
        }

        $allPicked = $pickList->items()->get()->every(fn($i) => $i->picked_quantity >= $i->required_quantity);
        if (! $allPicked) {
            return $this->error('Not all items have been fully picked.', 422);
        }

        $pickList->update([
            'status' => 'completed',
            'completed_at' => now(),
            'completed_by' => $request->user()->id,
        ]);

        $salesOrder->update(['status' => 'picked']);

        return $this->success($pickList->fresh('items'), 'Picking completed.');
    }

    private function createPickListForOrder(SalesOrder $salesOrder): PickList
    {
        return DB::transaction(function () use ($salesOrder) {
            $pickList = PickList::create([
                'number' => 'PL-' . now()->format('Ymd') . '-' . str_pad((string) (PickList::max('id') + 1), 5, '0', STR_PAD_LEFT),
                'sales_order_id' => $salesOrder->id,
                'warehouse_id' => $salesOrder->warehouse_id,
                'status' => 'pending',
                'created_by' => $salesOrder->created_by,
            ]);

            foreach ($salesOrder->items as $item) {
                PickListItem::create([
                    'pick_list_id' => $pickList->id,
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'required_quantity' => (float) $item->quantity,
                    'picked_quantity' => 0,
                    'status' => 'pending',
                ]);
            }

            return $pickList->fresh('items');
        });
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