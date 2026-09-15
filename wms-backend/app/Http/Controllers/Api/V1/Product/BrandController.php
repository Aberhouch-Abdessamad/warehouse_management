<?php

namespace App\Http\Controllers\Api\V1\Product;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Brand;
use Illuminate\Http\Request;

class BrandController extends Controller
{
    public function index()
    {
        return $this->success(Brand::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|unique:brands,name|max:100',
        ]);

        return $this->success(Brand::create($request->only(['name', 'description'])), 'Brand created.', [], 201);
    }

    public function update(Request $request, Brand $brand)
    {
        $request->validate([
            'name' => 'sometimes|required|unique:brands,name,' . $brand->id . '|max:100',
        ]);

        $brand->update($request->only(['name', 'description']));

        return $this->success($brand->fresh(), 'Brand updated.');
    }

    public function destroy(Brand $brand)
    {
        if ($brand->products()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Brand cannot be deleted; products are assigned to it.',
                'errors' => (object) [],
                'data' => null,
                'meta' => [],
            ], 409);
        }

        $brand->delete();
        return $this->success(null, 'Brand deleted.');
    }
}