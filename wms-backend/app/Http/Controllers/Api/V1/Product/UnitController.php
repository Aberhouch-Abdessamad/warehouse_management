<?php

namespace App\Http\Controllers\Api\V1\Product;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Unit;
use Illuminate\Http\Request;

class UnitController extends Controller
{
    public function index()
    {
        return $this->success(Unit::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'code' => 'required|unique:units,code|max:20',
            'name' => 'required|max:50',
            'description' => 'nullable|string',
        ]);

        return $this->success(Unit::create($request->only(['code', 'name', 'description'])), 'Unit created.', [], 201);
    }

    public function update(Request $request, Unit $unit)
    {
        $request->validate([
            'code' => 'sometimes|required|unique:units,code,' . $unit->id . '|max:20',
            'name' => 'sometimes|required|max:50',
        ]);

        $unit->update($request->only(['code', 'name', 'description']));

        return $this->success($unit->fresh(), 'Unit updated.');
    }

    public function destroy(Unit $unit)
    {
        if ($unit->products()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Unit cannot be deleted; products are assigned to it.',
                'errors' => (object) [],
                'data' => null,
                'meta' => [],
            ], 409);
        }

        $unit->delete();
        return $this->success(null, 'Unit deleted.');
    }
}