<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Product;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class SalesOrderService
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_CONFIRMED = 'confirmed';
    public const STATUS_ALLOCATED = 'allocated';
    public const STATUS_PICKING = 'picking';
    public const STATUS_PICKED = 'picked';
    public const STATUS_PACKED = 'packed';
    public const STATUS_SHIPPED = 'shipped';
    public const STATUS_DELIVERED = 'delivered';
    public const STATUS_CANCELLED = 'cancelled';

    public function __construct(
        private InventoryService $inventoryService,
        private ReservationService $reservationService
    ) {}

    public function create(array $data, array $items, int $userId): SalesOrder
    {
        return DB::transaction(function () use ($data, $items, $userId) {
            $so = SalesOrder::create([
                'number' => 'SO-' . now()->format('Ymd') . '-' . str_pad((string) (SalesOrder::max('id') + 1), 5, '0', STR_PAD_LEFT),
                'customer_id' => $data['customer_id'],
                'warehouse_id' => $data['warehouse_id'],
                'created_by' => $userId,
                'order_date' => $data['order_date'] ?? now(),
                'required_date' => $data['required_date'] ?? null,
                'currency' => $data['currency'] ?? 'USD',
                'subtotal' => 0,
                'tax' => 0,
                'total' => 0,
                'status' => 'pending',
                'notes' => $data['notes'] ?? null,
            ]);

            $subtotal = 0;
            $taxTotal = 0;

            foreach ($items as $item) {
                $product = Product::findOrFail($item['product_id']);
                $unitPrice = $item['unit_price'] ?? $product->selling_price;
                $taxRate = $item['tax_rate'] ?? $product->tax_rate;
                $qty = (float) $item['quantity'];
                $lineSubtotal = $qty * $unitPrice;
                $lineTax = $lineSubtotal * ($taxRate / 100);

                SalesOrderItem::create([
                    'sales_order_id' => $so->id,
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'tax_rate' => $taxRate,
                    'line_total' => $lineSubtotal + $lineTax,
                ]);

                $subtotal += $lineSubtotal;
                $taxTotal += $lineTax;
            }

            $so->update([
                'subtotal' => $subtotal,
                'tax' => $taxTotal,
                'total' => $subtotal + $taxTotal,
            ]);

            return $so->fresh('items');
        });
    }

    public function confirm(SalesOrder $so, int $userId): SalesOrder
    {
        if ($so->status !== self::STATUS_PENDING) {
            throw new InvalidArgumentException('Only pending sales orders can be confirmed.');
        }

        return DB::transaction(function () use ($so, $userId) {
            $so->update([
                'status' => self::STATUS_CONFIRMED,
                'approved_by' => $userId,
                'confirmed_at' => now(),
            ]);

            $this->reservationService->reserveForOrder($so);

            return $so->fresh();
        });
    }

    public function cancel(SalesOrder $so, ?string $reason = null): SalesOrder
    {
        if (! in_array($so->status, [self::STATUS_PENDING, self::STATUS_CONFIRMED, self::STATUS_PICKING])) {
            throw new InvalidArgumentException('Only pending, confirmed, or picking orders can be cancelled.');
        }

        return DB::transaction(function () use ($so, $reason) {
            if (in_array($so->status, [self::STATUS_CONFIRMED, self::STATUS_PICKING])) {
                $this->reservationService->releaseForOrder($so);
            }

            $so->update(['status' => self::STATUS_CANCELLED, 'notes' => $reason ?? $so->notes]);

            return $so->fresh();
        });
    }

    public function markDelivered(SalesOrder $so): SalesOrder
    {
        if ($so->status !== self::STATUS_SHIPPED) {
            throw new InvalidArgumentException('Only shipped orders can be marked delivered.');
        }

        $so->update(['status' => self::STATUS_DELIVERED]);
        return $so->fresh();
    }
}