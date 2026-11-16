<?php

namespace App\Http\Controllers\Api\V1\Purchasing;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\PurchaseOrder;
use App\Services\PurchaseOrderService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use InvalidArgumentException;

class PurchaseOrderController extends Controller
{
    public function __construct(
        private PurchaseOrderService $purchaseOrderService
    ) {}

    public function index(Request $request)
    {
        $query = PurchaseOrder::with(['supplier', 'warehouse', 'createdBy', 'items.product']);

        if ($status = $request->input('status')) {
            $query->whereIn('status', explode(',', $status));
        }
        if ($warehouseId = $request->input('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }
        if ($supplierId = $request->input('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                  ->orWhereHas('supplier', fn ($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        return $this->paginated($query->orderByDesc('order_date')->orderByDesc('id')->paginate($perPage));
    }

    public function store(Request $request)
    {
        $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'warehouse_id' => 'required|exists:warehouses,id',
            'expected_delivery' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.001',
            'items.*.unit_cost' => 'nullable|numeric|min:0',
        ]);

        try {
            $po = $this->purchaseOrderService->create(
                $request->only(['supplier_id', 'warehouse_id', 'expected_delivery', 'currency', 'notes']),
                $request->input('items'),
                $request->user()->id
            );
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($po, 'Purchase order created.', [], 201);
    }

    public function show(PurchaseOrder $purchaseOrder)
    {
        $purchaseOrder->load(['supplier', 'warehouse', 'createdBy', 'approvedBy', 'items.product', 'goodsReceipts.items']);
        return $this->success($purchaseOrder);
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder)
    {
        if (! in_array($purchaseOrder->status, ['draft'])) {
            return $this->error('Only draft purchase orders can be edited.', 422);
        }

        $request->validate([
            'expected_delivery' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        $purchaseOrder->update($request->only(['expected_delivery', 'notes']));
        return $this->success($purchaseOrder->fresh(), 'Purchase order updated.');
    }

    public function destroy(PurchaseOrder $purchaseOrder)
    {
        if ($purchaseOrder->status !== 'draft') {
            return $this->error('Only draft purchase orders can be deleted.', 422);
        }

        $purchaseOrder->delete();
        return $this->success(null, 'Purchase order deleted.');
    }

    public function submit(Request $request, PurchaseOrder $purchaseOrder)
    {
        try {
            $po = $this->purchaseOrderService->submit($purchaseOrder);
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($po, 'Purchase order submitted for approval.');
    }

    public function approve(Request $request, PurchaseOrder $purchaseOrder)
    {
        try {
            $po = $this->purchaseOrderService->approve($purchaseOrder, $request->user()->id);
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($po, 'Purchase order approved.');
    }

    public function cancel(Request $request, PurchaseOrder $purchaseOrder)
    {
        try {
            $po = $this->purchaseOrderService->cancel($purchaseOrder);
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($po, 'Purchase order cancelled.');
    }

    public function receive(Request $request, PurchaseOrder $purchaseOrder)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.purchase_order_item_id' => 'required|exists:purchase_order_items,id',
            'items.*.quantity' => 'required|numeric|min:0.001',
            'bin_id' => 'nullable|exists:bins,id',
        ]);

        try {
            $gr = $this->purchaseOrderService->receive(
                $purchaseOrder,
                $request->input('items'),
                $request->user()->id,
                $request->input('bin_id')
            );
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($gr, 'Goods received.');
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