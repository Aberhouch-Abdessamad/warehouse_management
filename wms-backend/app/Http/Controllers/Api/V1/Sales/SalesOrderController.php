<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\SalesOrder;
use App\Services\SalesOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class SalesOrderController extends Controller
{
    public function __construct(
        private SalesOrderService $salesOrderService
    ) {}

    public function index(Request $request)
    {
        $query = SalesOrder::with(['customer', 'warehouse', 'createdBy', 'items.product']);

        if ($status = $request->input('status')) {
            $query->whereIn('status', explode(',', $status));
        }
        if ($warehouseId = $request->input('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }
        if ($customerId = $request->input('customer_id')) {
            $query->where('customer_id', $customerId);
        }
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        return $this->paginated($query->orderByDesc('order_date')->orderByDesc('id')->paginate($perPage));
    }

    public function store(Request $request)
    {
        $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'warehouse_id' => 'required|exists:warehouses,id',
            'required_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.001',
            'items.*.unit_price' => 'nullable|numeric|min:0',
        ]);

        try {
            $so = $this->salesOrderService->create(
                $request->only(['customer_id', 'warehouse_id', 'required_date', 'currency', 'notes']),
                $request->input('items'),
                $request->user()->id
            );
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($so, 'Sales order created.', [], 201);
    }

    public function show(SalesOrder $salesOrder)
    {
        $salesOrder->load(['customer', 'warehouse', 'createdBy', 'items.product', 'reservations']);
        return $this->success($salesOrder);
    }

    public function update(Request $request, SalesOrder $salesOrder)
    {
        if (! in_array($salesOrder->status, ['pending'])) {
            return $this->error('Only pending sales orders can be edited.', 422);
        }

        $request->validate([
            'required_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        $salesOrder->update($request->only(['required_date', 'notes']));
        return $this->success($salesOrder->fresh(), 'Sales order updated.');
    }

    public function destroy(SalesOrder $salesOrder)
    {
        if ($salesOrder->status !== 'pending') {
            return $this->error('Only pending sales orders can be deleted.', 422);
        }

        $salesOrder->delete();
        return $this->success(null, 'Sales order deleted.');
    }

    public function confirm(Request $request, SalesOrder $salesOrder)
    {
        try {
            $so = $this->salesOrderService->confirm($salesOrder, $request->user()->id);
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($so, 'Sales order confirmed and stock reserved.');
    }

    public function cancel(Request $request, SalesOrder $salesOrder)
    {
        try {
            $so = $this->salesOrderService->cancel($salesOrder, $request->input('reason'));
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($so, 'Sales order cancelled.');
    }

    public function markDelivered(Request $request, SalesOrder $salesOrder)
    {
        try {
            $so = $this->salesOrderService->markDelivered($salesOrder);
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($so, 'Sales order marked as delivered.');
    }

    private function error(string $message, int $status): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => (object) [],
            'data' => null,
            'meta' => [],
        ], $status);
    }
}