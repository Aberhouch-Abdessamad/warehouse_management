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
    Route::get('/dashboard', [DashboardController::class, 'index'])->middleware('permission:dashboard.view');
    Route::get('/analytics', [AnalyticsController::class, 'index'])->middleware('permission:reports.view');

    Route::apiResource('categories', CategoryController::class)->except(['show']);
    Route::apiResource('brands', BrandController::class)->except(['show']);
    Route::apiResource('units', UnitController::class)->except(['show']);
    Route::get('products/lookup', [ProductController::class, 'lookup'])->middleware('permission:products.view');
    Route::get('products/{product}/barcodes', [BarcodeController::class, 'index']);
    Route::post('products/{product}/barcodes', [BarcodeController::class, 'store']);
    Route::delete('products/{product}/barcodes/{barcode}', [BarcodeController::class, 'destroy']);
    Route::apiResource('products', ProductController::class);

    Route::get('warehouses/{warehouse}/locations/tree', [LocationController::class, 'tree']);
    Route::get('locations', [LocationController::class, 'index']);
    Route::get('locations/{location}', [LocationController::class, 'show']);
    Route::post('locations', [LocationController::class, 'store']);
    Route::put('locations/{location}', [LocationController::class, 'update']);
    Route::delete('locations/{location}', [LocationController::class, 'destroy']);
    Route::apiResource('warehouses', WarehouseController::class);

    Route::get('stock', [StockController::class, 'index']);
    Route::get('stock/summary', [StockController::class, 'summary']);
    Route::get('stock/products/{product}', [StockController::class, 'byProduct']);
    Route::get('stock/{warehouse}/tree', [StockController::class, 'byLocationTree']);
    Route::get('stock-movements', [StockMovementController::class, 'index']);
    Route::get('stock-movements/products/{product}', [StockMovementController::class, 'byProduct']);
    Route::post('adjustments', [AdjustmentController::class, 'store']);
    Route::get('adjustments', [AdjustmentController::class, 'index']);

    Route::get('putaway', [PutawayController::class, 'index']);
    Route::post('putaway', [PutawayController::class, 'store']);
    Route::get('putaway/{putawayBatch}', [PutawayController::class, 'show']);
    Route::post('putaway/{putawayBatch}/execute', [PutawayController::class, 'execute']);
    Route::post('putaway/{putawayBatch}/complete', [PutawayController::class, 'complete']);

    Route::get('return-orders', [ReturnOrderController::class, 'index']);
    Route::post('return-orders', [ReturnOrderController::class, 'store']);
    Route::get('return-orders/{returnOrder}', [ReturnOrderController::class, 'show']);
    Route::post('return-orders/{returnOrder}/apply', [ReturnOrderController::class, 'apply']);
    Route::delete('return-orders/{returnOrder}', [ReturnOrderController::class, 'destroy']);

    Route::get('stock-counts', [StockCountController::class, 'index']);
    Route::post('stock-counts', [StockCountController::class, 'store']);
    Route::get('stock-counts/{stockCount}', [StockCountController::class, 'show']);
    Route::post('stock-counts/{stockCount}/record', [StockCountController::class, 'record']);
    Route::post('stock-counts/{stockCount}/apply', [StockCountController::class, 'apply']);
    Route::delete('stock-counts/{stockCount}', [StockCountController::class, 'destroy']);

    Route::apiResource('transfers', TransferController::class);
    Route::post('transfers/{transfer}/submit', [TransferController::class, 'submit']);
    Route::post('transfers/{transfer}/approve', [TransferController::class, 'approve']);
    Route::post('transfers/{transfer}/start-picking', [TransferController::class, 'startPicking']);
    Route::post('transfers/{transfer}/pick', [TransferController::class, 'pick']);
    Route::post('transfers/{transfer}/ship', [TransferController::class, 'ship']);
    Route::post('transfers/{transfer}/receive', [TransferController::class, 'receive']);
    Route::post('transfers/{transfer}/cancel', [TransferController::class, 'cancel']);

    Route::apiResource('suppliers', SupplierController::class);
    Route::apiResource('purchase-orders', PurchaseOrderController::class);
    Route::post('purchase-orders/{purchaseOrder}/submit', [PurchaseOrderController::class, 'submit']);
    Route::post('purchase-orders/{purchaseOrder}/approve', [PurchaseOrderController::class, 'approve']);
    Route::post('purchase-orders/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive']);
    Route::get('goods-receipts', [ReceivingController::class, 'index']);
    Route::get('goods-receipts/{goodsReceipt}', [ReceivingController::class, 'show']);

    Route::apiResource('customers', CustomerController::class);
    Route::apiResource('sales-orders', SalesOrderController::class);
    Route::post('sales-orders/{salesOrder}/confirm', [SalesOrderController::class, 'confirm']);
    Route::post('sales-orders/{salesOrder}/cancel', [SalesOrderController::class, 'cancel']);
    Route::post('sales-orders/{salesOrder}/mark-delivered', [SalesOrderController::class, 'markDelivered']);

    Route::get('picking', [PickingController::class, 'index']);
    Route::get('picking/{salesOrder}', [PickingController::class, 'show']);
    Route::post('picking/{salesOrder}/pick', [PickingController::class, 'pick']);
    Route::post('picking/{salesOrder}/complete', [PickingController::class, 'complete']);

    Route::get('packing', [PackingController::class, 'index']);
    Route::post('packing/{salesOrder}', [PackingController::class, 'pack']);

    Route::get('shipping', [ShippingController::class, 'index']);
    Route::post('shipping/{salesOrder}', [ShippingController::class, 'ship']);

    Route::get('reports', [ReportController::class, 'index']);
    Route::get('reports/export', [ReportController::class, 'export']);

    Route::apiResource('users', UserController::class);
    Route::post('users/{user}/deactivate', [UserController::class, 'deactivate']);
    Route::post('users/{user}/activate', [UserController::class, 'activate']);
    Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword']);
    Route::apiResource('roles', RoleController::class);
    Route::put('roles/{role}/permissions', [RoleController::class, 'syncPermissions']);

    Route::get('audit-logs', [AuditLogController::class, 'index']);

    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);

    Route::get('settings', [SettingController::class, 'index']);
    Route::put('settings', [SettingController::class, 'update']);
});

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');