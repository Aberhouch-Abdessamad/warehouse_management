<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\PasswordController;
use App\Http\Controllers\Api\V1\Auth\EmailVerificationController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\AnalyticsController;
use App\Http\Controllers\Api\V1\Product\ProductController;
use App\Http\Controllers\Api\V1\Product\CategoryController;
use App\Http\Controllers\Api\V1\Product\BrandController;
use App\Http\Controllers\Api\V1\Product\UnitController;
use App\Http\Controllers\Api\V1\Product\BarcodeController;
use App\Http\Controllers\Api\V1\Inventory\StockController;
use App\Http\Controllers\Api\V1\Inventory\StockMovementController;
use App\Http\Controllers\Api\V1\Inventory\PutawayController;
use App\Http\Controllers\Api\V1\Inventory\ReturnOrderController;
use App\Http\Controllers\Api\V1\Inventory\StockCount\StockCountController;
use App\Http\Controllers\Api\V1\Inventory\AdjustmentController;
use App\Http\Controllers\Api\V1\Inventory\TransferController;
use App\Http\Controllers\Api\V1\Warehouse\WarehouseController;
use App\Http\Controllers\Api\V1\Warehouse\LocationController;
use App\Http\Controllers\Api\V1\Purchasing\SupplierController;
use App\Http\Controllers\Api\V1\Purchasing\PurchaseOrderController;
use App\Http\Controllers\Api\V1\Purchasing\ReceivingController;
use App\Http\Controllers\Api\V1\Sales\CustomerController;
use App\Http\Controllers\Api\V1\Sales\SalesOrderController;
use App\Http\Controllers\Api\V1\Sales\PickingController;
use App\Http\Controllers\Api\V1\Sales\PackingController;
use App\Http\Controllers\Api\V1\Sales\ShippingController;
use App\Http\Controllers\Api\V1\Report\ReportController;
use App\Http\Controllers\Api\V1\User\UserController;
use App\Http\Controllers\Api\V1\Role\RoleController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\AiAssistantController;

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:auth');
    Route::post('forgot-password', [PasswordController::class, 'forgot'])->middleware('throttle:auth');
    Route::post('reset-password', [PasswordController::class, 'reset'])->middleware('throttle:auth');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
        Route::post('email/verification-notification', [EmailVerificationController::class, 'send'])->middleware('throttle:auth');
        Route::post('verify-email', [EmailVerificationController::class, 'verify']);
        Route::post('change-password', [PasswordController::class, 'change'])->middleware('throttle:auth');
    });
});

