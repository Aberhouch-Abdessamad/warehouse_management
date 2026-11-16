<?php

namespace App\Services;

use App\Models\ReturnOrder;
use App\Models\ReturnItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use InvalidArgumentException;

class ReturnOrderService
{
    public function __construct(
        private InventoryService $inventoryService
    ) {}

    public function paginate(int $perPage = 15, array $filters = []): LengthAwarePaginator
    {
        $query = ReturnOrder::with(['customer', 'warehouse', 'items']);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (!empty($filters['customer_id'])) {
            $query->where('customer_id', $filters['customer_id']);
        }
        if (!empty($filters['warehouse_id'])) {
            $query->where('warehouse_id', $filters['warehouse_id']);
        }
        if (!empty($filters['number'])) {
            $query->where('number', 'like', '%' . $filters['number'] . '%');
        }

        return $query->orderByDesc('created_at')->paginate($perPage);
    }

    public function find(string $id): ReturnOrder
    {
        $order = ReturnOrder::with(['items', 'customer', 'warehouse'])->find($id);

        if (! $order) {
            throw new InvalidArgumentException('Return order not found.');
        }

        return $order;
    }

    /**
     * Create a new return order with items.
     */
    public function store(array $data): ReturnOrder
    {
        return DB::transaction(function () use ($data) {
            $return = ReturnOrder::create([
                'number' => $this->generateNumber(),
                'sales_order_id' => $data['sales_order_id'] ?? null,
                'customer_id' => $data['customer_id'] ?? null,
                'warehouse_id' => $data['warehouse_id'],
                'received_by' => $data['received_by'] ?? null,
                'reason' => $data['reason'] ?? null,
                'status' => 'draft',
            ]);

            foreach ($data['items'] as $item) {
                $return->items()->create([
                    'sales_order_item_id' => $item['sales_order_item_id'] ?? null,
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'quantity' => $item['quantity'],
                    'condition' => $item['condition'] ?? 'resalable',
                    'reason' => $item['reason'] ?? $data['reason'] ?? null,
                ]);
            }

            return $return->fresh(['items.product', 'customer', 'warehouse']);
        });
    }

    /**
     * Apply a return – restock the items and close the order.
     * Idempotent: applying twice throws, since only 'draft' returns can be applied.
     */
    public function apply(string $id, int $userId): ReturnOrder
    {
        $order = $this->find($id);

        if ($order->status !== 'draft') {
            throw new InvalidArgumentException('Only draft return orders can be applied.');
        }

        return DB::transaction(function () use ($order, $userId) {
            foreach ($order->items as $item) {
                $qty = (float) $item->quantity;
                if ($qty <= 0) {
                    continue;
                }

                if ($item->condition === 'damaged') {
                    // Damaged goods go to the damaged bucket
                    $this->inventoryService->move([
                        'product_id' => $item->product_id,
                        'product_variant_id' => $item->product_variant_id,
                        'warehouse_id' => $order->warehouse_id,
                        'bin_id' => null,
                        'quantity' => $qty,
                        'movement_type' => 'return_damaged',
                        'reference_type' => ReturnOrder::class,
                        'reference_id' => $order->id,
                        'user_id' => $userId,
                        'reason' => 'Return received (damaged)',
                    ]);
                } elseif ($item->condition === 'resalable') {
                    $this->inventoryService->move([
                        'product_id' => $item->product_id,
                        'product_variant_id' => $item->product_variant_id,
                        'warehouse_id' => $order->warehouse_id,
                        'bin_id' => null,
                        'quantity' => $qty,
                        'movement_type' => 'return',
                        'reference_type' => ReturnOrder::class,
                        'reference_id' => $order->id,
                        'user_id' => $userId,
                        'reason' => 'Return received (resalable)',
                    ]);
                } else {
                    // 'scrapped' – no stock movement, just record it
                    continue;
                }

                $item->update(['received_quantity' => $qty]);
            }

            $order->update([
                'status' => 'applied',
                'received_at' => now(),
                'received_by' => $userId,
            ]);

            return $order->fresh(['items.product', 'customer', 'warehouse']);
        });
    }

    public function destroy(string $id): void
    {
        $order = $this->find($id);

        if ($order->status !== 'draft') {
            throw new InvalidArgumentException('Only draft return orders can be deleted.');
        }

        $order->items()->delete();
        $order->delete();
    }

    private function generateNumber(): string
    {
        $next = (int) ReturnOrder::max('id') + 1;

        return 'RET-' . now()->format('Ymd') . '-' . str_pad((string) $next, 5, '0', STR_PAD_LEFT);
    }
}