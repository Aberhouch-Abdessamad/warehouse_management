<?php

namespace App\Services;

use App\Models\PickList;
use App\Models\PutawayBatch;
use App\Models\PutawayItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class PutawayService
{
    public function __construct(
        private InventoryService $inventoryService
    ) {}

    public function createBatch(array $data, int $userId): PutawayBatch
    {
        return DB::transaction(function () use ($data, $userId) {
            foreach ($data['items'] as $item) {
                $bin = \App\Models\Bin::with('shelf.rack.aisle.zone')->find($item['destination_bin_id']);
                if (! $bin || (int) $bin->shelf?->rack?->aisle?->zone?->warehouse_id !== (int) $data['warehouse_id']) {
                    throw new InvalidArgumentException('Destination bin does not belong to the selected warehouse.');
                }
            }
            $batch = PutawayBatch::create([
                'number' => 'PUA-' . now()->format('Ymd') . '-' . str_pad((string) (PutawayBatch::max('id') + 1), 5, '0', STR_PAD_LEFT),
                'goods_receipt_id' => $data['goods_receipt_id'] ?? null,
                'warehouse_id' => $data['warehouse_id'],
                'assigned_to' => $data['assigned_to'] ?? $userId,
                'status' => 'pending',
            ]);

            foreach ($data['items'] as $item) {
                (new PutawayItem())->fill([
                    'putaway_batch_id' => $batch->id,
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'source_bin_id' => $item['source_bin_id'] ?? null,
                    'destination_bin_id' => $item['destination_bin_id'],
                    'quantity' => $item['quantity'],
                    'putaway_quantity' => 0,
                    'status' => 'pending',
                ])->save();
            }

            return $batch->fresh();
        });
    }

    public function executePutaway(PutawayBatch $batch, array $items, int $userId): PutawayBatch
    {
        if (! in_array($batch->status, ['pending', 'in_progress'], true)) {
            throw new InvalidArgumentException('Only pending or in-progress batches can be executed.');
        }

        return DB::transaction(function () use ($batch, $items, $userId) {
            $batch->update(['status' => 'in_progress', 'assigned_to' => $userId]);

            foreach ($items as $item) {
                $putawayItem = PutawayItem::findOrFail($item['putaway_item_id']);
                if ($putawayItem->putaway_batch_id !== $batch->id) {
                    throw new InvalidArgumentException('Item does not belong to this batch.');
                }

                $qty = (float) $item['putaway_quantity'];
                if ($qty <= 0) {
                    continue;
                }

                $remaining = (float) $putawayItem->quantity - (float) $putawayItem->putaway_quantity;
                if ($qty > $remaining) {
                    throw new InvalidArgumentException(
                        "Cannot put away more than remaining quantity for item {$putawayItem->id}."
                    );
                }

                $putawayItem->putaway_quantity = (float) $putawayItem->putaway_quantity + $qty;
                $putawayItem->update([
                    'status' => $putawayItem->putaway_quantity >= $putawayItem->quantity ? 'completed' : 'in_progress',
                    'putaway_at' => now(),
                ]);

                // Source bin null = receiving dock / staging area.
                if ((int) $putawayItem->source_bin_id !== (int) $putawayItem->destination_bin_id) {
                    $this->inventoryService->transfer([
                        'product_id' => $putawayItem->product_id,
                        'product_variant_id' => $putawayItem->product_variant_id,
                        'source_warehouse_id' => $batch->warehouse_id,
                        'source_bin_id' => $putawayItem->source_bin_id,
                        'destination_warehouse_id' => $batch->warehouse_id,
                        'destination_bin_id' => $putawayItem->destination_bin_id,
                        'quantity' => $qty,
                        'reference_type' => PutawayBatch::class,
                        'reference_id' => $batch->id,
                        'user_id' => $userId,
                    ]);
                }
            }

            $allDone = $batch->items()->get()->every(fn ($i) => (float) $i->putaway_quantity >= (float) $i->quantity);
            if ($allDone) {
                $batch->update(['status' => 'completed', 'completed_at' => now()]);
            }

            return $batch->fresh();
        });
    }

    public function completeBatch(PutawayBatch $batch, int $userId): void
    {
        if ($batch->status !== 'in_progress' && $batch->status !== 'pending') {
            throw new InvalidArgumentException('Batch must be in progress to complete.');
        }

        $pending = $batch->items()->whereColumn('putaway_quantity', '<', 'quantity')->count();
        if ($pending > 0) {
            throw new InvalidArgumentException('All items must be fully put away before completing the batch.');
        }

        $batch->update(['status' => 'completed', 'completed_at' => now()]);
    }
}