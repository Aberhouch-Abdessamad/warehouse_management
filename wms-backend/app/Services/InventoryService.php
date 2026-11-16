<?php

namespace App\Services;

use App\Models\InventoryBalance;
use App\Models\InventoryTransaction;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class InventoryService
{
    /**
     * Apply a stock movement atomically.
     *
     * Creates an immutable inventory transaction and updates the balance row with
     * a pessimistic lock to prevent lost updates under concurrency.
     *
     * $params keys: product_id, product_variant_id (nullable), warehouse_id,
     * bin_id (nullable), quantity (positive decimal as float), movement_type,
     * reference_type (nullable), reference_id (nullable), user_id (nullable),
     * reason (nullable), meta (nullable array), allow_negative (bool, default false)
     */
    public function move(array $params): InventoryTransaction
    {
        return DB::transaction(function () use ($params) {
            $quantity = (float) $params['quantity'];

            if ($quantity <= 0) {
                throw new InvalidArgumentException('Quantity must be greater than zero.');
            }

            $movementType = $params['movement_type'];

            if (! in_array($movementType, InventoryTransaction::$movementTypes, true)) {
                throw new InvalidArgumentException("Invalid movement type: {$movementType}");
            }

            $balance = $this->lockBalance(
                $params['product_id'],
                $params['product_variant_id'] ?? null,
                $params['warehouse_id'],
                $params['bin_id'] ?? null
            );

            $allowNegative = (bool) ($params['allow_negative'] ?? false);

            $deltaOnHand = 0;
            $deltaReserved = 0;
            $deltaDamaged = 0;

            // Outbound movements must respect the warehouse-wide reservation pool,
            // because reservations are held at warehouse level (bin_id = null)
            // while physical stock lives in bins.
            $checkWarehouse = function (float $qty) use ($params, $allowNegative) {
                if ($allowNegative) {
                    return;
                }
                $available = $this->availableInWarehouse(
                    (int) $params['product_id'],
                    $params['product_variant_id'] ?? null,
                    (int) $params['warehouse_id']
                );
                if ($available + 1e-9 < $qty) {
                    throw new InvalidArgumentException(
                        "Insufficient available stock in warehouse. Available: {$available}, requested: {$qty}."
                    );
                }
            };

            switch ($movementType) {
                case 'stock_in':
                    $deltaOnHand = $quantity;
                    break;
                case 'stock_out':
                case 'transfer_out':
                    $this->assertOnHand($balance, $quantity, $allowNegative);
                    $checkWarehouse($quantity);
                    $deltaOnHand = -$quantity;
                    break;
                case 'transfer_in':
                    $deltaOnHand = $quantity;
                    break;
                case 'adjustment':
                    // Signed quantity: positive increases, negative decreases
                    $signed = $params['signed_quantity'] ?? $quantity;
                    if ($signed < 0) {
                        $this->assertOnHand($balance, abs((float) $signed), $allowNegative);
                        $checkWarehouse(abs((float) $signed));
                    }
                    $deltaOnHand = $signed;
                    $quantity = abs((float) $signed);
                    break;
                case 'return':
                    $deltaOnHand = $quantity;
                    break;
                case 'return_damaged':
                    $deltaDamaged = $quantity;
                    break;
                case 'damage':
                    $this->assertOnHand($balance, $quantity, $allowNegative);
                    $checkWarehouse($quantity);
                    // move from on-hand to damaged
                    $deltaOnHand = -$quantity;
                    $deltaDamaged = $quantity;
                    break;
                case 'reservation':
                    $checkWarehouse($quantity);
                    $deltaReserved = $quantity;
                    break;
                case 'reservation_release':
                    $deltaReserved = -$quantity;
                    break;
            }

            $balance->quantity_on_hand = max(0, (float) $balance->quantity_on_hand + $deltaOnHand);
            $balance->quantity_reserved = max(0, (float) $balance->quantity_reserved + $deltaReserved);
            $balance->quantity_damaged = max(0, (float) $balance->quantity_damaged + $deltaDamaged);

            $balance->save();

            return InventoryTransaction::create([
                'product_id' => $params['product_id'],
                'product_variant_id' => $params['product_variant_id'] ?? null,
                'warehouse_id' => $params['warehouse_id'],
                'bin_id' => $params['bin_id'] ?? null,
                'movement_type' => $movementType,
                'quantity' => $quantity,
                'reference_type' => $params['reference_type'] ?? null,
                'reference_id' => $params['reference_id'] ?? null,
                'user_id' => $params['user_id'] ?? null,
                'reason' => $params['reason'] ?? null,
                'meta' => $params['meta'] ?? null,
                'created_at' => now(),
            ]);
        });
    }

    /**
     * Transfer stock between bins within the same warehouse or across warehouses.
     * Creates matching transfer_out and transfer_in transactions.
     */
    public function transfer(array $params): array
    {
        return DB::transaction(function () use ($params) {
            $out = $this->move([
                'product_id' => $params['product_id'],
                'product_variant_id' => $params['product_variant_id'] ?? null,
                'warehouse_id' => $params['source_warehouse_id'],
                'bin_id' => $params['source_bin_id'] ?? null,
                'quantity' => $params['quantity'],
                'movement_type' => 'transfer_out',
                'reference_type' => $params['reference_type'] ?? null,
                'reference_id' => $params['reference_id'] ?? null,
                'user_id' => $params['user_id'] ?? null,
                'reason' => 'Transfer out',
            ]);

            $in = $this->move([
                'product_id' => $params['product_id'],
                'product_variant_id' => $params['product_variant_id'] ?? null,
                'warehouse_id' => $params['destination_warehouse_id'],
                'bin_id' => $params['destination_bin_id'] ?? null,
                'quantity' => $params['quantity'],
                'movement_type' => 'transfer_in',
                'reference_type' => $params['reference_type'] ?? null,
                'reference_id' => $params['reference_id'] ?? null,
                'user_id' => $params['user_id'] ?? null,
                'reason' => 'Transfer in',
            ]);

            return [$out, $in];
        });
    }

    private function lockBalance(int $productId, ?int $variantId, int $warehouseId, ?int $binId): InventoryBalance
    {
        $query = InventoryBalance::where('product_id', $productId)
            ->where('warehouse_id', $warehouseId)
            ->where('product_variant_id', $variantId)
            ->where('bin_id', $binId);

        $balance = $query->lockForUpdate()->first();

        if (! $balance) {
            $balance = InventoryBalance::create([
                'product_id' => $productId,
                'product_variant_id' => $variantId,
                'warehouse_id' => $warehouseId,
                'bin_id' => $binId,
                'quantity_on_hand' => 0,
                'quantity_reserved' => 0,
                'quantity_damaged' => 0,
                'quantity_incoming' => 0,
            ]);
        }

        return $balance;
    }

    /**
     * Physical check: the specific balance row (bin) must hold enough units.
     */
    private function assertOnHand(InventoryBalance $balance, float $quantity, bool $allowNegative): void
    {
        $onHand = (float) $balance->quantity_on_hand;

        if (! $allowNegative && ($onHand - $quantity) < -1e-9) {
            $where = $balance->bin_id ? "bin #{$balance->bin_id}" : 'unassigned/staging location';
            throw new InvalidArgumentException(
                "Insufficient stock in {$where}. On hand: {$onHand}, requested: {$quantity}."
            );
        }
    }

    /**
     * Sellable quantity across the whole warehouse: on hand minus reserved.
     * (Damaged units live in their own bucket and are never part of on hand.)
     */
    public function availableInWarehouse(int $productId, ?int $variantId, int $warehouseId): float
    {
        $row = InventoryBalance::where('product_id', $productId)
            ->where('warehouse_id', $warehouseId)
            ->where('product_variant_id', $variantId)
            ->selectRaw('COALESCE(SUM(quantity_on_hand),0) as on_hand, COALESCE(SUM(quantity_reserved),0) as reserved')
            ->first();

        return round((float) $row->on_hand - (float) $row->reserved, 3);
    }

    /**
     * Suggest bins to take $quantity from (largest stock first, staging last).
     * Returns a list of [bin_id|null, qty]. Throws when the warehouse can't cover it.
     */
    public function allocate(int $productId, ?int $variantId, int $warehouseId, float $quantity, ?int $preferredBinId = null): array
    {
        $rows = InventoryBalance::where('product_id', $productId)
            ->where('warehouse_id', $warehouseId)
            ->where('product_variant_id', $variantId)
            ->where('quantity_on_hand', '>', 0)
            ->get()
            ->sortBy(fn ($b) => [
                $b->bin_id === $preferredBinId && $preferredBinId !== null ? 0 : 1,
                $b->bin_id === null ? 1 : 0,
                -(float) $b->quantity_on_hand,
            ])
            ->values();

        $plan = [];
        $left = $quantity;
        foreach ($rows as $row) {
            if ($left <= 1e-9) {
                break;
            }
            $take = min($left, (float) $row->quantity_on_hand);
            $plan[] = [$row->bin_id, $take];
            $left -= $take;
        }

        if ($left > 1e-9) {
            $have = $quantity - $left;
            throw new InvalidArgumentException("Insufficient stock to allocate. Found {$have}, requested {$quantity}.");
        }

        return $plan;
    }

    /**
     * Outbound move that spreads the quantity across bins when no bin is given.
     * Returns the created transactions.
     */
    public function moveOut(array $params): array
    {
        return DB::transaction(function () use ($params) {
            if (! empty($params['bin_id'])) {
                return [$this->move($params)];
            }

            $plan = $this->allocate(
                (int) $params['product_id'],
                $params['product_variant_id'] ?? null,
                (int) $params['warehouse_id'],
                (float) $params['quantity'],
                $params['preferred_bin_id'] ?? null
            );

            $txs = [];
            foreach ($plan as [$binId, $qty]) {
                $txs[] = $this->move(array_merge($params, ['bin_id' => $binId, 'quantity' => $qty]));
            }

            return $txs;
        });
    }
}