<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\InventoryTransaction;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use InvalidArgumentException;

class AdjustmentController extends Controller
{
    public function __construct(
        private InventoryService $inventoryService
    ) {}

    public function index(Request $request)
    {
        $request->validate([
            'warehouse_id' => 'nullable|integer',
            'product_id' => 'nullable|integer',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
        ]);

        $query = InventoryTransaction::query()
            ->with(['product:id,sku,name', 'warehouse:id,code,name', 'user:id,name'])
            ->where('movement_type', 'adjustment');

        if ($warehouseId = $request->input('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }

        if ($productId = $request->input('product_id')) {
            $query->where('product_id', $productId);
        }

        if ($fromDate = $request->input('from_date')) {
            $query->whereDate('created_at', '>=', $fromDate);
        }

        if ($toDate = $request->input('to_date')) {
            $query->whereDate('created_at', '<=', $toDate);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        return $this->paginated($query->orderByDesc('created_at')->paginate($perPage));
    }

    public function store(Request $request)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'product_variant_id' => 'nullable|exists:product_variants,id',
            'warehouse_id' => 'required|exists:warehouses,id',
            'bin_id' => 'nullable|exists:bins,id',
            'signed_quantity' => 'required|numeric|not_in:0',
            'reason' => 'required|string|max:255',
            'meta' => 'nullable|array',
        ]);

        try {
            $transaction = $this->inventoryService->move([
                'product_id' => (int) $request->product_id,
                'product_variant_id' => $request->product_variant_id ? (int) $request->product_variant_id : null,
                'warehouse_id' => (int) $request->warehouse_id,
                'bin_id' => $request->bin_id ? (int) $request->bin_id : null,
                'quantity' => abs((float) $request->signed_quantity),
                'signed_quantity' => (float) $request->signed_quantity,
                'movement_type' => 'adjustment',
                'user_id' => $request->user()->id,
                'reason' => $request->reason,
                'meta' => $request->input('meta'),
            ]);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => (object) [],
                'data' => null,
                'meta' => [],
            ], 422);
        }

        return $this->success($transaction, 'Stock adjusted.', [], 201);
    }
}