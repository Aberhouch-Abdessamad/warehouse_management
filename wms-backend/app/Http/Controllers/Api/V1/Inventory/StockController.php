<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Bin;
use App\Models\InventoryBalance;
use App\Models\Product;
use App\Models\Warehouse;
use App\Models\Zone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockController extends Controller
{
    public function index(Request $request)
    {
        $query = InventoryBalance::query()
            ->join('products', 'products.id', '=', 'inventory_balances.product_id')
            ->join('warehouses', 'warehouses.id', '=', 'inventory_balances.warehouse_id')
            ->leftJoin('bins', 'bins.id', '=', 'inventory_balances.bin_id')
            ->select(
                'inventory_balances.*',
                'products.sku',
                'products.name as product_name',
                'warehouses.code as warehouse_code',
                'warehouses.name as warehouse_name',
                'bins.code as bin_code'
            );

        if ($warehouseId = $request->input('warehouse_id')) {
            $query->where('inventory_balances.warehouse_id', $warehouseId);
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('products.sku', 'like', "%{$search}%")
                  ->orWhere('products.name', 'like', "%{$search}%");
            });
        }

        if ($request->boolean('low_stock')) {
            $query->whereRaw('inventory_balances.quantity_on_hand <= products.reorder_level');
        }

        if (! $request->boolean('include_empty')) {
            $query->where(fn ($q) => $q->where('inventory_balances.quantity_on_hand', '>', 0)
                ->orWhere('inventory_balances.quantity_reserved', '>', 0)
                ->orWhere('inventory_balances.quantity_damaged', '>', 0));
        }

        if ($binId = $request->input('bin_id')) {
            $query->where('inventory_balances.bin_id', $binId);
        }

        $query->addSelect('products.reorder_level', 'products.cost_price');

        $perPage = min((int) $request->input('per_page', 15), 100);
        $balances = $query->orderBy('products.sku')->orderBy('warehouses.code')->orderBy('inventory_balances.bin_id')->paginate($perPage);

        // Human-readable location path (zone / aisle / rack / shelf / bin)
        $bins = Bin::with('shelf.rack.aisle.zone')->whereIn('id', collect($balances->items())->pluck('bin_id')->filter())->get()->keyBy('id');
        foreach ($balances->items() as $row) {
            $row->setAttribute('location', $row->bin_id && isset($bins[$row->bin_id]) ? $bins[$row->bin_id]->full_code : 'STAGING');
        }

        return $this->paginated($balances);
    }

    public function summary(Request $request)
    {
        $warehouseId = $request->input('warehouse_id');

        $query = InventoryBalance::query();
        if ($warehouseId) {
            $query->where('warehouse_id', $warehouseId);
        }

        $total = (clone $query)->selectRaw('SUM(quantity_on_hand) as total_on_hand, SUM(quantity_reserved) as total_reserved, SUM(quantity_damaged) as total_damaged')->first();

        $skuCount = (clone $query)->distinct('product_id')->count('product_id');

        $lowStock = InventoryBalance::query()
            ->join('products', 'products.id', '=', 'inventory_balances.product_id')
            ->when($warehouseId, fn($q) => $q->where('inventory_balances.warehouse_id', $warehouseId))
            ->whereRaw('inventory_balances.quantity_on_hand <= products.reorder_level')
            ->count();

        return $this->success([
            'total_on_hand' => (float) ($total->total_on_hand ?? 0),
            'total_reserved' => (float) ($total->total_reserved ?? 0),
            'total_damaged' => (float) ($total->total_damaged ?? 0),
            'distinct_products' => $skuCount,
            'low_stock_count' => $lowStock,
        ]);
    }

    public function byProduct(Request $request, Product $product)
    {
        $balances = InventoryBalance::with(['warehouse', 'bin'])
            ->where('product_id', $product->id)
            ->get();

        return $this->success($balances);
    }

    public function byLocationTree(Request $request, Warehouse $warehouse)
    {
        $zones = Zone::where('warehouse_id', $warehouse->id)
            ->with(['aisles.racks.shelves.bins.inventoryBalances.product'])
            ->get();

        return $this->success($zones);
    }
}