<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Bin;
use App\Models\InventoryBalance;
use App\Models\InventoryTransaction;
use App\Models\PickList;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PutawayBatch;
use App\Models\SalesOrder;
use App\Models\Transfer;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $request->validate(['warehouse_id' => 'nullable|integer|exists:warehouses,id']);

        $warehouseIds = self::scopedWarehouseIds($request);

        $balances = InventoryBalance::whereIn('warehouse_id', $warehouseIds);
        $totalOnHand = (float) (clone $balances)->sum('quantity_on_hand');
        $totalReserved = (float) (clone $balances)->sum('quantity_reserved');
        $totalDamaged = (float) (clone $balances)->sum('quantity_damaged');

        $stockValue = (float) InventoryBalance::query()
            ->join('products', 'products.id', '=', 'inventory_balances.product_id')
            ->whereIn('inventory_balances.warehouse_id', $warehouseIds)
            ->sum(DB::raw('inventory_balances.quantity_on_hand * products.cost_price'));

        // Per-product, per-warehouse stock vs reorder level (aggregate across bins)
        $productStock = InventoryBalance::query()
            ->join('products', 'products.id', '=', 'inventory_balances.product_id')
            ->join('warehouses', 'warehouses.id', '=', 'inventory_balances.warehouse_id')
            ->whereIn('inventory_balances.warehouse_id', $warehouseIds)
            ->whereNull('products.deleted_at')
            ->groupBy('products.id', 'products.sku', 'products.name', 'products.reorder_level', 'products.min_stock', 'warehouses.code')
            ->selectRaw('products.id, products.sku, products.name, products.reorder_level, products.min_stock, warehouses.code as warehouse,
                SUM(inventory_balances.quantity_on_hand) as on_hand,
                SUM(inventory_balances.quantity_reserved) as reserved')
            ->get();

        $stocked = $productStock->pluck('id');
        $neverStocked = Product::whereNotIn('id', $stocked)->where('status', 'active')
            ->get(['id', 'sku', 'name', 'reorder_level', 'min_stock'])
            ->map(fn ($p) => (object) array_merge($p->toArray(), ['on_hand' => 0, 'reserved' => 0, 'warehouse' => null]));
        $allStock = $productStock->concat($neverStocked);

        $lowStock = $allStock
            ->filter(fn ($p) => (float) $p->on_hand - (float) $p->reserved <= (float) $p->reorder_level)
            ->sortBy(fn ($p) => (float) $p->on_hand - (float) $p->reserved)
            ->values();
        $outOfStock = $allStock->filter(fn ($p) => (float) $p->on_hand - (float) $p->reserved <= 0)->count();

        $openSalesStatuses = ['pending', 'confirmed', 'picking', 'picked', 'packed'];
        $pendingSalesOrders = SalesOrder::whereIn('warehouse_id', $warehouseIds)->whereIn('status', $openSalesStatuses)->count();
        $pendingPurchaseOrders = PurchaseOrder::whereIn('warehouse_id', $warehouseIds)
            ->whereIn('status', ['draft', 'submitted', 'approved', 'partially_received'])->count();
        $pendingTransfers = Transfer::where(fn ($q) => $q->whereIn('source_warehouse_id', $warehouseIds)
            ->orWhereIn('destination_warehouse_id', $warehouseIds))
            ->whereIn('status', ['draft', 'requested', 'approved', 'picking', 'in_transit', 'partially_received'])->count();

        // Order pipeline (fulfilment funnel)
        $pipeline = SalesOrder::whereIn('warehouse_id', $warehouseIds)
            ->whereIn('status', array_merge($openSalesStatuses, ['shipped']))
            ->selectRaw('status, COUNT(*) as count')->groupBy('status')->pluck('count', 'status');
        $pipeline = collect(['pending', 'confirmed', 'picking', 'picked', 'packed', 'shipped'])
            ->map(fn ($s) => ['status' => $s, 'count' => (int) ($pipeline[$s] ?? 0)]);

        // Inbound vs outbound units – last 14 days
        $from = now()->subDays(13)->startOfDay();
        $movements = InventoryTransaction::whereIn('warehouse_id', $warehouseIds)
            ->where('created_at', '>=', $from)
            ->whereIn('movement_type', ['stock_in', 'transfer_in', 'return', 'stock_out', 'transfer_out'])
            // internal bin-to-bin moves (putaway) are not throughput
            ->where(fn ($q) => $q->whereNull('reference_type')->orWhere('reference_type', '!=', PutawayBatch::class))
            ->selectRaw("DATE(created_at) as day, movement_type, SUM(quantity) as qty")
            ->groupByRaw('DATE(created_at), movement_type')
            ->get();
        $throughput = collect(range(0, 13))->map(function ($i) use ($from, $movements) {
            $day = $from->copy()->addDays($i)->toDateString();
            $rows = $movements->where('day', $day);
            return [
                'date' => $day,
                'inbound' => (float) $rows->whereIn('movement_type', ['stock_in', 'transfer_in', 'return'])->sum('qty'),
                'outbound' => (float) $rows->whereIn('movement_type', ['stock_out', 'transfer_out'])->sum('qty'),
            ];
        });

        // Bin utilisation
        $binsQuery = Bin::whereHas('shelf.rack.aisle.zone', fn ($q) => $q->whereIn('warehouse_id', $warehouseIds));
        $totalBins = (clone $binsQuery)->count();
        $occupiedBins = InventoryBalance::whereIn('warehouse_id', $warehouseIds)
            ->whereNotNull('bin_id')->where('quantity_on_hand', '>', 0)
            ->distinct('bin_id')->count('bin_id');
        $stagingUnits = (float) InventoryBalance::whereIn('warehouse_id', $warehouseIds)->whereNull('bin_id')->sum('quantity_on_hand');

        // Per-warehouse snapshot
        $warehouses = Warehouse::whereIn('id', $warehouseIds)->get(['id', 'code', 'name'])->map(function ($w) {
            $b = InventoryBalance::where('warehouse_id', $w->id);
            return [
                'id' => $w->id,
                'code' => $w->code,
                'name' => $w->name,
                'on_hand' => (float) (clone $b)->sum('quantity_on_hand'),
                'reserved' => (float) (clone $b)->sum('quantity_reserved'),
                'skus' => (clone $b)->where('quantity_on_hand', '>', 0)->distinct('product_id')->count('product_id'),
                'open_orders' => SalesOrder::where('warehouse_id', $w->id)->whereIn('status', ['pending', 'confirmed', 'picking', 'picked', 'packed'])->count(),
            ];
        });

        $recentSalesOrders = SalesOrder::with(['customer:id,name', 'warehouse:id,code,name'])
            ->whereIn('warehouse_id', $warehouseIds)->orderByDesc('created_at')->limit(6)->get();
        $recentPurchaseOrders = PurchaseOrder::with(['supplier:id,name', 'warehouse:id,code,name'])
            ->whereIn('warehouse_id', $warehouseIds)->orderByDesc('created_at')->limit(6)->get();

        $recentMovements = InventoryTransaction::with(['product:id,sku,name', 'warehouse:id,code', 'bin:id,code', 'user:id,name'])
            ->whereIn('warehouse_id', $warehouseIds)
            ->whereNotIn('movement_type', ['reservation', 'reservation_release'])
            // show a putaway once (the leg into the bin), not as out+in
            ->where(fn ($q) => $q->where('movement_type', '!=', 'transfer_out')
                ->orWhereNull('reference_type')->orWhere('reference_type', '!=', PutawayBatch::class))
            ->orderByDesc('created_at')->orderByDesc('id')->limit(8)->get();

        $todayShipped = SalesOrder::whereIn('warehouse_id', $warehouseIds)->where('status', 'shipped')
            ->whereDate('updated_at', now()->toDateString())->count();
        $todayReceived = (float) InventoryTransaction::whereIn('warehouse_id', $warehouseIds)
            ->where('movement_type', 'stock_in')->whereDate('created_at', now()->toDateString())->sum('quantity');

        return $this->success([
            'counts' => [
                'products' => Product::count(),
                'on_hand' => $totalOnHand,
                'reserved' => $totalReserved,
                'available' => max(0, $totalOnHand - $totalReserved),
                'damaged' => $totalDamaged,
                'stock_value' => round($stockValue, 2),
                'pending_sales_orders' => $pendingSalesOrders,
                'pending_purchase_orders' => $pendingPurchaseOrders,
                'pending_transfers' => $pendingTransfers,
                'low_stock_products' => $lowStock->count(),
                'out_of_stock_products' => $outOfStock,
                'open_pick_lists' => PickList::whereIn('warehouse_id', $warehouseIds)->whereIn('status', ['pending', 'in_progress'])->count(),
                'open_putaway' => PutawayBatch::whereIn('warehouse_id', $warehouseIds)->whereIn('status', ['pending', 'in_progress'])->count(),
                'total_bins' => $totalBins,
                'occupied_bins' => $occupiedBins,
                'staging_units' => $stagingUnits,
                'today_shipped' => $todayShipped,
                'today_received' => $todayReceived,
            ],
            'low_stock_items' => $lowStock->take(8)->map(fn ($p) => [
                'id' => $p->id, 'sku' => $p->sku, 'name' => $p->name, 'warehouse' => $p->warehouse,
                'on_hand' => (float) $p->on_hand, 'available' => (float) $p->on_hand - (float) $p->reserved,
                'reorder_level' => (float) $p->reorder_level,
            ])->values(),
            'pipeline' => $pipeline,
            'throughput' => $throughput,
            'warehouses' => $warehouses,
            'recent_sales_orders' => $recentSalesOrders,
            'recent_purchase_orders' => $recentPurchaseOrders,
            'recent_movements' => $recentMovements,
        ]);
    }

    /**
     * Warehouses the user may see. Users without explicit assignments
     * (e.g. administrators) see every warehouse.
     */
    public static function scopedWarehouseIds(Request $request): Collection
    {
        $user = $request->user();
        $assigned = $user->warehouses()->pluck('warehouses.id');
        $all = $assigned->isEmpty() || $user->hasRole('super_admin')
            ? Warehouse::pluck('id')
            : $assigned;

        if ($request->filled('warehouse_id')) {
            $wanted = (int) $request->input('warehouse_id');
            return $all->contains($wanted) ? collect([$wanted]) : collect();
        }

        return $all;
    }
}
