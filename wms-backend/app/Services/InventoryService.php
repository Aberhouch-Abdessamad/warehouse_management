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

            switch ($movementType) {
                case 'stock_in':
                    $deltaOnHand = $quantity;
                    break;
                case 'stock_out':
                    $this->assertAvailable($balance, $quantity, $allowNegative);
                    $deltaOnHand = -$quantity;
                    break;
                case 'transfer_out':
                    $this->assertAvailable($balance, $quantity, $allowNegative);
                    $deltaOnHand = -$quantity;
                    break;
                case 'transfer_in':
                    $deltaOnHand = $quantity;
                    break;
                case 'adjustment':
                    // Signed quantity: positive increases, negative decreases
                    $signed = $params['signed_quantity'] ?? $quantity;
                    if ($signed < 0) {
                        $this->assertAvailable($balance, abs((float) $signed), $allowNegative);
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
                    $this->assertAvailable($balance, $quantity, $allowNegative);
                    // move from on-hand to damaged
                    $deltaOnHand = -$quantity;
                    $deltaDamaged = $quantity;
                    break;
                case 'reservation':
                    $this->assertAvailable($balance, $quantity, $allowNegative);
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

    private function assertAvailable(InventoryBalance $balance, float $quantity, bool $allowNegative): void
    {
        $available = (float) $balance->quantity_on_hand - (float) $balance->quantity_reserved - (float) $balance->quantity_damaged;

        if (! $allowNegative && ($available - $quantity) < 0) {
            throw new InvalidArgumentException(
                "Insufficient stock. Available: {$available}, requested: {$quantity}."
            );
        }
    }
}