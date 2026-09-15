<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\InventoryBalance;
use App\Models\InventoryTransaction;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryService;
use App\Services\PurchaseOrderService;
use App\Services\SalesOrderService;
use App\Services\TransferService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryAndWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected InventoryService $inventory;
    protected SalesOrderService $salesOrderService;
    protected PurchaseOrderService $purchaseOrderService;
    protected TransferService $transferService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);

        // Service-level tests: acting as an authenticated user, no HTTP layer.
        $this->user = User::factory()->create();
        $this->actingAs($this->user, 'sanctum');

        $this->inventory = app(InventoryService::class);
        $this->salesOrderService = app(SalesOrderService::class);
        $this->purchaseOrderService = app(PurchaseOrderService::class);
        $this->transferService = app(TransferService::class);
    }

    protected function seedStock(Product $product, Warehouse $warehouse, float $qty): void
    {
        $this->inventory->move([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => $qty,
            'movement_type' => 'stock_in',
            'user_id' => $this->user->id,
        ]);
    }

    protected function balanceFor(Product $product, Warehouse $warehouse): InventoryBalance
    {
        return InventoryBalance::where('product_id', $product->id)
            ->where('warehouse_id', $warehouse->id)
            ->first();
    }

    // -------------------------------------------------------------------------
    // Inventory service integrity
    // -------------------------------------------------------------------------

    public function test_stock_in_creates_balance_and_ledger_transaction(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();

        $this->seedStock($product, $warehouse, 100);

        $balance = $this->balanceFor($product, $warehouse);

        $this->assertNotNull($balance);
        $this->assertSame(100.0, (float) $balance->quantity_on_hand);
        $this->assertSame(1, InventoryTransaction::where('product_id', $product->id)->count());
        $this->assertSame('stock_in', InventoryTransaction::where('product_id', $product->id)->first()->movement_type);
    }

    public function test_stock_cannot_go_negative(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();

        $this->seedStock($product, $warehouse, 50);

        $this->expectException(\InvalidArgumentException::class);

        $this->inventory->move([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => 51,
            'movement_type' => 'stock_out',
            'user_id' => $this->user->id,
        ]);
    }

    public function test_reserved_stock_is_excluded_from_available(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();

        $this->seedStock($product, $warehouse, 100);
        $this->inventory->move([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => 60,
            'movement_type' => 'reservation',
        ]);

        $balance = $this->balanceFor($product, $warehouse);
        $this->assertSame(100.0, (float) $balance->quantity_on_hand);
        $this->assertSame(60.0, (float) $balance->quantity_reserved);

        // stock_out of 41 must fail: 100 on hand - 60 reserved = 40 available
        $this->expectException(\InvalidArgumentException::class);

        $this->inventory->move([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => 41,
            'movement_type' => 'stock_out',
            'user_id' => $this->user->id,
        ]);
    }

    public function test_damage_moves_stock_from_on_hand_to_damaged_bucket(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();

        $this->seedStock($product, $warehouse, 50);
        $this->inventory->move([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => 10,
            'movement_type' => 'damage',
            'user_id' => $this->user->id,
        ]);

        $balance = $this->balanceFor($product, $warehouse);
        $this->assertSame(40.0, (float) $balance->quantity_on_hand);
        $this->assertSame(10.0, (float) $balance->quantity_damaged);
    }

    public function test_transfer_between_warehouses_preserves_total_stock(): void
    {
        $source = Warehouse::factory()->create();
        $dest = Warehouse::factory()->create();
        $product = Product::factory()->create();

        $this->seedStock($product, $source, 30);

        $this->inventory->transfer([
            'product_id' => $product->id,
            'source_warehouse_id' => $source->id,
            'destination_warehouse_id' => $dest->id,
            'quantity' => 30,
            'user_id' => $this->user->id,
        ]);

        $this->assertSame(0.0, (float) $this->balanceFor($product, $source)->quantity_on_hand);
        $this->assertSame(30.0, (float) $this->balanceFor($product, $dest)->quantity_on_hand);
        // stock_in + transfer_out + transfer_in
        $this->assertSame(3, InventoryTransaction::where('product_id', $product->id)->count());
    }

    // -------------------------------------------------------------------------
    // Sales order lifecycle
    // -------------------------------------------------------------------------

    public function test_sales_order_confirm_reserves_stock_and_cancel_releases_once(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $customer = Customer::factory()->create();

        $this->seedStock($product, $warehouse, 20);

        $so = $this->salesOrderService->create([
            'customer_id' => $customer->id,
            'warehouse_id' => $warehouse->id,
        ], [
            ['product_id' => $product->id, 'quantity' => 10],
        ], $this->user->id);

        $this->assertSame('pending', $so->status);

        $this->salesOrderService->confirm($so, $this->user->id);
        $this->assertSame('confirmed', $so->fresh()->status);
        $this->assertSame(10.0, (float) $this->balanceFor($product, $warehouse)->quantity_reserved);

        // Cancel releases the reservation
        $this->salesOrderService->cancel($so->fresh(), 'test cancel');
        $this->assertSame(0.0, (float) $this->balanceFor($product, $warehouse)->quantity_reserved);
        $this->assertSame('cancelled', $so->fresh()->status);

        // Exactly one reservation_release ledger row for the order
        $releaseRows = InventoryTransaction::where('reference_type', 'sales_order')
            ->where('reference_id', $so->id)
            ->where('movement_type', 'reservation_release')
            ->count();
        $this->assertSame(1, $releaseRows);
    }

    public function test_sales_order_cannot_be_confirmed_twice(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $customer = Customer::factory()->create();

        $this->seedStock($product, $warehouse, 100);

        $so = $this->salesOrderService->create([
            'customer_id' => $customer->id,
            'warehouse_id' => $warehouse->id,
        ], [['product_id' => $product->id, 'quantity' => 5]], $this->user->id);

        $this->salesOrderService->confirm($so, $this->user->id);

        $this->expectException(\InvalidArgumentException::class);
        $this->salesOrderService->confirm($so->fresh(), $this->user->id);
    }

    public function test_sales_order_confirm_fails_when_available_stock_is_insufficient(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $customer = Customer::factory()->create();

        $this->seedStock($product, $warehouse, 5);

        $so = $this->salesOrderService->create([
            'customer_id' => $customer->id,
            'warehouse_id' => $warehouse->id,
        ], [['product_id' => $product->id, 'quantity' => 50]], $this->user->id);

        $this->expectException(\InvalidArgumentException::class);
        $this->salesOrderService->confirm($so, $this->user->id);
    }

    // -------------------------------------------------------------------------
    // Purchase order lifecycle
    // -------------------------------------------------------------------------

    public function test_purchase_order_lifecycle_and_over_receipt_policy(): void
    {
        $warehouse = Warehouse::factory()->create();
        $product = Product::factory()->create();
        $supplier = Supplier::factory()->create();

        $po = $this->purchaseOrderService->create([
            'supplier_id' => $supplier->id,
            'warehouse_id' => $warehouse->id,
        ], [
            ['product_id' => $product->id, 'quantity' => 10],
        ], $this->user->id);

        $this->assertSame('draft', $po->status);

        // Cannot approve a draft directly
        try {
            $this->purchaseOrderService->approve($po, $this->user->id);
            $this->fail('Approving a draft PO should fail.');
        } catch (\InvalidArgumentException $e) {
            $this->assertTrue(true);
        }

        $this->purchaseOrderService->submit($po);
        $this->assertSame('submitted', $po->fresh()->status);

        $this->purchaseOrderService->approve($po->fresh(), $this->user->id);
        $this->assertSame('approved', $po->fresh()->status);

        // Partial receipt
        $poItem = $po->items->first();
        $this->purchaseOrderService->receive($po->fresh(), [
            ['purchase_order_item_id' => $poItem->id, 'quantity' => 4],
        ], $this->user->id);

        $this->assertSame('partially_received', $po->fresh()->status);
        $this->assertSame(4.0, (float) $this->balanceFor($product, $warehouse)->quantity_on_hand);

        // Over-receipt: 4 + 7 > 10 must fail
        $poItem->refresh();
        try {
            $this->purchaseOrderService->receive($po->fresh(), [
                ['purchase_order_item_id' => $poItem->id, 'quantity' => 7],
            ], $this->user->id);
            $this->fail('Over-receipt should fail.');
        } catch (\InvalidArgumentException $e) {
            $this->assertTrue(true);
        }
    }

    public function test_purchase_order_submit_requires_at_least_one_item(): void
    {
        $warehouse = Warehouse::factory()->create();
        $supplier = Supplier::factory()->create();

        $po = $this->purchaseOrderService->create([
            'supplier_id' => $supplier->id,
            'warehouse_id' => $warehouse->id,
        ], [], $this->user->id);

        $this->expectException(\InvalidArgumentException::class);
        $this->purchaseOrderService->submit($po);
    }

    // -------------------------------------------------------------------------
    // Transfer lifecycle
    // -------------------------------------------------------------------------

    protected function makeTransfer(Product $product, Warehouse $source, Warehouse $dest, float $qty)
    {
        return $this->transferService->create([
            'source_warehouse_id' => $source->id,
            'destination_warehouse_id' => $dest->id,
        ], [['product_id' => $product->id, 'quantity' => $qty]], $this->user->id);
    }

    protected function advanceTransferToInTransit($transfer): void
    {
        $item = $transfer->items->first();
        $this->transferService->submit($transfer);
        $this->transferService->approve($transfer->fresh(), $this->user->id);
        $this->transferService->startPicking($transfer->fresh());
        $this->transferService->pick($transfer->fresh(), [
            ['transfer_item_id' => $item->id, 'quantity' => $item->quantity],
        ], $this->user->id);
        $this->transferService->ship($transfer->fresh(), $this->user->id);
    }

    public function test_transfer_full_lifecycle_moves_stock_exactly_once(): void
    {
        $source = Warehouse::factory()->create();
        $dest = Warehouse::factory()->create();
        $product = Product::factory()->create();

        $this->seedStock($product, $source, 25);

        $transfer = $this->makeTransfer($product, $source, $dest, 15);
        $this->assertSame('draft', $transfer->status);

        $item = $transfer->items->first();

        $this->transferService->submit($transfer);
        $this->assertSame('requested', $transfer->fresh()->status);

        $this->transferService->approve($transfer->fresh(), $this->user->id);
        $this->assertSame('approved', $transfer->fresh()->status);

        $this->transferService->startPicking($transfer->fresh());
        $this->assertSame('picking', $transfer->fresh()->status);

        $this->transferService->pick($transfer->fresh(), [
            ['transfer_item_id' => $item->id, 'quantity' => 15],
        ], $this->user->id);

        $this->transferService->ship($transfer->fresh(), $this->user->id);
        $this->assertSame('in_transit', $transfer->fresh()->status);

        $this->transferService->receive($transfer->fresh(), [
            ['transfer_item_id' => $item->id, 'quantity' => 15],
        ], $this->user->id);

        $this->assertSame('completed', $transfer->fresh()->status);
        $this->assertSame(10.0, (float) $this->balanceFor($product, $source)->quantity_on_hand);
        $this->assertSame(15.0, (float) $this->balanceFor($product, $dest)->quantity_on_hand);
        // stock_in + transfer_out + transfer_in
        $this->assertSame(3, InventoryTransaction::where('product_id', $product->id)->count());
    }

    public function test_transfer_cannot_be_received_twice(): void
    {
        $source = Warehouse::factory()->create();
        $dest = Warehouse::factory()->create();
        $product = Product::factory()->create();

        $this->seedStock($product, $source, 25);

        $transfer = $this->makeTransfer($product, $source, $dest, 15);
        $this->advanceTransferToInTransit($transfer);
        $item = $transfer->items->first();

        $this->transferService->receive($transfer->fresh(), [
            ['transfer_item_id' => $item->id, 'quantity' => 15],
        ], $this->user->id);

        $this->assertSame('completed', $transfer->fresh()->status);

        try {
            $this->transferService->receive($transfer->fresh(), [
                ['transfer_item_id' => $item->id, 'quantity' => 15],
            ], $this->user->id);
            $this->fail('Second receive should fail.');
        } catch (\InvalidArgumentException $e) {
            $this->assertTrue(true);
        }

        // Destination stock must not have doubled
        $this->assertSame(15.0, (float) $this->balanceFor($product, $dest)->quantity_on_hand);
    }

    public function test_transfer_cannot_be_cancelled_after_dispatch(): void
    {
        $source = Warehouse::factory()->create();
        $dest = Warehouse::factory()->create();
        $product = Product::factory()->create();

        $this->seedStock($product, $source, 25);

        $transfer = $this->makeTransfer($product, $source, $dest, 15);
        $this->advanceTransferToInTransit($transfer);

        $this->expectException(\InvalidArgumentException::class);
        $this->transferService->cancel($transfer->fresh());
    }

    public function test_transfer_cannot_be_created_between_same_warehouse_when_self_transfer_disabled(): void
    {
        $warehouse = Warehouse::factory()->create(['allow_self_transfer' => false]);
        $product = Product::factory()->create();

        $this->expectException(\InvalidArgumentException::class);
        $this->makeTransfer($product, $warehouse, $warehouse, 5);
    }
}