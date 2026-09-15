<?php

namespace App\Http\Controllers\Api\V1\Purchasing;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\GoodsReceipt;
use Illuminate\Http\Request;

class ReceivingController extends Controller
{
    public function index(Request $request)
    {
        $query = GoodsReceipt::with(['purchaseOrder.supplier', 'warehouse', 'receivedBy', 'items.product']);

        if ($warehouseId = $request->input('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%");
            });
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        return $this->paginated($query->orderByDesc('received_at')->paginate($perPage));
    }

    public function show(GoodsReceipt $goodsReceipt)
    {
        $goodsReceipt->load(['purchaseOrder.supplier', 'warehouse', 'receivedBy', 'items.product']);
        return $this->success($goodsReceipt);
    }
}