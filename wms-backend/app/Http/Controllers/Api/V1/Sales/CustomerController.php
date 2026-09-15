<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->input('per_page', 15), 100);
        $query = Customer::query();

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
            'code' => 'required|unique:customers,code|max:30',
            'name' => 'required|max:150',
            'email' => 'nullable|email',
            'tax_id' => 'nullable|string|max:30',
            'contact_name' => 'nullable|string|max:150',
            'phone' => 'nullable|string',
            'address' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        return $this->success(
            Customer::create($validated),
            'Customer created.',
            [],
            201
        );
    }

    public function show(Customer $customer): JsonResponse
    {
        $customer->load('salesOrders');
        return $this->success($customer);
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'sometimes|required|unique:customers,code,' . $customer->id . '|max:30',
            'name' => 'sometimes|required|max:150',
            'email' => 'nullable|email',
            'tax_id' => 'nullable|string|max:30',
            'contact_name' => 'nullable|string|max:150',
            'phone' => 'nullable|string',
            'address' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $customer->update($validated);
        return $this->success($customer->fresh(), 'Customer updated.');
    }

    public function destroy(Customer $customer): JsonResponse
    {
        if ($customer->salesOrders()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Customer has sales orders; deactivate instead of deleting.',
                'errors' => (object) [],
                'data' => null,
                'meta' => [],
            ], 409);
        }

        $customer->delete();
        return $this->success(null, 'Customer deleted.');
    }
}