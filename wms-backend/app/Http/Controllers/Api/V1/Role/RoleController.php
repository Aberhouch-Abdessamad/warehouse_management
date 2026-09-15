<?php

namespace App\Http\Controllers\Api\V1\Role;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function index()
    {
        $roles = Role::with('permissions')->get();
        return $this->success($roles);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|unique:roles,name|max:50',
            'display_name' => 'required|max:100',
            'description' => 'nullable|string',
        ]);

        return $this->success(Role::create($request->only(['name', 'display_name', 'description'])), 'Role created.', [], 201);
    }

    public function show(Role $role)
    {
        $role->load('permissions');
        return $this->success($role);
    }

    public function update(Request $request, Role $role)
    {
        if ($role->is_system) {
            return response()->json([
                'success' => false,
                'message' => 'System roles cannot be modified.',
                'errors' => (object) [],
                'data' => null,
                'meta' => [],
            ], 403);
        }

        $request->validate([
            'name' => 'sometimes|required|unique:roles,name,' . $role->id . '|max:50',
            'display_name' => 'sometimes|required|max:100',
        ]);

        $role->update($request->only(['name', 'display_name', 'description']));
        return $this->success($role->fresh('permissions'), 'Role updated.');
    }

    public function destroy(Role $role)
    {
        if ($role->is_system) {
            return response()->json([
                'success' => false,
                'message' => 'System roles cannot be deleted.',
                'errors' => (object) [],
                'data' => null,
                'meta' => [],
            ], 403);
        }

        if ($role->users()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Role has users assigned; reassign before deleting.',
                'errors' => (object) [],
                'data' => null,
                'meta' => [],
            ], 409);
        }

        $role->delete();
        return $this->success(null, 'Role deleted.');
    }

    public function syncPermissions(Request $request, Role $role)
    {
        $request->validate([
            'permission_ids' => 'required|array',
            'permission_ids.*' => 'exists:permissions,id',
        ]);

        $role->permissions()->sync($request->input('permission_ids'));
        return $this->success($role->fresh('permissions'), 'Permissions updated.');
    }
}