Route::middleware('auth:sanctum')->group(function () {
    $p = fn (string ...$perms) => 'permission:' . implode(',', $perms);

    Route::get('/dashboard', [DashboardController::class, 'index'])->middleware($p('dashboard.view'));
    Route::get('/analytics', [AnalyticsController::class, 'index'])->middleware($p('reports.view'));

    // AI assistant
    Route::get('ai/status', [AiAssistantController::class, 'status'])->middleware($p('dashboard.view'));
    Route::post('ai/chat', [AiAssistantController::class, 'chat'])->middleware([$p('dashboard.view'), 'throttle:ai']);
    Route::get('ai/insights', [AiAssistantController::class, 'insights'])->middleware([$p('dashboard.view'), 'throttle:ai']);
    // Saved conversations (server-side chat history)
    Route::get('ai/conversations', [AiAssistantController::class, 'conversations'])->middleware($p('dashboard.view'));
    Route::delete('ai/conversations', [AiAssistantController::class, 'destroyAll'])->middleware($p('dashboard.view'));
    Route::get('ai/conversations/{conversation}', [AiAssistantController::class, 'show'])->middleware($p('dashboard.view'));
    Route::delete('ai/conversations/{conversation}', [AiAssistantController::class, 'destroy'])->middleware($p('dashboard.view'));
    // Outcome of an AI-proposed create action (done/dismissed) so the card is inert after refresh
    Route::post('ai/messages/{aiMessage}/result', [AiAssistantController::class, 'actionResult'])->middleware($p('dashboard.view'));

    // Master data
    Route::get('categories', [CategoryController::class, 'index'])->middleware($p('categories.view', 'products.view'));
    Route::post('categories', [CategoryController::class, 'store'])->middleware($p('categories.create'));
    Route::put('categories/{category}', [CategoryController::class, 'update'])->middleware($p('categories.update'));
    Route::delete('categories/{category}', [CategoryController::class, 'destroy'])->middleware($p('categories.delete'));
    Route::get('brands', [BrandController::class, 'index'])->middleware($p('brands.view', 'products.view'));
    Route::post('brands', [BrandController::class, 'store'])->middleware($p('brands.create'));
    Route::put('brands/{brand}', [BrandController::class, 'update'])->middleware($p('brands.update'));
    Route::delete('brands/{brand}', [BrandController::class, 'destroy'])->middleware($p('brands.delete'));
    Route::get('units', [UnitController::class, 'index'])->middleware($p('units.view', 'products.view'));
    Route::post('units', [UnitController::class, 'store'])->middleware($p('units.create'));
    Route::put('units/{unit}', [UnitController::class, 'update'])->middleware($p('units.update'));
    Route::delete('units/{unit}', [UnitController::class, 'destroy'])->middleware($p('units.delete'));

    Route::get('products/lookup', [ProductController::class, 'lookup'])->middleware($p('products.view'));
    Route::get('products/{product}/barcodes', [BarcodeController::class, 'index'])->middleware($p('products.view'));
    Route::post('products/{product}/barcodes', [BarcodeController::class, 'store'])->middleware($p('products.update'));
    Route::delete('products/{product}/barcodes/{barcode}', [BarcodeController::class, 'destroy'])->middleware($p('products.update'));
    Route::get('products', [ProductController::class, 'index'])->middleware($p('products.view'));
    Route::get('products/{product}', [ProductController::class, 'show'])->middleware($p('products.view'));
    Route::post('products', [ProductController::class, 'store'])->middleware($p('products.create'));
    Route::put('products/{product}', [ProductController::class, 'update'])->middleware($p('products.update'));
    Route::delete('products/{product}', [ProductController::class, 'destroy'])->middleware($p('products.delete'));

    // Warehouses & locations
    Route::get('warehouses/{warehouse}/locations/tree', [LocationController::class, 'tree'])->middleware($p('locations.view'));
    Route::get('locations', [LocationController::class, 'index'])->middleware($p('locations.view', 'putaway.view', 'stock-counts.view', 'picking.view'));
    Route::get('locations/{location}', [LocationController::class, 'show'])->middleware($p('locations.view'));
    Route::post('locations', [LocationController::class, 'store'])->middleware($p('locations.create'));
    Route::put('locations/{location}', [LocationController::class, 'update'])->middleware($p('locations.update'));
    Route::delete('locations/{location}', [LocationController::class, 'destroy'])->middleware($p('locations.delete'));
    Route::get('warehouses', [WarehouseController::class, 'index']); // reference data for every form
    Route::get('warehouses/{warehouse}', [WarehouseController::class, 'show'])->middleware($p('warehouses.view'));
    Route::post('warehouses', [WarehouseController::class, 'store'])->middleware($p('warehouses.create'));
    Route::put('warehouses/{warehouse}', [WarehouseController::class, 'update'])->middleware($p('warehouses.update'));
    Route::delete('warehouses/{warehouse}', [WarehouseController::class, 'destroy'])->middleware($p('warehouses.delete'));

    // Inventory
    Route::get('stock', [StockController::class, 'index'])->middleware($p('stock.view'));
    Route::get('stock/summary', [StockController::class, 'summary'])->middleware($p('stock.view'));
    Route::get('stock/products/{product}', [StockController::class, 'byProduct'])->middleware($p('stock.view'));
    Route::get('stock/{warehouse}/tree', [StockController::class, 'byLocationTree'])->middleware($p('stock.view'));
    Route::get('stock-movements', [StockMovementController::class, 'index'])->middleware($p('stock-movements.view', 'stock.view'));
    Route::get('stock-movements/products/{product}', [StockMovementController::class, 'byProduct'])->middleware($p('stock-movements.view', 'stock.view'));
    Route::post('adjustments', [AdjustmentController::class, 'store'])->middleware($p('adjustments.create', 'stock.adjust'));
    Route::get('adjustments', [AdjustmentController::class, 'index'])->middleware($p('adjustments.view', 'stock.view'));

    Route::get('putaway', [PutawayController::class, 'index'])->middleware($p('putaway.view'));
    Route::post('putaway', [PutawayController::class, 'store'])->middleware($p('putaway.execute'));
    Route::get('putaway/{putawayBatch}', [PutawayController::class, 'show'])->middleware($p('putaway.view'));
    Route::post('putaway/{putawayBatch}/execute', [PutawayController::class, 'execute'])->middleware($p('putaway.execute'));
    Route::post('putaway/{putawayBatch}/complete', [PutawayController::class, 'complete'])->middleware($p('putaway.execute'));

    Route::get('return-orders', [ReturnOrderController::class, 'index'])->middleware($p('returns.view'));
    Route::post('return-orders', [ReturnOrderController::class, 'store'])->middleware($p('returns.create'));
    Route::get('return-orders/{returnOrder}', [ReturnOrderController::class, 'show'])->middleware($p('returns.view'));
    Route::post('return-orders/{returnOrder}/apply', [ReturnOrderController::class, 'apply'])->middleware($p('returns.receive'));
    Route::delete('return-orders/{returnOrder}', [ReturnOrderController::class, 'destroy'])->middleware($p('returns.create'));

    Route::get('stock-counts', [StockCountController::class, 'index'])->middleware($p('stock-counts.view'));
    Route::post('stock-counts', [StockCountController::class, 'store'])->middleware($p('stock-counts.create'));
    Route::get('stock-counts/{stockCount}', [StockCountController::class, 'show'])->middleware($p('stock-counts.view'));
    Route::post('stock-counts/{stockCount}/record', [StockCountController::class, 'record'])->middleware($p('stock-counts.execute'));
    Route::post('stock-counts/{stockCount}/apply', [StockCountController::class, 'apply'])->middleware($p('stock-counts.execute'));
    Route::delete('stock-counts/{stockCount}', [StockCountController::class, 'destroy'])->middleware($p('stock-counts.create'));

    Route::get('transfers', [TransferController::class, 'index'])->middleware($p('transfers.view'));
    Route::post('transfers', [TransferController::class, 'store'])->middleware($p('transfers.create'));
    Route::get('transfers/{transfer}', [TransferController::class, 'show'])->middleware($p('transfers.view'));
    Route::put('transfers/{transfer}', [TransferController::class, 'update'])->middleware($p('transfers.update'));
    Route::delete('transfers/{transfer}', [TransferController::class, 'destroy'])->middleware($p('transfers.delete'));
    Route::post('transfers/{transfer}/submit', [TransferController::class, 'submit'])->middleware($p('transfers.create', 'transfers.update'));
    Route::post('transfers/{transfer}/approve', [TransferController::class, 'approve'])->middleware($p('transfers.approve'));
    Route::post('transfers/{transfer}/start-picking', [TransferController::class, 'startPicking'])->middleware($p('transfers.ship'));
    Route::post('transfers/{transfer}/pick', [TransferController::class, 'pick'])->middleware($p('transfers.ship'));
    Route::post('transfers/{transfer}/ship', [TransferController::class, 'ship'])->middleware($p('transfers.ship'));
    Route::post('transfers/{transfer}/receive', [TransferController::class, 'receive'])->middleware($p('transfers.receive'));
    Route::post('transfers/{transfer}/cancel', [TransferController::class, 'cancel'])->middleware($p('transfers.update', 'transfers.delete'));

    // Purchasing
    Route::get('suppliers', [SupplierController::class, 'index'])->middleware($p('suppliers.view', 'purchase-orders.view'));
    Route::get('suppliers/{supplier}', [SupplierController::class, 'show'])->middleware($p('suppliers.view'));
    Route::post('suppliers', [SupplierController::class, 'store'])->middleware($p('suppliers.create'));
    Route::put('suppliers/{supplier}', [SupplierController::class, 'update'])->middleware($p('suppliers.update'));
    Route::delete('suppliers/{supplier}', [SupplierController::class, 'destroy'])->middleware($p('suppliers.delete'));
    Route::get('purchase-orders', [PurchaseOrderController::class, 'index'])->middleware($p('purchase-orders.view'));
    Route::post('purchase-orders', [PurchaseOrderController::class, 'store'])->middleware($p('purchase-orders.create'));
    Route::get('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show'])->middleware($p('purchase-orders.view'));
    Route::put('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'update'])->middleware($p('purchase-orders.update'));
    Route::delete('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'destroy'])->middleware($p('purchase-orders.delete'));
    Route::post('purchase-orders/{purchaseOrder}/submit', [PurchaseOrderController::class, 'submit'])->middleware($p('purchase-orders.create', 'purchase-orders.update'));
    Route::post('purchase-orders/{purchaseOrder}/approve', [PurchaseOrderController::class, 'approve'])->middleware($p('purchase-orders.approve'));
    Route::post('purchase-orders/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel'])->middleware($p('purchase-orders.update', 'purchase-orders.delete'));
    Route::post('purchase-orders/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive'])->middleware($p('purchase-orders.receive'));
    Route::get('goods-receipts', [ReceivingController::class, 'index'])->middleware($p('purchase-orders.receive', 'purchase-orders.view'));
    Route::get('goods-receipts/{goodsReceipt}', [ReceivingController::class, 'show'])->middleware($p('purchase-orders.receive', 'purchase-orders.view'));

    // Sales & fulfilment
    Route::get('customers', [CustomerController::class, 'index'])->middleware($p('customers.view', 'sales-orders.view', 'returns.view'));
    Route::get('customers/{customer}', [CustomerController::class, 'show'])->middleware($p('customers.view'));
    Route::post('customers', [CustomerController::class, 'store'])->middleware($p('customers.create'));
    Route::put('customers/{customer}', [CustomerController::class, 'update'])->middleware($p('customers.update'));
    Route::delete('customers/{customer}', [CustomerController::class, 'destroy'])->middleware($p('customers.delete'));
    Route::get('sales-orders', [SalesOrderController::class, 'index'])->middleware($p('sales-orders.view', 'picking.view', 'packing.view', 'shipping.view'));
    Route::post('sales-orders', [SalesOrderController::class, 'store'])->middleware($p('sales-orders.create'));
    Route::get('sales-orders/{salesOrder}', [SalesOrderController::class, 'show'])->middleware($p('sales-orders.view', 'picking.view', 'packing.view', 'shipping.view'));
    Route::put('sales-orders/{salesOrder}', [SalesOrderController::class, 'update'])->middleware($p('sales-orders.update'));
    Route::delete('sales-orders/{salesOrder}', [SalesOrderController::class, 'destroy'])->middleware($p('sales-orders.delete'));
    Route::post('sales-orders/{salesOrder}/confirm', [SalesOrderController::class, 'confirm'])->middleware($p('sales-orders.confirm'));
    Route::post('sales-orders/{salesOrder}/cancel', [SalesOrderController::class, 'cancel'])->middleware($p('sales-orders.cancel'));
    Route::post('sales-orders/{salesOrder}/mark-delivered', [SalesOrderController::class, 'markDelivered'])->middleware($p('shipping.execute', 'sales-orders.update'));

    Route::get('picking', [PickingController::class, 'index'])->middleware($p('picking.view'));
    Route::get('picking/{salesOrder}', [PickingController::class, 'show'])->middleware($p('picking.view'));
    Route::post('picking/{salesOrder}/pick', [PickingController::class, 'pick'])->middleware($p('picking.execute'));
    Route::post('picking/{salesOrder}/complete', [PickingController::class, 'complete'])->middleware($p('picking.execute'));

    Route::get('packing', [PackingController::class, 'index'])->middleware($p('packing.view'));
    Route::post('packing/{salesOrder}', [PackingController::class, 'pack'])->middleware($p('packing.execute'));

    Route::get('shipping', [ShippingController::class, 'index'])->middleware($p('shipping.view'));
    Route::post('shipping/{salesOrder}', [ShippingController::class, 'ship'])->middleware($p('shipping.execute'));

    // Reporting
    Route::get('reports', [ReportController::class, 'index'])->middleware($p('reports.view'));
    Route::get('reports/export', [ReportController::class, 'export'])->middleware($p('reports.export', 'reports.view'));

    // Administration
    Route::get('users', [UserController::class, 'index'])->middleware($p('users.view'));
    Route::get('users/{user}', [UserController::class, 'show'])->middleware($p('users.view'));
    Route::post('users', [UserController::class, 'store'])->middleware($p('users.create'));
    Route::put('users/{user}', [UserController::class, 'update'])->middleware($p('users.update'));
    Route::delete('users/{user}', [UserController::class, 'destroy'])->middleware($p('users.delete'));
    Route::post('users/{user}/deactivate', [UserController::class, 'deactivate'])->middleware($p('users.deactivate'));
    Route::post('users/{user}/activate', [UserController::class, 'activate'])->middleware($p('users.activate'));
    Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword'])->middleware($p('users.update'));
    Route::get('roles', [RoleController::class, 'index'])->middleware($p('roles.view', 'users.view'));
    Route::get('roles/{role}', [RoleController::class, 'show'])->middleware($p('roles.view'));
    Route::post('roles', [RoleController::class, 'store'])->middleware($p('roles.create'));
    Route::put('roles/{role}', [RoleController::class, 'update'])->middleware($p('roles.update'));
    Route::delete('roles/{role}', [RoleController::class, 'destroy'])->middleware($p('roles.delete'));
    Route::put('roles/{role}/permissions', [RoleController::class, 'syncPermissions'])->middleware($p('roles.manage'));

    Route::get('audit-logs', [AuditLogController::class, 'index'])->middleware($p('audit-logs.view'));

    // Notifications are personal – every signed-in user can manage their own.
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('notifications/{notification}/read', [NotificationController::class, 'markRead']);

    Route::get('settings', [SettingController::class, 'index'])->middleware($p('settings.view'));
    Route::put('settings', [SettingController::class, 'update'])->middleware($p('settings.update'));
});
