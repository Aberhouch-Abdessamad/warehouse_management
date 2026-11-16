<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Package;
use App\Models\PackageItem;
use App\Models\PickList;
use App\Models\SalesOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PackingController extends Controller
{
    public function index(Request $request)
    {
        $query = Package::with(['salesOrder.customer', 'warehouse', 'items.product', 'packedBy']);

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }
        if ($warehouseId = $request->input('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        return $this->paginated($query->orderByDesc('created_at')->paginate($perPage));
    }

    public function pack(Request $request, SalesOrder $salesOrder)
    {
        $request->validate([
            'weight' => 'nullable|numeric|min:0',
            'width' => 'nullable|numeric|min:0',
            'height' => 'nullable|numeric|min:0',
            'length' => 'nullable|numeric|min:0',
            'items' => 'required|array',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.001',
        ]);

        if (! in_array($salesOrder->status, ['picked', 'packing'])) {
            return $this->error('Sales order must be picked before packing.', 422);
        }

        // Packed quantities must match what was ordered (no product swaps / over-packing).
        $ordered = $salesOrder->items()->get()->groupBy('product_id')->map(fn ($g) => (float) $g->sum('quantity'));
        $packed = collect($request->input('items'))->groupBy('product_id')->map(fn ($g) => (float) $g->sum('quantity'));
        foreach ($packed as $productId => $qty) {
            if (! isset($ordered[$productId])) {
                return $this->error('Package contains a product that is not on this order.', 422);
            }
            if ($qty > $ordered[$productId] + 1e-9) {
                return $this->error('Packed quantity exceeds the ordered quantity.', 422);
            }
        }

        $package = DB::transaction(function () use ($request, $salesOrder) {
            $package = Package::create([
                'number' => 'PKG-' . now()->format('Ymd') . '-' . str_pad((string) (Package::max('id') + 1), 5, '0', STR_PAD_LEFT),
                'sales_order_id' => $salesOrder->id,
                'warehouse_id' => $salesOrder->warehouse_id,
                'status' => 'closed',
                'weight' => $request->input('weight'),
                'width' => $request->input('width'),
                'height' => $request->input('height'),
                'length' => $request->input('length'),
                'packed_by' => $request->user()->id,
            ]);

            foreach ($request->input('items') as $item) {
                PackageItem::create([
                    'package_id' => $package->id,
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'quantity' => (float) $item['quantity'],
                ]);
            }

            $salesOrder->update(['status' => 'packed']);

            return $package;
        });

        return $this->success($package->fresh('items'), 'Package created.', [], 201);
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