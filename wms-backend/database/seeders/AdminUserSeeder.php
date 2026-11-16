<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Seed one login account per role so the app can be explored from
     * each role's perspective. Emails match the demo-account quick
     * login buttons in the frontend. All use the password "password".
     */
    public function run(): void
    {
        $superAdminRole = Role::where('name', 'super_admin')->first();

        if (! $superAdminRole) {
            $this->command->warn('super_admin role not found. Running RolesAndPermissionsSeeder first...');

            $this->call(RolesAndPermissionsSeeder::class);

            $superAdminRole = Role::where('name', 'super_admin')->first();
        }

        $accounts = [
            ['name' => 'System Administrator', 'email' => 'admin@wms.test', 'phone' => '+1-555-0100', 'role' => 'super_admin'],
            ['name' => 'Warehouse Manager', 'email' => 'manager@wms.test', 'phone' => '+1-555-0101', 'role' => 'warehouse_manager'],
            ['name' => 'Floor Staff', 'email' => 'staff@wms.test', 'phone' => '+1-555-0102', 'role' => 'warehouse_staff'],
            ['name' => 'Purchasing Manager', 'email' => 'purchasing@wms.test', 'phone' => '+1-555-0103', 'role' => 'purchasing_manager'],
            ['name' => 'Sales Manager', 'email' => 'sales@wms.test', 'phone' => '+1-555-0104', 'role' => 'sales_manager'],
        ];

        foreach ($accounts as $account) {
            $role = Role::where('name', $account['role'])->first();

            if (! $role) {
                $this->command->warn("Role {$account['role']} not found, skipping {$account['email']}.");

                continue;
            }

            $user = User::updateOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'email' => $account['email'],
                    'password' => Hash::make('password'),
                    'phone' => $account['phone'],
                    'is_active' => true,
                    'email_verified_at' => now(),
                ]
            );

            $user->roles()->sync([$role->id]);

            $this->command->info("  {$account['email']} ({$account['role']})");
        }

        $this->command->info('Role accounts created successfully. Password for all: password');
    }
}
