<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\InventoryBalance;
use App\Models\InventoryTransaction;
use App\Models\SalesOrder;
use App\Models\PurchaseOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
            'warehouse_id' => 'nullable|integer',
        ]);

        $fromDate = $request->input('from_date', now()->subDays(30)->toDateString());
        $toDate = $request->input('to_date', now()->toDateString());
        $warehouseId = $request->input('warehouse_id');

        $salesOrdersQuery = SalesOrder::query()
            ->whereDate('order_date', '>=', $fromDate)
            ->whereDate('order_date', '<=', $toDate);
        if ($warehouseId) {
            $salesOrdersQuery->where('warehouse_id', $warehouseId);
        }

        $purchaseOrdersQuery = PurchaseOrder::query()
            ->whereDate('order_date', '>=', $fromDate)
            ->whereDate('order_date', '<=', $toDate);
        if ($warehouseId) {
            $purchaseOrdersQuery->where('warehouse_id', $warehouseId);
        }

        $salesByDay = (clone $salesOrdersQuery)
            ->selectRaw('DATE(order_date) as date, COUNT(*) as count, SUM(total) as revenue')
            ->groupByRaw('DATE(order_date)')
            ->orderByRaw('DATE(order_date)')
            ->get();

        $purchaseByDay = (clone $purchaseOrdersQuery)
            ->selectRaw('DATE(order_date) as date, COUNT(*) as count, SUM(total) as spend')
            ->groupByRaw('DATE(order_date)')
            ->orderByRaw('DATE(order_date)')
            ->get();

        $movementsByType = InventoryTransaction::query()
            ->whereDate('created_at', '>=', $fromDate)
            ->whereDate('created_at', '<=', $toDate)
            ->when($warehouseId, fn($q) => $q->where('warehouse_id', $warehouseId))
            ->selectRaw('movement_type, COUNT(*) as count, SUM(quantity) as total_qty')
            ->groupBy('movement_type')
            ->get();

        $topProducts = InventoryBalance::query()
            ->join('products', 'products.id', '=', 'inventory_balances.product_id')
            ->when($warehouseId, fn($q) => $q->where('inventory_balances.warehouse_id', $warehouseId))
            ->selectRaw('products.id, products.sku, products.name, SUM(quantity_on_hand) as total_on_hand')
            ->groupBy('products.id', 'products.sku', 'products.name')
            ->orderByDesc('total_on_hand')
            ->limit(10)
            ->get();

        $salesStatusBreakdown = (clone $salesOrdersQuery)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->get();

        return $this->success([
            'range' => ['from' => $fromDate, 'to' => $toDate],
            'sales_by_day' => $salesByDay,
            'purchase_by_day' => $purchaseByDay,
            'movements_by_type' => $movementsByType,
            'top_products_by_stock' => $topProducts,
            'sales_status_breakdown' => $salesStatusBreakdown,
        ]);
    }
}