<?php

namespace App\Http\Controllers\Api\V1\Warehouse;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Warehouse;
use App\Models\Zone;
use App\Models\Aisle;
use App\Models\Rack;
use App\Models\Shelf;
use App\Models\Bin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class LocationController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'warehouse_id' => 'nullable|integer',
            'type' => 'nullable|in:zone,aisle,rack,shelf,bin',
        ]);

        $warehouseId = $request->input('warehouse_id');
        $type = $request->input('type', 'bin');

        $data = match ($type) {
            'zone' => $warehouseId ? Zone::where('warehouse_id', $warehouseId)->get() : Zone::all(),
            'aisle' => Aisle::with('zone')->when($warehouseId, fn($q) => $q->whereHas('zone', fn($z) => $z->where('warehouse_id', $warehouseId)))->get(),
            'rack' => Rack::with('aisle.zone')->when($warehouseId, fn($q) => $q->whereHas('aisle.zone', fn($z) => $z->where('warehouse_id', $warehouseId)))->get(),
            'shelf' => Shelf::with('rack.aisle.zone')->when($warehouseId, fn($q) => $q->whereHas('rack.aisle.zone', fn($z) => $z->where('warehouse_id', $warehouseId)))->get(),
            'bin' => Bin::with('shelf.rack.aisle.zone')->when($warehouseId, fn($q) => $q->whereHas('shelf.rack.aisle.zone', fn($z) => $z->where('warehouse_id', $warehouseId)))->get(),
        };

        return $this->success($data);
    }

    public function show(string $location)
    {
        $model = $this->resolveModel($location);
        return $this->success($model);
    }

    public function store(Request $request)
    {
        $request->validate([
            'type' => ['required', Rule::in(['zone', 'aisle', 'rack', 'shelf', 'bin'])],
            'warehouse_id' => 'required_if:type,zone|nullable|integer',
            'parent_id' => 'required_unless:type,zone|nullable|integer',
            'code' => 'required|string|max:50',
            'name' => 'nullable|string|max:200',
            'type_attributes' => 'nullable|array',
        ]);

        $type = $request->input('type');
        $parentId = $request->input('parent_id');
        $code = $request->input('code');

        $record = match ($type) {
            'zone' => Zone::create([
                'warehouse_id' => $request->input('warehouse_id'),
                'code' => $code,
                'name' => $request->input('name', $code),
                'description' => $request->input('type_attributes.description'),
            ]),
            'aisle' => Aisle::create([
                'zone_id' => $parentId,
                'code' => $code,
                'name' => $request->input('name', $code),
            ]),
            'rack' => Rack::create([
                'aisle_id' => $parentId,
                'code' => $code,
            ]),
            'shelf' => Shelf::create([
                'rack_id' => $parentId,
                'code' => $code,
            ]),
            'bin' => Bin::create([
                'shelf_id' => $parentId,
                'code' => $code,
                'type' => $request->input('type_attributes.type', 'pickable'),
                'is_active' => true,
            ]),
        };

        return $this->success($record, 'Location created.', [], 201);
    }

    public function update(Request $request, string $location)
    {
        $model = $this->resolveModel($location);

        $request->validate([
            'code' => 'sometimes|string|max:50',
            'name' => 'sometimes|string|max:200',
            'is_active' => 'sometimes|boolean',
        ]);

        $model->update($request->only(['code', 'name', 'is_active', 'description', 'type']));

        return $this->success($model->fresh(), 'Location updated.');
    }

    public function destroy(string $location)
    {
        $model = $this->resolveModel($location);
        $model->delete();

        return $this->success(null, 'Location deleted.');
    }

    public function tree(Warehouse $warehouse)
    {
        $zones = Zone::where('warehouse_id', $warehouse->id)
            ->with([
                'aisles.racks.shelves.bins',
            ])
            ->get();

        return $this->success($zones, 'Location tree.');
    }

    private function resolveModel(string $id): mixed
    {
        $parts = explode('-', $id);

        if (count($parts) >= 2) {
            $type = $parts[0];
            $recordId = (int) $parts[1];

            return match ($type) {
                'zone' => Zone::with('warehouse', 'aisles')->findOrFail($recordId),
                'aisle' => Aisle::with('zone', 'racks')->findOrFail($recordId),
                'rack' => Rack::with('aisle.zone', 'shelves')->findOrFail($recordId),
                'shelf' => Shelf::with('rack.aisle.zone', 'bins')->findOrFail($recordId),
                'bin' => Bin::with('shelf.rack.aisle.zone')->findOrFail($recordId),
                default => abort(404, 'Unknown location type.'),
            };
        }

        $bin = Bin::find((int) $id);
        if ($bin) {
            return $bin;
        }

        $zone = Zone::find((int) $id);
        if ($zone) {
            return $zone;
        }

        abort(404, 'Location not found.');
    }
}