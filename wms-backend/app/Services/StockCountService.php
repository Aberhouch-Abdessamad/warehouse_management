<?php

namespace App\Services;

use App\Models\InventoryBalance;
use App\Models\StockCount;
use App\Models\StockCountItem;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class StockCountService
{
    public function __construct(
        private InventoryService $inventoryService
    ) {}

    public function paginate(int $perPage = 15, array $filters = []): LengthAwarePaginator
    {
        $query = StockCount::with(['warehouse', 'createdBy', 'approvedBy', 'items']);

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['warehouse_id'])) {
            $query->where('warehouse_id', $filters['warehouse_id']);
        }
        if (! empty($filters['number'])) {
            $query->where('number', 'like', '%' . $filters['number'] . '%');
        }

        return $query->orderByDesc('created_at')->paginate($perPage);
    }

    public function find(string $id): StockCount
    {
        $count = StockCount::with(['items.product', 'warehouse', 'createdBy', 'approvedBy'])->find($id);

        if (! $count) {
            throw new InvalidArgumentException('Stock count not found.');
        }

        return $count;
    }

    /**
     * Create a new stock count. System quantities are derived from inventory
     * balances unless an explicit value is supplied.
     */
    public function store(array $data, int $userId): StockCount
    {
        return DB::transaction(function () use ($data, $userId) {
            $count = StockCount::create([
                'number' => $this->generateNumber(),
                'warehouse_id' => $data['warehouse_id'],
                'type' => $data['type'] ?? 'cycle',
                'status' => 'open',
                'created_by' => $userId,
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($data['items'] as $item) {
                $binId = $item['bin_id'] ?? null;
                $system = $item['system_quantity'] ?? $this->systemQuantity(
                    (int) $item['product_id'],
                    $item['product_variant_id'] ?? null,
                    (int) $data['warehouse_id'],
                    $binId
                );

                $count->items()->create([
                    'product_id' => $item['product_id'],
                    'bin_id' => $binId,
                    'system_quantity' => $system,
                    'counted_quantity' => $item['counted_quantity'] ?? null,
                    'variance' => $this->variance($system, $item['counted_quantity'] ?? null),
                    'notes' => $item['notes'] ?? null,
                ]);
            }

            return $count->fresh(['items.product', 'warehouse']);
        });
    }

    /**
     * Record counted quantities for count items. Idempotent: re-recording simply
     * overwrites the previous count. A count must be 'open'.
     */
    public function record(string $id, array $items): StockCount
    {
        $count = $this->find($id);

        if ($count->status !== 'open') {
            throw new InvalidArgumentException('Only open stock counts can be recorded.');
        }

        return DB::transaction(function () use ($count, $items) {
            foreach ($items as $entry) {
                $item = $count->items()->find($entry['stock_count_item_id']);

                if (! $item) {
                    throw new InvalidArgumentException(
                        "Line {$entry['stock_count_item_id']} does not belong to this stock count."
                    );
                }

                $counted = $entry['counted_quantity'] ?? null;

                $item->update([
                    'counted_quantity' => $counted,
                    'variance' => $this->variance($item->system_quantity, $counted),
                    'notes' => $entry['notes'] ?? $item->notes,
                ]);
            }

            $count->update([
                'status' => 'counted',
                'counted_at' => now(),
            ]);

            return $this->find($count->id);
        });
    }

    /**
     * Apply the count results to the ledger using signed adjustments.
     * Idempotent: any count not marked 'open' or 'counted' is rejected.
     */
    public function apply(string $id, int $userId): StockCount
    {
        $count = $this->find($id);

        if (! in_array($count->status, ['open', 'counted'], true)) {
            throw new InvalidArgumentException('Stock count has already been applied.');
        }

        return DB::transaction(function () use ($count, $userId) {
            foreach ($count->items()->get() as $item) {
                $system = (float) $item->system_quantity;
                $counted = $item->counted_quantity !== null
                    ? (float) $item->counted_quantity
                    : $system;
                $variance = $counted - $system;

                if (abs($variance) < 0.0001) {
                    continue;
                }

                $this->inventoryService->move([
                    'product_id' => $item->product_id,
                    'warehouse_id' => $count->warehouse_id,
                    'bin_id' => $item->bin_id,
                    'quantity' => abs($variance),
                    'signed_quantity' => $variance,
                    'movement_type' => 'adjustment',
                    'reference_type' => StockCount::class,
                    'reference_id' => $count->id,
                    'user_id' => $userId,
                    'reason' => "Stock count {$count->number}",
                ]);
            }

            $count->update([
                'status' => 'applied',
                'approved_by' => $userId,
                'counted_at' => $count->counted_at ?? now(),
            ]);

            return $this->find($count->id);
        });
    }

    public function destroy(string $id): void
    {
        $count = $this->find($id);

        if ($count->status !== 'open') {
            throw new InvalidArgumentException('Only open stock counts can be deleted.');
        }

        $count->items()->delete();
        $count->delete();
    }

    private function systemQuantity(int $productId, ?int $variantId, int $warehouseId, ?int $binId): float
    {
        $sum = InventoryBalance::where('product_id', $productId)
            ->where('product_variant_id', $variantId)
            ->where('warehouse_id', $warehouseId)
            ->where('bin_id', $binId)
            ->sum('quantity_on_hand');

        return (float) $sum;
    }

    private function variance($system, $counted): float
    {
        if ($counted === null) {
            return 0.0;
        }

        return round((float) $counted - (float) $system, 3);
    }

    private function generateNumber(): string
    {
        $next = (int) StockCount::max('id') + 1;

        return 'SC-' . now()->format('Ymd') . '-' . str_pad((string) $next, 5, '0', STR_PAD_LEFT);
    }
}