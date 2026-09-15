<?php

namespace App\Http\Controllers\Api\V1\User;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with('roles');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }
        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        return $this->paginated($query->orderBy('name')->paginate($perPage));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'phone' => 'nullable|string',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'exists:roles,id',
            'warehouse_ids' => 'nullable|array',
            'warehouse_ids.*' => 'exists:warehouses,id',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'phone' => $request->phone,
            'is_active' => true,
        ]);

        if ($request->has('role_ids')) {
            $user->roles()->sync($request->input('role_ids'));
        }
        if ($request->has('warehouse_ids')) {
            $user->warehouses()->sync($request->input('warehouse_ids'));
        }

        return $this->success($user->fresh('roles', 'warehouses'), 'User created.', [], 201);
    }

    public function show(User $user)
    {
        $user->load(['roles', 'warehouses']);
        $user->permissions = $user->getAllPermissions();
        return $this->success($user);
    }

    public function update(Request $request, User $user)
    {
        $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'email' => ['sometimes', 'required', 'email', Rule::unique('users')->ignore($user->id)],
            'phone' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'exists:roles,id',
            'warehouse_ids' => 'nullable|array',
            'warehouse_ids.*' => 'exists:warehouses,id',
        ]);

        $user->update($request->only(['name', 'email', 'phone', 'is_active']));

        if ($request->has('role_ids')) {
            $user->roles()->sync($request->input('role_ids'));
        }
        if ($request->has('warehouse_ids')) {
            $user->warehouses()->sync($request->input('warehouse_ids'));
        }

        return $this->success($user->fresh('roles', 'warehouses'), 'User updated.');
    }

    public function destroy(User $user)
    {
        if ($user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Deactivate the user before deleting.',
                'errors' => (object) [],
                'data' => null,
                'meta' => [],
            ], 422);
        }

        $user->delete();
        return $this->success(null, 'User deleted.');
    }

    public function deactivate(User $user)
    {
        $user->update(['is_active' => false]);
        return $this->success($user->fresh(), 'User deactivated.');
    }

    public function activate(User $user)
    {
        $user->update(['is_active' => true]);
        return $this->success($user->fresh(), 'User activated.');
    }

    public function resetPassword(Request $request, User $user)
    {
        $request->validate([
            'new_password' => 'required|string|min:8',
        ]);

        $user->update(['password' => Hash::make($request->new_password)]);
        $user->tokens()->delete();

        return $this->success(null, 'Password reset. User must login again.');
    }
}