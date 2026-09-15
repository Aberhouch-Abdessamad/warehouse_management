<?php

namespace App\Http\Controllers\Api\V1\Purchasing;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->input('per_page', 15), 100);
        $query = Supplier::query();

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        return $this->paginated($query->orderBy('name')->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|unique:suppliers,code|max:30',
            'name' => 'required|max:150',
            'email' => 'nullable|email',
            'tax_id' => 'nullable|string|max:30',
            'contact_name' => 'nullable|string|max:150',
            'phone' => 'nullable|string',
            'address' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        return $this->success(
            Supplier::create($validated),
            'Supplier created.',
            [],
            201
        );
    }

    public function show(Supplier $supplier): JsonResponse
    {
        $supplier->load('purchaseOrders');
        return $this->success($supplier);
    }

    public function update(Request $request, Supplier $supplier): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'sometimes|required|unique:suppliers,code,' . $supplier->id . '|max:30',
            'name' => 'sometimes|required|max:150',
            'email' => 'nullable|email',
            'tax_id' => 'nullable|string|max:30',
            'contact_name' => 'nullable|string|max:150',
            'phone' => 'nullable|string',
            'address' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $supplier->update($validated);
        return $this->success($supplier->fresh(), 'Supplier updated.');
    }

    public function destroy(Supplier $supplier): JsonResponse
    {
        if ($supplier->purchaseOrders()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Supplier has purchase orders; deactivate instead of deleting.',
                'errors' => (object) [],
                'data' => null,
                'meta' => [],
            ], 409);
        }

        $supplier->delete();
        return $this->success(null, 'Supplier deleted.');
    }
}