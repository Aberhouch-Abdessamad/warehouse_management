<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\PutawayBatch;
use App\Services\PutawayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PutawayController extends Controller
{
    public function __construct(
        private PutawayService $putawayService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = PutawayBatch::with(['warehouse', 'assignedTo', 'items.product']);

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }
        if ($warehouseId = $request->input('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }
        if ($search = $request->input('search')) {
            $query->where('number', 'like', "%{$search}%");
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        return $this->paginated($query->orderByDesc('created_at')->paginate($perPage));
    }

    public function show(PutawayBatch $putawayBatch): JsonResponse
    {
        return $this->success($putawayBatch->load(['warehouse', 'items.product', 'items.destinationBin', 'assignedTo']));
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'goods_receipt_id' => 'nullable|exists:goods_receipts,id',
            'warehouse_id' => 'required|exists:warehouses,id',
            'assigned_to' => 'nullable|exists:users,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.source_bin_id' => 'nullable|exists:bins,id',
            'items.*.destination_bin_id' => 'required|exists:bins,id',
            'items.*.quantity' => 'required|numeric|min:0.001',
        ]);

        try {
            $batch = $this->putawayService->createBatch($request->all(), $request->user()->id);
            return $this->success($batch->load(['warehouse', 'items.product']), 'Putaway batch created.', [], 201);
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }
    }

    public function execute(Request $request, PutawayBatch $putawayBatch): JsonResponse
    {
        $request->validate([
            'items' => 'required|array',
            'items.*.putaway_item_id' => 'required|exists:putaway_items,id',
            'items.*.putaway_quantity' => 'required|numeric|min:0.001',
        ]);

        try {
            $batch = $this->putawayService->executePutaway($putawayBatch, $request->input('items'), $request->user()->id);
            return $this->success($batch->load(['warehouse', 'items.product', 'items.destinationBin']), 'Items put away.');
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }
    }

    public function complete(Request $request, PutawayBatch $putawayBatch): JsonResponse
    {
        try {
            $this->putawayService->completeBatch($putawayBatch, $request->user()->id);
            return $this->success($putawayBatch->fresh('items'), 'Putaway batch completed.');
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }
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