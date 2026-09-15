<?php

namespace App\Http\Controllers\Api\V1\Product;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Product;
use App\Models\ProductBarcode;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::with(['category', 'brand', 'unit']);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        if ($categoryId = $request->input('category_id')) {
            $query->where('category_id', $categoryId);
        }

        if ($brandId = $request->input('brand_id')) {
            $query->where('brand_id', $brandId);
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $perPage = min((int) $request->input('per_page', 15), 100);

        $products = $query->orderBy($sortBy, $sortOrder)->paginate($perPage);
        return $this->paginated($products);
    }

    public function show(Product $product)
    {
        $product->load(['category', 'brand', 'unit', 'variants', 'barcodes', 'images']);

        $stock = DB::table('inventory_balances')
            ->selectRaw('SUM(quantity_on_hand) as on_hand, SUM(quantity_reserved) as reserved, SUM(quantity_damaged) as damaged')
            ->where('product_id', $product->id)
            ->first();

        $product->stock_summary = $stock;

        return $this->success($product);
    }

    public function store(Request $request)
    {
        $request->validate([
            'sku' => 'required|unique:products,sku|max:50',
            'name' => 'required|max:200',
            'category_id' => 'required|exists:categories,id',
            'brand_id' => 'nullable|exists:brands,id',
            'unit_id' => 'required|exists:units,id',
            'cost_price' => 'nullable|numeric|min:0',
            'selling_price' => 'required|numeric|min:0',
            'tax_rate' => 'nullable|numeric|min:0|max:100',
            'min_stock' => 'nullable|numeric|min:0',
            'max_stock' => 'nullable|numeric|min:0',
            'reorder_level' => 'nullable|numeric|min:0',
            'weight' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:active,inactive,discontinued',
        ]);

        return $this->success(Product::create($request->all()), 'Product created.', [], 201);
    }

    public function update(Request $request, Product $product)
    {
        $request->validate([
            'sku' => 'sometimes|required|unique:products,sku,' . $product->id . '|max:50',
            'name' => 'sometimes|required|max:200',
            'selling_price' => 'sometimes|required|numeric|min:0',
            'status' => 'nullable|in:active,inactive,discontinued',
        ]);

        $product->update($request->all());

        return $this->success($product->fresh(), 'Product updated.');
    }

    public function destroy(Product $product)
    {
        $product->delete();
        return $this->success(null, 'Product deleted.');
    }

    public function lookup(Request $request)
    {
        $search = $request->input('q', '');
        $products = Product::where('status', 'active')
            ->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%");
            })
            ->limit(20)
            ->get(['id', 'sku', 'name', 'selling_price']);

        return $this->success($products);
    }
}