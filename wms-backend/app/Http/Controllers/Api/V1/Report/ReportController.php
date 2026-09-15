<?php

namespace App\Http\Controllers\Api\V1\Report;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\InventoryBalance;
use App\Models\InventoryTransaction;
use App\Models\Product;
use App\Models\SalesOrder;
use App\Models\PurchaseOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'type' => 'required|in:stock,stock_movement,sales,purchase,valuation,low_stock',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
            'warehouse_id' => 'nullable|integer',
        ]);

        $type = $request->input('type');
        $fromDate = $request->input('from_date');
        $toDate = $request->input('to_date');
        $warehouseId = $request->input('warehouse_id');

        $data = match ($type) {
            'stock' => $this->stockReport($warehouseId),
            'stock_movement' => $this->stockMovementReport($fromDate, $toDate, $warehouseId),
            'sales' => $this->salesReport($fromDate, $toDate, $warehouseId),
            'purchase' => $this->purchaseReport($fromDate, $toDate, $warehouseId),
            'valuation' => $this->valuationReport($warehouseId),
            'low_stock' => $this->lowStockReport($warehouseId),
        };

        return $this->success($data);
    }

    public function export(Request $request)
    {
        $request->validate([
            'type' => 'required|in:stock,stock_movement,sales,purchase,valuation,low_stock',
            'format' => 'required|in:csv',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
            'warehouse_id' => 'nullable|integer',
        ]);

        $type = $request->input('type');
        $fromDate = $request->input('from_date');
        $toDate = $request->input('to_date');
        $warehouseId = $request->input('warehouse_id');

        $data = match ($type) {
            'stock' => $this->stockReport($warehouseId),
            'stock_movement' => $this->stockMovementReport($fromDate, $toDate, $warehouseId),
            'sales' => $this->salesReport($fromDate, $toDate, $warehouseId),
            'purchase' => $this->purchaseReport($fromDate, $toDate, $warehouseId),
            'valuation' => $this->valuationReport($warehouseId),
            'low_stock' => $this->lowStockReport($warehouseId),
        };

        $rows = collect($data);
        if ($rows->isEmpty()) {
            return response('', 204);
        }

        $headers = array_keys($rows->first());
        $csv = implode(',', $headers) . "\n";
        foreach ($rows as $row) {
            $csv .= implode(',', array_map(fn($v) => '"' . str_replace('"', '""', (string) $v) . '"', array_values($row))) . "\n";
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $type . '_report_' . now()->format('Ymd_His') . '.csv"',
        ]);
    }

    private function stockReport(?int $warehouseId): array
    {
        return InventoryBalance::query()
            ->join('products', 'products.id', '=', 'inventory_balances.product_id')
            ->join('warehouses', 'warehouses.id', '=', 'inventory_balances.warehouse_id')
            ->when($warehouseId, fn($q) => $q->where('inventory_balances.warehouse_id', $warehouseId))
            ->selectRaw('products.sku, products.name, warehouses.code as warehouse, SUM(inventory_balances.quantity_on_hand) as on_hand, SUM(inventory_balances.quantity_reserved) as reserved, SUM(inventory_balances.quantity_damaged) as damaged')
            ->groupBy('products.sku', 'products.name', 'warehouses.code')
            ->get()
            ->toArray();
    }

    private function stockMovementReport($fromDate, $toDate, ?int $warehouseId): array
    {
        return InventoryTransaction::query()
            ->join('products', 'products.id', '=', 'inventory_transactions.product_id')
            ->when($fromDate, fn($q) => $q->whereDate('inventory_transactions.created_at', '>=', $fromDate))
            ->when($toDate, fn($q) => $q->whereDate('inventory_transactions.created_at', '<=', $toDate))
            ->when($warehouseId, fn($q) => $q->where('inventory_transactions.warehouse_id', $warehouseId))
            ->selectRaw('products.sku, products.name, inventory_transactions.movement_type, COUNT(*) as movements, SUM(inventory_transactions.quantity) as total_qty')
            ->groupBy('products.sku', 'products.name', 'inventory_transactions.movement_type')
            ->get()
            ->toArray();
    }

    private function salesReport($fromDate, $toDate, ?int $warehouseId): array
    {
        return SalesOrder::query()
            ->join('customers', 'customers.id', '=', 'sales_orders.customer_id')
            ->when($fromDate, fn($q) => $q->whereDate('order_date', '>=', $fromDate))
            ->when($toDate, fn($q) => $q->whereDate('order_date', '<=', $toDate))
            ->when($warehouseId, fn($q) => $q->where('sales_orders.warehouse_id', $warehouseId))
            ->selectRaw('sales_orders.number, customers.name as customer, sales_orders.order_date, sales_orders.status, sales_orders.subtotal, sales_orders.tax, sales_orders.total')
            ->orderByDesc('sales_orders.order_date')
            ->get()
            ->toArray();
    }

    private function purchaseReport($fromDate, $toDate, ?int $warehouseId): array
    {
        return PurchaseOrder::query()
            ->join('suppliers', 'suppliers.id', '=', 'purchase_orders.supplier_id')
            ->when($fromDate, fn($q) => $q->whereDate('order_date', '>=', $fromDate))
            ->when($toDate, fn($q) => $q->whereDate('order_date', '<=', $toDate))
            ->when($warehouseId, fn($q) => $q->where('purchase_orders.warehouse_id', $warehouseId))
            ->selectRaw('purchase_orders.number, suppliers.name as supplier, purchase_orders.order_date, purchase_orders.status, purchase_orders.subtotal, purchase_orders.tax, purchase_orders.total')
            ->orderByDesc('purchase_orders.order_date')
            ->get()
            ->toArray();
    }

    private function valuationReport(?int $warehouseId): array
    {
        return InventoryBalance::query()
            ->join('products', 'products.id', '=', 'inventory_balances.product_id')
            ->when($warehouseId, fn($q) => $q->where('inventory_balances.warehouse_id', $warehouseId))
            ->selectRaw('products.sku, products.name, products.cost_price, SUM(inventory_balances.quantity_on_hand) as on_hand, SUM(inventory_balances.quantity_on_hand) * products.cost_price as stock_value')
            ->groupBy('products.sku', 'products.name', 'products.cost_price')
            ->get()
            ->toArray();
    }

    private function lowStockReport(?int $warehouseId): array
    {
        return InventoryBalance::query()
            ->join('products', 'products.id', '=', 'inventory_balances.product_id')
            ->join('warehouses', 'warehouses.id', '=', 'inventory_balances.warehouse_id')
            ->when($warehouseId, fn($q) => $q->where('inventory_balances.warehouse_id', $warehouseId))
            ->whereRaw('inventory_balances.quantity_on_hand <= products.reorder_level')
            ->selectRaw('products.sku, products.name, warehouses.code as warehouse, inventory_balances.quantity_on_hand, products.reorder_level, products.min_stock')
            ->get()
            ->toArray();
    }
}