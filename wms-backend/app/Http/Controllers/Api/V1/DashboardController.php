<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\InventoryBalance;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\SalesOrder;
use App\Models\Transfer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $warehouseIds = $user->warehouses()->pluck('warehouses.id');
        if ($warehouseIds->isEmpty()) {
            $warehouseIds = collect([1]);
        }

        $totalProducts = Product::count();
        $totalOnHand = InventoryBalance::whereIn('warehouse_id', $warehouseIds)->sum('quantity_on_hand');
        $totalReserved = InventoryBalance::whereIn('warehouse_id', $warehouseIds)->sum('quantity_reserved');
        $totalDamaged = InventoryBalance::whereIn('warehouse_id', $warehouseIds)->sum('quantity_damaged');

        $pendingSalesOrders = SalesOrder::whereIn('warehouse_id', $warehouseIds)
            ->whereIn('status', ['pending', 'confirmed', 'picking', 'picked', 'packing', 'packed'])
            ->count();

        $pendingPurchaseOrders = PurchaseOrder::whereIn('warehouse_id', $warehouseIds)
            ->whereIn('status', ['draft', 'submitted', 'approved', 'partially_received'])
            ->count();

        $pendingTransfers = Transfer::where(function ($q) use ($warehouseIds) {
                $q->whereIn('source_warehouse_id', $warehouseIds)
                  ->orWhereIn('destination_warehouse_id', $warehouseIds);
            })
            ->whereIn('status', ['draft', 'requested', 'approved', 'picking', 'in_transit'])
            ->count();

        $lowStockProducts = Product::whereHas('inventoryBalances', function ($q) use ($warehouseIds) {
                $q->whereIn('warehouse_id', $warehouseIds)
                  ->whereRaw('quantity_on_hand <= products.reorder_level');
            })
            ->count();

        $recentSalesOrders = SalesOrder::with(['customer:id,name', 'warehouse:id,code,name'])
            ->whereIn('warehouse_id', $warehouseIds)
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        $recentPurchaseOrders = PurchaseOrder::with(['supplier:id,name', 'warehouse:id,code,name'])
            ->whereIn('warehouse_id', $warehouseIds)
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        return $this->success([
            'counts' => [
                'products' => $totalProducts,
                'on_hand' => (float) $totalOnHand,
                'reserved' => (float) $totalReserved,
                'damaged' => (float) $totalDamaged,
                'pending_sales_orders' => $pendingSalesOrders,
                'pending_purchase_orders' => $pendingPurchaseOrders,
                'pending_transfers' => $pendingTransfers,
                'low_stock_products' => $lowStockProducts,
            ],
            'recent_sales_orders' => $recentSalesOrders,
            'recent_purchase_orders' => $recentPurchaseOrders,
        ]);
    }
}