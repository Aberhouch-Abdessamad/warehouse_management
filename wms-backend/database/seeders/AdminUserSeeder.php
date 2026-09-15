<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Seed the first admin user and assign the super_admin role.
     */
    public function run(): void
    {
        $superAdminRole = Role::where('name', 'super_admin')->first();

        if (! $superAdminRole) {
            $this->command->warn('super_admin role not found. Running RolesAndPermissionsSeeder first...');

            $this->call(RolesAndPermissionsSeeder::class);

            $superAdminRole = Role::where('name', 'super_admin')->first();
        }

        $adminUser = User::updateOrCreate(
            ['email' => 'admin@wms.com'],
            [
                'name' => 'System Administrator',
                'email' => 'admin@wms.com',
                'password' => Hash::make('password'),
                'phone' => '+1-555-0100',
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );

        if (! $adminUser->hasRole('super_admin')) {
            $adminUser->roles()->attach($superAdminRole->id);
        }

        $this->command->info('First admin user created successfully.');
        $this->command->info('  Email:    admin@wms.com');
        $this->command->info('  Password: password');
    }
}