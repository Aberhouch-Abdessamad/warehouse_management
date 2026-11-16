<?php

namespace App\Http\Controllers\Api\V1\User;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Only super admins may grant the super_admin role or manage other super admins.
     */
    private function guardEscalation(Request $request, ?User $target = null): ?\Illuminate\Http\JsonResponse
    {
        $actor = $request->user();
        if ($actor->hasRole('super_admin')) {
            return null;
        }
        $superRoleId = \App\Models\Role::where('name', 'super_admin')->value('id');
        if ($superRoleId && in_array($superRoleId, array_map('intval', (array) $request->input('role_ids', [])), true)) {
            return $this->errorResponse('Only a super administrator can grant the super administrator role.', 403);
        }
        if ($target && $target->hasRole('super_admin')) {
            return $this->errorResponse('Only a super administrator can modify another super administrator.', 403);
        }
        return null;
    }

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

        if ($deny = $this->guardEscalation($request, $user)) {
            return $deny;
        }
        if ($request->user()->id === $user->id && $request->has('is_active') && ! $request->boolean('is_active')) {
            return $this->errorResponse('You cannot deactivate your own account.', 422);
        }
        $user->update($request->only(['name', 'email', 'phone', 'is_active']));
        if ($request->has('is_active') && ! $request->boolean('is_active')) {
            $user->tokens()->delete();
        }

        if ($request->has('role_ids')) {
            $user->roles()->sync($request->input('role_ids'));
        }
        if ($request->has('warehouse_ids')) {
            $user->warehouses()->sync($request->input('warehouse_ids'));
        }

        return $this->success($user->fresh('roles', 'warehouses'), 'User updated.');
    }

    public function destroy(Request $request, User $user)
    {
        if ($deny = $this->guardEscalation($request, $user)) {
            return $deny;
        }
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

    public function deactivate(Request $request, User $user)
    {
        if ($request->user()->id === $user->id) {
            return $this->errorResponse('You cannot deactivate your own account.', 422);
        }
        if ($deny = $this->guardEscalation($request, $user)) {
            return $deny;
        }
        $user->update(['is_active' => false]);
        $user->tokens()->delete();
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
        if ($deny = $this->guardEscalation($request, $user)) {
            return $deny;
        }

        $user->update(['password' => Hash::make($request->new_password)]);
        $user->tokens()->delete();

        return $this->success(null, 'Password reset. User must login again.');
    }
}