<?php

namespace App\Http\Controllers\Api\V1\Product;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        $categories = Category::with('children')
            ->whereNull('parent_id')
            ->orderBy('name')
            ->get();

        return $this->success($categories);
    }

    public function store(Request $request)
    {
        $request->validate([
            'code' => 'required|unique:categories,code|max:50',
            'name' => 'required|max:100',
            'parent_id' => 'nullable|exists:categories,id',
        ]);

        return $this->success(Category::create($request->only(['code', 'name', 'parent_id', 'description'])), 'Category created.', [], 201);
    }

    public function update(Request $request, Category $category)
    {
        $request->validate([
            'code' => 'sometimes|required|unique:categories,code,' . $category->id . '|max:50',
            'name' => 'sometimes|required|max:100',
            'parent_id' => 'nullable|exists:categories,id',
        ]);

        $category->update($request->only(['code', 'name', 'parent_id', 'description']));

        return $this->success($category->fresh(), 'Category updated.');
    }

    public function destroy(Category $category)
    {
        if ($category->products()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Category cannot be deleted; products are assigned to it.',
                'errors' => (object) [],
                'data' => null,
                'meta' => [],
            ], 409);
        }

        $category->delete();
        return $this->success(null, 'Category deleted.');
    }
}