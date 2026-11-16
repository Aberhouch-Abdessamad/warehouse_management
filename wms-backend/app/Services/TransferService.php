<?php

namespace App\Services;

use App\Models\Bin;
use App\Models\Product;
use App\Models\Transfer;
use App\Models\TransferItem;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class TransferService
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_REQUESTED = 'requested';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_PICKING = 'picking';
    public const STATUS_PICKED = 'picked';
    public const STATUS_IN_TRANSIT = 'in_transit';
    public const STATUS_RECEIVED = 'received';
    public const STATUS_PARTIALLY_RECEIVED = 'partially_received';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';

    public function __construct(
        private InventoryService $inventoryService
    ) {}

    public function create(array $data, array $items, int $userId): Transfer
    {
        return DB::transaction(function () use ($data, $items, $userId) {
            if (($data['source_warehouse_id'] ?? null) === ($data['destination_warehouse_id'] ?? null)
                && ! \App\Models\Warehouse::find($data['source_warehouse_id'])->allow_self_transfer) {
                throw new InvalidArgumentException('Source and destination warehouses must differ unless self-transfer is allowed.');
            }

            $transfer = Transfer::create([
                'number' => 'TRF-' . now()->format('Ymd') . '-' . str_pad((string) (Transfer::max('id') + 1), 5, '0', STR_PAD_LEFT),
                'source_warehouse_id' => $data['source_warehouse_id'],
                'destination_warehouse_id' => $data['destination_warehouse_id'],
                'requester_id' => $userId,
                'status' => 'draft',
                'type' => $data['type'] ?? 'warehouse',
                'transfer_date' => $data['transfer_date'] ?? now(),
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($items as $item) {
                TransferItem::create([
                    'transfer_id' => $transfer->id,
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'quantity' => (float) $item['quantity'],
                    'status' => 'pending',
                    'picked_quantity' => 0,
                    'received_quantity' => 0,
                ]);
            }

            return $transfer->fresh('items');
        });
    }

    public function submit(Transfer $transfer): Transfer
    {
        if ($transfer->status !== self::STATUS_DRAFT) {
            throw new InvalidArgumentException('Only draft transfers can be submitted.');
        }
        if ($transfer->items->isEmpty()) {
            throw new InvalidArgumentException('Transfer must contain at least one item.');
        }

        $transfer->update(['status' => self::STATUS_REQUESTED]);
        return $transfer->fresh();
    }

    public function approve(Transfer $transfer, int $userId): Transfer
    {
        if ($transfer->status !== self::STATUS_REQUESTED) {
            throw new InvalidArgumentException('Only requested transfers can be approved.');
        }

        $transfer->update(['status' => self::STATUS_APPROVED, 'approver_id' => $userId]);
        return $transfer->fresh();
    }

    public function startPicking(Transfer $transfer): Transfer
    {
        if ($transfer->status !== self::STATUS_APPROVED) {
            throw new InvalidArgumentException('Only approved transfers can start picking.');
        }

        $transfer->update(['status' => self::STATUS_PICKING, 'picking_started_at' => now()]);
        return $transfer->fresh();
    }

    public function pick(Transfer $transfer, array $picks, int $userId): Transfer
    {
        return DB::transaction(function () use ($transfer, $picks, $userId) {
            if ($transfer->status !== self::STATUS_PICKING) {
                throw new InvalidArgumentException('Transfer must be in picking state.');
            }

            foreach ($picks as $pick) {
                $item = TransferItem::findOrFail($pick['transfer_item_id']);
                $qty = (float) $pick['quantity'];

                if ($item->transfer_id !== $transfer->id) {
                    throw new InvalidArgumentException('Transfer item does not belong to this transfer.');
                }

                $remaining = (float) $item->quantity - (float) $item->picked_quantity;
                if ($qty > $remaining) {
                    throw new InvalidArgumentException("Cannot pick more than remaining quantity for item {$item->id}.");
                }

                $this->inventoryService->moveOut([
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'warehouse_id' => $transfer->source_warehouse_id,
                    'bin_id' => $pick['bin_id'] ?? null,
                    'quantity' => $qty,
                    'movement_type' => 'transfer_out',
                    'reference_type' => 'transfer',
                    'reference_id' => $transfer->id,
                    'user_id' => $userId,
                    'reason' => 'Transfer pick for ' . $transfer->number,
                ]);

                $item->increment('picked_quantity', $qty);
                $item->update(['status' => (float) $item->picked_quantity >= (float) $item->quantity ? self::STATUS_PICKED : self::STATUS_PICKING]);
            }

            return $transfer->fresh('items');
        });
    }

    public function ship(Transfer $transfer, int $userId): Transfer
    {
        if ($transfer->status !== self::STATUS_PICKING) {
            throw new InvalidArgumentException('Only transfers in picking can be shipped.');
        }

        $allPicked = $transfer->items()->get()->every(fn($i) => $i->picked_quantity >= $i->quantity);
        if (! $allPicked) {
            throw new InvalidArgumentException('All items must be picked before shipping.');
        }

        $transfer->update(['status' => self::STATUS_IN_TRANSIT, 'shipped_at' => now()]);
        return $transfer->fresh();
    }

    public function receive(Transfer $transfer, array $receipts, int $userId): Transfer
    {
        return DB::transaction(function () use ($transfer, $receipts, $userId) {
            if (! in_array($transfer->status, [self::STATUS_IN_TRANSIT, self::STATUS_PARTIALLY_RECEIVED], true)) {
                throw new InvalidArgumentException('Only in-transit transfers can be received.');
            }

            foreach ($receipts as $receipt) {
                $item = TransferItem::findOrFail($receipt['transfer_item_id']);
                $qty = (float) $receipt['quantity'];

                if ($item->transfer_id !== $transfer->id) {
                    throw new InvalidArgumentException('Transfer item does not belong to this transfer.');
                }

                $remaining = (float) $item->picked_quantity - (float) $item->received_quantity;
                if ($qty > $remaining) {
                    throw new InvalidArgumentException("Cannot receive more than picked quantity for item {$item->id}.");
                }

                $this->inventoryService->move([
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'warehouse_id' => $transfer->destination_warehouse_id,
                    'bin_id' => $receipt['bin_id'] ?? null,
                    'quantity' => $qty,
                    'movement_type' => 'transfer_in',
                    'reference_type' => 'transfer',
                    'reference_id' => $transfer->id,
                    'user_id' => $userId,
                    'reason' => 'Transfer receive for ' . $transfer->number,
                ]);

                $item->increment('received_quantity', $qty);
                $item->update(['status' => self::STATUS_RECEIVED]);
            }

            $allReceived = $transfer->items()->get()->every(fn($i) => $i->received_quantity >= $i->picked_quantity);

            if ($allReceived) {
                $transfer->update([
                    'status' => self::STATUS_COMPLETED,
                    'received_at' => now(),
                    'completed_at' => now(),
                    'received_by_id' => $userId,
                ]);
            } elseif ($transfer->status !== self::STATUS_PARTIALLY_RECEIVED) {
                $transfer->update(['status' => self::STATUS_PARTIALLY_RECEIVED]);
            }

            return $transfer->fresh('items');
        });
    }

    public function cancel(Transfer $transfer): Transfer
    {
        if (! in_array($transfer->status, [self::STATUS_DRAFT, self::STATUS_REQUESTED, self::STATUS_APPROVED])) {
            throw new InvalidArgumentException('Only draft, requested, or approved transfers can be cancelled.');
        }

        $transfer->update(['status' => self::STATUS_CANCELLED]);
        return $transfer->fresh();
    }
}