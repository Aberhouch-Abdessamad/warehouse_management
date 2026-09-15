<?php

namespace App\Http\Controllers\Api\V1\Warehouse;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class WarehouseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->input('per_page', 15), 100);
        $warehouses = Warehouse::query();

        if ($search = $request->input('search')) {
            $warehouses->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $paginated = $warehouses->orderBy('name')->paginate($perPage);
        return $this->paginated($paginated);
    }

    public function show(Warehouse $warehouse): JsonResponse
    {
        return $this->success($warehouse);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'code' => 'required|unique:warehouses,code',
            'name' => 'required',
            'address' => 'nullable',
            'city' => 'nullable',
            'country' => 'nullable',
            'phone' => 'nullable',
            'email' => 'nullable|email',
            'is_active' => 'nullable|boolean',
        ]);

        return $this->success(
            Warehouse::create($request->only([
                'code', 'name', 'address', 'city', 'country', 'phone', 'email', 'is_active', 'allow_self_transfer',
            ])),
            'Warehouse created.',
            [],
            201
        );
    }

    public function update(Request $request, Warehouse $warehouse): JsonResponse
    {
        $request->validate([
            'code' => 'sometimes|required|unique:warehouses,code,' . $warehouse->id,
            'name' => 'sometimes|required',
        ]);

        $warehouse->update($request->only([
            'code', 'name', 'address', 'city', 'country', 'phone', 'email', 'is_active', 'allow_self_transfer',
        ]));

        return $this->success($warehouse->fresh(), 'Warehouse updated.');
    }

    public function destroy(Warehouse $warehouse): JsonResponse
    {
        $warehouse->delete();
        return $this->success(null, 'Warehouse deleted.');
    }
}