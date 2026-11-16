<?php

namespace App\Http\Controllers\Api\V1\Product;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Product;
use App\Models\ProductBarcode;
use Illuminate\Http\Request;

class BarcodeController extends Controller
{
    public function index(Product $product)
    {
        return $this->success(ProductBarcode::where('product_id', $product->id)->get());
    }

    public function store(Request $request, Product $product)
    {
        $validated = $request->validate([
            'barcode' => 'required|string|max:35|unique:product_barcodes,barcode',
            'type' => 'nullable|in:none,gtin12,gtin13,gtin14,ean13,ean8,upc_a,isbn,issn,upc_e,code128,qr',
        ]);

        $barcode = ProductBarcode::create([
            'product_id' => $product->id,
            'barcode' => $validated['barcode'],
            'type' => $validated['type'] ?? 'gtin13',
        ]);

        return $this->success($barcode, 'Barcode assigned.', [], 201);
    }

    public function destroy(Product $product, ProductBarcode $barcode)
    {
        if ((int) $barcode->product_id !== (int) $product->id) {
            return $this->errorResponse('Barcode does not belong to this product.', 404);
        }

        $barcode->delete();

        return $this->success(null, 'Barcode deleted.');
    }
}
