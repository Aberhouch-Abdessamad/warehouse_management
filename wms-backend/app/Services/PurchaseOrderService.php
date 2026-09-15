<?php

namespace App\Services;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class PurchaseOrderService
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_ORDERED = 'ordered';
    public const STATUS_PARTIALLY_RECEIVED = 'partially_received';
    public const STATUS_RECEIVED = 'received';
    public const STATUS_CANCELLED = 'cancelled';

    public function __construct(
        private InventoryService $inventoryService
    ) {}

    public function create(array $data, array $items, int $userId): PurchaseOrder
    {
        return DB::transaction(function () use ($data, $items, $userId) {
            $po = PurchaseOrder::create([
                'number' => $this->generateNumber(),
                'supplier_id' => $data['supplier_id'],
                'warehouse_id' => $data['warehouse_id'],
                'created_by' => $userId,
                'order_date' => $data['order_date'] ?? now(),
                'expected_delivery' => $data['expected_delivery'] ?? null,
                'currency' => $data['currency'] ?? 'USD',
                'subtotal' => 0,
                'tax' => 0,
                'total' => 0,
                'status' => 'draft',
                'notes' => $data['notes'] ?? null,
            ]);

            $subtotal = 0;
            $taxTotal = 0;

            foreach ($items as $item) {
                $product = Product::findOrFail($item['product_id']);
                $unitCost = $item['unit_cost'] ?? $product->cost_price;
                $taxRate = $item['tax_rate'] ?? $product->tax_rate;
                $qty = (float) $item['quantity'];
                $lineSubtotal = $qty * $unitCost;
                $lineTax = $lineSubtotal * ($taxRate / 100);
                $lineTotal = $lineSubtotal + $lineTax;

                PurchaseOrderItem::create([
                    'purchase_order_id' => $po->id,
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'quantity' => $qty,
                    'unit_cost' => $unitCost,
                    'tax_rate' => $taxRate,
                    'line_total' => $lineTotal,
                    'received_quantity' => 0,
                ]);

                $subtotal += $lineSubtotal;
                $taxTotal += $lineTax;
            }

            $po->update([
                'subtotal' => $subtotal,
                'tax' => $taxTotal,
                'total' => $subtotal + $taxTotal,
            ]);

            return $po->fresh('items');
        });
    }

    public function submit(PurchaseOrder $po): PurchaseOrder
    {
        if ($po->status !== self::STATUS_DRAFT) {
            throw new InvalidArgumentException('Only draft purchase orders can be submitted.');
        }
        if ($po->items->isEmpty()) {
            throw new InvalidArgumentException('Purchase order must contain at least one item.');
        }

        $po->update(['status' => self::STATUS_SUBMITTED]);
        return $po->fresh();
    }

    public function approve(PurchaseOrder $po, int $userId): PurchaseOrder
    {
        if ($po->status !== self::STATUS_SUBMITTED) {
            throw new InvalidArgumentException('Only submitted purchase orders can be approved.');
        }

        $po->update([
            'status' => self::STATUS_APPROVED,
            'approved_by' => $userId,
            'approved_at' => now(),
        ]);

        return $po->fresh();
    }

    public function receive(PurchaseOrder $po, array $receipts, int $userId, ?int $binId = null): GoodsReceipt
    {
        if (! in_array($po->status, [self::STATUS_APPROVED, self::STATUS_PARTIALLY_RECEIVED])) {
            throw new InvalidArgumentException('Only approved or partially received POs can be received.');
        }

        return DB::transaction(function () use ($po, $receipts, $userId, $binId) {
            $gr = GoodsReceipt::create([
                'number' => 'GR-' . now()->format('Ymd') . '-' . str_pad((string) ((int) GoodsReceipt::max('id') + 1), 4, '0', STR_PAD_LEFT),
                'purchase_order_id' => $po->id,
                'warehouse_id' => $po->warehouse_id,
                'received_by' => $userId,
                'status' => 'received',
                'received_at' => now(),
                'notes' => 'Goods receipt for PO ' . $po->number,
            ]);

            foreach ($receipts as $receipt) {
                $poItem = PurchaseOrderItem::findOrFail($receipt['purchase_order_item_id']);

                if ((int) $poItem->purchase_order_id !== (int) $po->id) {
                    throw new InvalidArgumentException('Receipt line does not belong to this purchase order.');
                }

                $receiveQty = (float) $receipt['quantity'];

                if ($receiveQty <= 0) {
                    continue;
                }

                $remainingQty = (float) $poItem->quantity - (float) $poItem->received_quantity;
                if ($receiveQty > $remainingQty) {
                    throw new InvalidArgumentException(
                        "Over-receipt is not allowed. Ordered {$poItem->quantity}, already received {$poItem->received_quantity}, attempting {$receiveQty}."
                    );
                }

                GoodsReceiptItem::create([
                    'goods_receipt_id' => $gr->id,
                    'purchase_order_item_id' => $poItem->id,
                    'product_id' => $poItem->product_id,
                    'quantity' => $receiveQty,
                    'unit_cost' => $poItem->unit_cost,
                ]);

                $poItem->increment('received_quantity', $receiveQty);

                $this->inventoryService->move([
                    'product_id' => $poItem->product_id,
                    'product_variant_id' => $poItem->product_variant_id,
                    'warehouse_id' => $po->warehouse_id,
                    'bin_id' => $binId,
                    'quantity' => $receiveQty,
                    'movement_type' => 'stock_in',
                    'reference_type' => 'purchase_order',
                    'reference_id' => $po->id,
                    'user_id' => $userId,
                    'reason' => 'Receiving PO ' . $po->number,
                ]);
            }

             $allReceived = $po->items()->get()->every(fn($i) => $i->received_quantity >= $i->quantity);
             $newStatus = $allReceived ? self::STATUS_RECEIVED : self::STATUS_PARTIALLY_RECEIVED;
             $po->update(['status' => $newStatus]);

            return $gr->fresh('items');
        });
    }

     public function cancel(PurchaseOrder $po): PurchaseOrder
     {
        if (in_array($po->status, [self::STATUS_RECEIVED, self::STATUS_CANCELLED])) {
            throw new InvalidArgumentException('Cannot cancel a received or already cancelled PO.');
        }

        $po->update(['status' => self::STATUS_CANCELLED]);
         return $po->fresh();
     }

    private function generateNumber(): string
    {
        return 'PO-' . now()->format('Ymd') . '-' . str_pad((string) (PurchaseOrder::max('id') + 1), 5, '0', STR_PAD_LEFT);
    }
}