<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Package;
use App\Models\SalesOrder;
use App\Models\Shipment;
use App\Models\ShipmentItem;
use App\Services\ReservationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ShippingController extends Controller
{
    public function __construct(
        private ReservationService $reservationService
    ) {}

    public function index(Request $request)
    {
        $query = Shipment::with(['salesOrder.customer', 'warehouse']);

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }
        if ($warehouseId = $request->input('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        return $this->paginated($query->orderByDesc('created_at')->paginate($perPage));
    }

    public function ship(Request $request, SalesOrder $salesOrder)
    {
        $request->validate([
            'carrier' => 'nullable|string|max:100',
            'tracking_number' => 'nullable|string|max:100',
        ]);

         $package = Package::where('sales_order_id', $salesOrder->id)->first();

        if (! $package) {
            return $this->error('Sales order must be packed before shipping.', 422);
        }

        // Guard against double-shipping: once shipped/delivered, stock must not decrement again
        if ($salesOrder->status === 'shipped' || $salesOrder->status === 'delivered') {
            return $this->error('Order has already been shipped; no further shipments allowed.', 422);
        }

        $shipment = DB::transaction(function () use ($request, $salesOrder, $package) {
            $shipment = Shipment::create([
                'number' => 'SHP-' . now()->format('Ymd') . '-' . str_pad((string) (Shipment::max('id') + 1), 5, '0', STR_PAD_LEFT),
                'sales_order_id' => $salesOrder->id,
                'warehouse_id' => $salesOrder->warehouse_id,
                'status' => 'shipped',
                'carrier' => $request->input('carrier'),
                'tracking_number' => $request->input('tracking_number'),
                'shipped_at' => now(),
            ]);

            foreach ($salesOrder->items as $item) {
                ShipmentItem::create([
                    'shipment_id' => $shipment->id,
                    'sales_order_id' => $salesOrder->id,
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'quantity' => (float) $item->quantity,
                ]);
            }
            $this->reservationService->fulfillForOrder($salesOrder);
            $salesOrder->update(['status' => 'shipped']);

            return $shipment;
        });

        return $this->success($shipment->load('items'), 'Order shipped and stock deducted.', [], 201);
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