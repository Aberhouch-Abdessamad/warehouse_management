<?php

namespace App\Services;

use App\Models\PickListItem;
use App\Models\Reservation;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ReservationService
{
    public function __construct(
        private InventoryService $inventoryService
    ) {}

    public function reserveForOrder(SalesOrder $order): void
    {
        DB::transaction(function () use ($order) {
            $order->load('items');

            foreach ($order->items as $item) {
                $this->reserve(
                    productId: $item->product_id,
                    variantId: $item->product_variant_id,
                    warehouseId: $order->warehouse_id,
                    quantity: (float) $item->quantity,
                    salesOrderId: $order->id,
                    userId: $order->created_by,
                );
            }
        });
    }

    public function reserve(
        int $productId,
        ?int $variantId,
        int $warehouseId,
        float $quantity,
        ?int $salesOrderId = null,
        ?int $userId = null
    ): Reservation {
        return DB::transaction(function () use ($productId, $variantId, $warehouseId, $quantity, $salesOrderId, $userId) {
            $this->inventoryService->move([
                'product_id' => $productId,
                'product_variant_id' => $variantId,
                'warehouse_id' => $warehouseId,
                'quantity' => $quantity,
                'movement_type' => 'reservation',
                'reference_type' => 'sales_order',
                'reference_id' => $salesOrderId,
                'user_id' => $userId,
                'reason' => 'Reservation for sales order',
            ]);

            return Reservation::create([
                'product_id' => $productId,
                'product_variant_id' => $variantId,
                'warehouse_id' => $warehouseId,
                'sales_order_id' => $salesOrderId,
                'quantity' => $quantity,
                'status' => 'active',
                'created_by' => $userId,
            ]);
        });
    }

    public function releaseForOrder(SalesOrder $order): void
    {
        DB::transaction(function () use ($order) {
            $reservations = Reservation::where('sales_order_id', $order->id)
                ->where('status', 'active')
                ->lockForUpdate()
                ->get();

            foreach ($reservations as $reservation) {
                $this->inventoryService->move([
                    'product_id' => $reservation->product_id,
                    'product_variant_id' => $reservation->product_variant_id,
                    'warehouse_id' => $reservation->warehouse_id,
                    'quantity' => (float) $reservation->quantity,
                    'movement_type' => 'reservation_release',
                    'reference_type' => 'sales_order',
                    'reference_id' => $order->id,
                    'user_id' => $order->created_by,
                    'reason' => 'Reservation released on cancellation',
                ]);

                $reservation->update([
                    'status' => 'released',
                    'released_at' => now(),
                ]);
            }
        });
    }

    public function fulfillForOrder(SalesOrder $order): void
    {
        DB::transaction(function () use ($order) {
            $reservations = Reservation::where('sales_order_id', $order->id)
                ->where('status', 'active')
                ->lockForUpdate()
                ->get();

            // 1) Release the warehouse-level reservation so the stock_out
            //    availability check does not count this order's own commitment.
            foreach ($reservations as $reservation) {
                $this->inventoryService->move([
                    'product_id' => $reservation->product_id,
                    'product_variant_id' => $reservation->product_variant_id,
                    'warehouse_id' => $reservation->warehouse_id,
                    'quantity' => (float) $reservation->quantity,
                    'movement_type' => 'reservation_release',
                    'reference_type' => 'sales_order',
                    'reference_id' => $order->id,
                    'user_id' => auth()->id(),
                    'reason' => 'Reservation resolved on shipment',
                ]);

                $reservation->update([
                    'status' => 'fulfilled',
                    'released_at' => now(),
                ]);
            }

            // 2) Deduct physical stock from the bins the picker used
            //    (falls back to automatic bin allocation).
            $pickBins = PickListItem::whereHas('pickList', fn ($q) => $q->where('sales_order_id', $order->id))
                ->get()
                ->keyBy(fn ($i) => $i->product_id . ':' . ($i->product_variant_id ?? ''));

            foreach ($order->items()->get() as $item) {
                $key = $item->product_id . ':' . ($item->product_variant_id ?? '');
                $this->inventoryService->moveOut([
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'warehouse_id' => $order->warehouse_id,
                    'preferred_bin_id' => $pickBins[$key]->bin_id ?? null,
                    'quantity' => (float) $item->quantity,
                    'movement_type' => 'stock_out',
                    'reference_type' => 'sales_order',
                    'reference_id' => $order->id,
                    'user_id' => auth()->id(),
                    'reason' => 'Stock out on shipment ' . $order->number,
                ]);
            }
        });
    }
}
