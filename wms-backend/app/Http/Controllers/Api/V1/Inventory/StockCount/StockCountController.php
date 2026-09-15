<?php

namespace App\Http\Controllers\Api\V1\Inventory\StockCount;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\StockCount;
use App\Services\StockCountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockCountController extends Controller
{
    public function __construct(
        private StockCountService $service
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'warehouse_id', 'number']);
        $perPage = min((int) $request->input('per_page', 15), 100);

        return $this->paginated($this->service->paginate($perPage, $filters));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'warehouse_id' => 'required|exists:warehouses,id',
            'type' => 'nullable|in:cycle,physical',
            'notes' => 'nullable|string|max:2000',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.bin_id' => 'nullable|exists:bins,id',
            'items.*.system_quantity' => 'nullable|numeric|min:0',
            'items.*.counted_quantity' => 'nullable|numeric|min:0',
            'items.*.notes' => 'nullable|string|max:1000',
        ]);

        try {
            $count = $this->service->store($validated, $request->user()->id);
            return $this->success($count, 'Stock count created.', [], 201);
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage());
        }
    }

    public function show(StockCount $stockCount): JsonResponse
    {
        return $this->success($this->service->find((string) $stockCount->id));
    }

    public function record(Request $request, StockCount $stockCount): JsonResponse
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.stock_count_item_id' => 'required|exists:stock_count_items,id',
            'items.*.counted_quantity' => 'nullable|numeric|min:0',
            'items.*.notes' => 'nullable|string|max:1000',
        ]);

        try {
            $count = $this->service->record((string) $stockCount->id, $validated['items']);
            return $this->success($count, 'Count quantities recorded.');
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage());
        }
    }

    public function apply(Request $request, StockCount $stockCount): JsonResponse
    {
        try {
            $count = $this->service->apply((string) $stockCount->id, $request->user()->id);
            return $this->success($count, 'Stock count applied to inventory.');
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage());
        }
    }

    public function destroy(StockCount $stockCount): JsonResponse
    {
        try {
            $this->service->destroy((string) $stockCount->id);
            return $this->success(null, 'Stock count deleted.');
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage());
        }
    }
}