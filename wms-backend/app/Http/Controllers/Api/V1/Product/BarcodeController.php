<?php

namespace App\Http\Controllers\Api\V1\Product;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Product;
use App\Models\ProductBarcode;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BarcodeController extends Controller
{
    public function index(Request $request)
    {
        $query = ProductBarcode::with('product');
        if ($sku = $request->input('sku')) {
            $query->whereHas('product', fn($q) => $q->where('sku', $sku));
        }
        if ($productId = $request->input('product_id')) {
            $query->where('product_id', $productId);
        }

        $barcodes = $query->get();

        return $this->success($barcodes);
    }

    public function store(Request $request)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'barcode' => 'required|string|max:35',
            'type' => 'nullable|in:none,gtin12,gtin13,gtin14,ean13,ean8,upc_a,isbn,issn,upc_e',
        ]);

        $existing = ProductBarcode::where('product_id', $request->product_id)
            ->where('barcode', $request->barcode)
            ->exists();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'Barcode already assigned to this product.',
                'errors' => (object) [],
                'data' => null,
                'meta' => [],
            ], 422);
        }

        $barcode = ProductBarcode::create([
            'product_id' => $request->product_id,
            'barcode' => $request->barcode,
            'type' => $request->input('type', 'gtin13'),
        ]);

        return $this->success($barcode, 'Barcode assigned.');
    }

    public function update(Request $request, ProductBarcode $item)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'barcode' => 'required|max:35',
        ]);

        $item->update($request->only(['product_id', 'barcode', 'type']));
        return $this->success($item->fresh(), 'Barcode updated.');
    }

    public function destroy(ProductBarcode $item)
    {
        $item->delete();
        return $this->success(null, 'Barcode deleted.');
    }
}