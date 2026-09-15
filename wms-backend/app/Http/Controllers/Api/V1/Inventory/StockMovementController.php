<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\InventoryTransaction;
use Illuminate\Http\Request;

class StockMovementController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'product_id' => 'nullable|integer',
            'warehouse_id' => 'nullable|integer',
            'bin_id' => 'nullable|integer',
            'movement_type' => 'nullable|in:' . implode(',', InventoryTransaction::$movementTypes),
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
            'reference_type' => 'nullable|string',
        ]);

        $query = InventoryTransaction::query()
            ->with(['product:id,sku,name', 'warehouse:id,code,name', 'user:id,name', 'bin:id,code']);

        if ($productId = $request->input('product_id')) {
            $query->where('product_id', $productId);
        }

        if ($warehouseId = $request->input('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }

        if ($binId = $request->input('bin_id')) {
            $query->where('bin_id', $binId);
        }

        if ($movementType = $request->input('movement_type')) {
            $query->where('movement_type', $movementType);
        }

        if ($referenceType = $request->input('reference_type')) {
            $query->where('reference_type', $referenceType);
        }

        if ($fromDate = $request->input('from_date')) {
            $query->whereDate('created_at', '>=', $fromDate);
        }

        if ($toDate = $request->input('to_date')) {
            $query->whereDate('created_at', '<=', $toDate);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $movements = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return $this->paginated($movements);
    }

    public function byProduct($product)
    {
        $movements = InventoryTransaction::with(['warehouse:id,code,name', 'bin:id,code', 'user:id,name'])
            ->where('product_id', $product)
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        return $this->success($movements);
    }
}