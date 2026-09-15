<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\ReturnOrder;
use App\Services\ReturnOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReturnOrderController extends Controller
{
    public function __construct(
        private ReturnOrderService $service
    ) {}

    public function index(Request $request): JsonResponse
    {
        $returns = $this->service->paginate(
            perPage: min((int) $request->input('per_page', 15), 100),
            filters: $request->only(['status', 'customer_id', 'warehouse_id', 'number'])
        );

        return $this->paginated($returns);
    }

    public function show(ReturnOrder $returnOrder): JsonResponse
    {
        return $this->success($returnOrder->load(['items.product', 'customer', 'warehouse']));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'warehouse_id' => 'required|exists:warehouses,id',
            'sales_order_id' => 'nullable|exists:sales_orders,id',
            'reason' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.sales_order_item_id' => 'nullable|exists:sales_order_items,id',
            'items.*.product_variant_id' => 'nullable|exists:product_variants,id',
            'items.*.quantity' => 'required|numeric|min:0.001',
            'items.*.condition' => 'nullable|in:resalable,damaged,scrapped',
        ]);

        try {
            $return = $this->service->store(
                $validated + ['received_by' => $request->user()->id]
            );
            return $this->success(
                $return->load('items.product'),
                'Return order created.',
                [],
                201
            );
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage());
        }
    }

    public function apply(Request $request, ReturnOrder $returnOrder): JsonResponse
    {
        try {
            $return = $this->service->apply((string) $returnOrder->id, $request->user()->id);
            return $this->success(
                $return->load('items.product'),
                'Return applied and stock restocked.'
            );
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage());
        }
    }

    public function destroy(ReturnOrder $returnOrder): JsonResponse
    {
        try {
            $this->service->destroy((string) $returnOrder->id);
            return $this->success(null, 'Return order deleted.');
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage());
        }
    }
}