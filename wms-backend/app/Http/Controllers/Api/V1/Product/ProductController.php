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
        $query = Product::with(['category', 'brand', 'unit'])
            ->withSum('inventoryBalances as on_hand', 'quantity_on_hand')
            ->withSum('inventoryBalances as reserved', 'quantity_reserved');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%")
                  ->orWhereHas('barcodes', fn ($b) => $b->where('barcode', $search));
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

        $sortBy = in_array($request->input('sort_by'), ['created_at', 'name', 'sku', 'selling_price', 'cost_price'], true)
            ? $request->input('sort_by') : 'created_at';
        $sortOrder = $request->input('sort_order') === 'asc' ? 'asc' : 'desc';
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
        $validated = $request->validate($this->rules());

        return $this->success(Product::create($validated)->load(['category', 'brand', 'unit']), 'Product created.', [], 201);
    }

    private function rules(?Product $product = null): array
    {
        $req = $product ? 'sometimes|required' : 'required';

        return [
            'sku' => "{$req}|max:50|unique:products,sku" . ($product ? ',' . $product->id : ''),
            'name' => "{$req}|max:200",
            'description' => 'nullable|string',
            'category_id' => 'nullable|exists:categories,id',
            'brand_id' => 'nullable|exists:brands,id',
            'unit_id' => 'nullable|exists:units,id',
            'cost_price' => 'nullable|numeric|min:0',
            'selling_price' => "{$req}|numeric|min:0",
            'tax_rate' => 'nullable|numeric|min:0|max:100',
            'min_stock' => 'nullable|numeric|min:0',
            'max_stock' => 'nullable|numeric|min:0',
            'reorder_level' => 'nullable|numeric|min:0',
            'weight' => 'nullable|numeric|min:0',
            'width' => 'nullable|numeric|min:0',
            'height' => 'nullable|numeric|min:0',
            'depth' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:active,inactive,discontinued',
        ];
    }

    public function update(Request $request, Product $product)
    {
        $validated = $request->validate($this->rules($product));

        $product->update($validated);

        return $this->success($product->fresh(['category', 'brand', 'unit']), 'Product updated.');
    }

    public function destroy(Product $product)
    {
        $hasStock = DB::table('inventory_balances')->where('product_id', $product->id)
            ->where(fn ($q) => $q->where('quantity_on_hand', '>', 0)->orWhere('quantity_reserved', '>', 0))
            ->exists();
        if ($hasStock) {
            return $this->errorResponse('Product still has stock on hand. Set it to inactive/discontinued instead.', 409);
        }

        $product->delete();
        return $this->success(null, 'Product deleted.');
    }

    public function lookup(Request $request)
    {
        $search = $request->input('q', '');
        $products = Product::where('status', 'active')
            ->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%")
                  ->orWhereHas('barcodes', fn ($b) => $b->where('barcode', $search));
            })
            ->limit(20)
            ->get(['id', 'sku', 'name', 'selling_price']);

        return $this->success($products);
    }
}