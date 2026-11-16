<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Transfer;
use App\Services\TransferService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class TransferController extends Controller
{
    public function __construct(
        private TransferService $transferService
    ) {}

    public function index(Request $request)
    {
        $query = Transfer::with(['sourceWarehouse', 'destinationWarehouse', 'requester', 'items.product']);

        if ($status = $request->input('status')) {
            $query->whereIn('status', explode(',', $status));
        }
        if ($search = $request->input('search')) {
            $query->where('number', 'like', "%{$search}%");
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        return $this->paginated($query->orderByDesc('created_at')->paginate($perPage));
    }

    public function store(Request $request)
    {
        $request->validate([
            'source_warehouse_id' => 'required|exists:warehouses,id',
            'destination_warehouse_id' => 'required|exists:warehouses,id|different:source_warehouse_id',
            'transfer_date' => 'nullable|date',
            'type' => 'nullable|in:warehouse,customer,supplier',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.001',
        ]);

        try {
            $transfer = $this->transferService->create(
                $request->only(['source_warehouse_id', 'destination_warehouse_id', 'transfer_date', 'type', 'notes']),
                $request->input('items'),
                $request->user()->id
            );
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($transfer, 'Transfer created.', [], 201);
    }

    public function show(Transfer $transfer)
    {
        $transfer->load(['sourceWarehouse', 'destinationWarehouse', 'requester', 'approver', 'items.product']);
        return $this->success($transfer);
    }

    public function update(Request $request, Transfer $transfer)
    {
        if ($transfer->status !== 'draft') {
            return $this->error('Only draft transfers can be edited.', 422);
        }

        $request->validate([
            'notes' => 'nullable|string',
            'transfer_date' => 'nullable|date',
        ]);

        $transfer->update($request->only(['notes', 'transfer_date']));
        return $this->success($transfer->fresh(), 'Transfer updated.');
    }

    public function destroy(Transfer $transfer)
    {
        if ($transfer->status !== 'draft') {
            return $this->error('Only draft transfers can be deleted.', 422);
        }

        $transfer->delete();
        return $this->success(null, 'Transfer deleted.');
    }

    public function submit(Request $request, Transfer $transfer)
    {
        try {
            $t = $this->transferService->submit($transfer);
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }
        return $this->success($t, 'Transfer submitted.');
    }

    public function approve(Request $request, Transfer $transfer)
    {
        try {
            $t = $this->transferService->approve($transfer, $request->user()->id);
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }
        return $this->success($t, 'Transfer approved.');
    }

    public function startPicking(Request $request, Transfer $transfer)
    {
        try {
            $t = $this->transferService->startPicking($transfer);
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }
        return $this->success($t, 'Picking started.');
    }

    public function pick(Request $request, Transfer $transfer)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.transfer_item_id' => 'required|exists:transfer_items,id',
            'items.*.quantity' => 'required|numeric|min:0.001',
            'items.*.bin_id' => 'nullable|exists:bins,id',
        ]);

        try {
            $t = $this->transferService->pick($transfer, $request->input('items'), $request->user()->id);
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }
        return $this->success($t, 'Items picked.');
    }

    public function ship(Request $request, Transfer $transfer)
    {
        try {
            $t = $this->transferService->ship($transfer, $request->user()->id);
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }
        return $this->success($t, 'Transfer shipped.');
    }

    public function receive(Request $request, Transfer $transfer)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.transfer_item_id' => 'required|exists:transfer_items,id',
            'items.*.quantity' => 'required|numeric|min:0.001',
            'items.*.bin_id' => 'nullable|exists:bins,id',
        ]);

        try {
            $t = $this->transferService->receive($transfer, $request->input('items'), $request->user()->id);
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }
        return $this->success($t, 'Transfer received.');
    }

    public function cancel(Request $request, Transfer $transfer)
    {
        try {
            $t = $this->transferService->cancel($transfer);
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }
        return $this->success($t, 'Transfer cancelled.');
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