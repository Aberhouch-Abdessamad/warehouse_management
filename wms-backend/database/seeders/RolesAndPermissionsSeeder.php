<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolesAndPermissionsSeeder extends Seeder
{
    private array $permissions = [
        'Dashboard' => [
            'dashboard.view' => 'View dashboard overview',
        ],
        'Products' => [
            'products.view' => 'View products and product details',
            'products.create' => 'Create new products',
            'products.update' => 'Update existing products',
            'products.delete' => 'Delete products',
        ],
        'Categories' => [
            'categories.view' => 'View product categories',
            'categories.create' => 'Create product categories',
            'categories.update' => 'Update product categories',
            'categories.delete' => 'Delete product categories',
        ],
        'Brands' => [
            'brands.view' => 'View brands',
            'brands.create' => 'Create brands',
            'brands.update' => 'Update brands',
            'brands.delete' => 'Delete brands',
        ],
        'Units' => [
            'units.view' => 'View units of measure',
            'units.create' => 'Create units of measure',
            'units.update' => 'Update units of measure',
            'units.delete' => 'Delete units of measure',
        ],
        'Warehouses' => [
            'warehouses.view' => 'View warehouses',
            'warehouses.create' => 'Create warehouses',
            'warehouses.update' => 'Update warehouses',
            'warehouses.delete' => 'Delete warehouses',
        ],
        'Locations' => [
            'locations.view' => 'View warehouse locations',
            'locations.create' => 'Create warehouse locations',
            'locations.update' => 'Update warehouse locations',
            'locations.delete' => 'Delete warehouse locations',
        ],
        'Inventory' => [
            'stock.view' => 'View inventory stock levels',
            'stock.adjust' => 'Adjust inventory stock levels',
            'stock-movements.view' => 'View stock movement history',
            'adjustments.view' => 'View stock adjustments',
            'adjustments.create' => 'Create stock adjustments',
        ],
        'Transfers' => [
            'transfers.view' => 'View stock transfers',
            'transfers.create' => 'Create stock transfers',
            'transfers.update' => 'Update stock transfers',
            'transfers.delete' => 'Delete stock transfers',
            'transfers.approve' => 'Approve stock transfers',
            'transfers.ship' => 'Ship stock transfers',
            'transfers.receive' => 'Receive stock transfers',
        ],
        'Suppliers' => [
            'suppliers.view' => 'View suppliers',
            'suppliers.create' => 'Create suppliers',
            'suppliers.update' => 'Update suppliers',
            'suppliers.delete' => 'Delete suppliers',
        ],
        'Purchase Orders' => [
            'purchase-orders.view' => 'View purchase orders',
            'purchase-orders.create' => 'Create purchase orders',
            'purchase-orders.update' => 'Update purchase orders',
            'purchase-orders.delete' => 'Delete purchase orders',
            'purchase-orders.approve' => 'Approve purchase orders',
            'purchase-orders.receive' => 'Receive goods against purchase orders',
        ],
        'Customers' => [
            'customers.view' => 'View customers',
            'customers.create' => 'Create customers',
            'customers.update' => 'Update customers',
            'customers.delete' => 'Delete customers',
        ],
        'Sales Orders' => [
            'sales-orders.view' => 'View sales orders',
            'sales-orders.create' => 'Create sales orders',
            'sales-orders.update' => 'Update sales orders',
            'sales-orders.delete' => 'Delete sales orders',
            'sales-orders.confirm' => 'Confirm sales orders',
            'sales-orders.cancel' => 'Cancel sales orders',
        ],
        'Picking' => [
            'picking.view' => 'View picking tasks',
            'picking.execute' => 'Execute picking tasks',
        ],
        'Putaway' => [
            'putaway.view' => 'View putaway tasks',
            'putaway.execute' => 'Execute putaway tasks',
        ],
        'Returns' => [
            'returns.view' => 'View return orders',
            'returns.create' => 'Create return orders',
            'returns.receive' => 'Receive returned goods',
        ],
        'Stock Counts' => [
            'stock-counts.view' => 'View stock counts',
            'stock-counts.create' => 'Create stock counts',
            'stock-counts.execute' => 'Record and apply stock counts',
        ],
        'Packing' => [
            'packing.view' => 'View packing tasks',
            'packing.execute' => 'Execute packing tasks',
        ],
        'Shipping' => [
            'shipping.view' => 'View shipping tasks',
            'shipping.execute' => 'Execute shipping tasks',
        ],
        'Reports' => [
            'reports.view' => 'View reports and analytics',
            'reports.export' => 'Export reports',
        ],
        'Users' => [
            'users.view' => 'View users',
            'users.create' => 'Create users',
            'users.update' => 'Update users',
            'users.delete' => 'Delete users',
            'users.activate' => 'Activate deactivated users',
            'users.deactivate' => 'Deactivate users',
        ],
        'Roles' => [
            'roles.view' => 'View roles',
            'roles.create' => 'Create roles',
            'roles.update' => 'Update roles',
            'roles.delete' => 'Delete roles',
            'roles.manage' => 'Assign permissions to roles',
        ],
        'Audit Logs' => [
            'audit-logs.view' => 'View audit logs',
        ],
        'Notifications' => [
            'notifications.view' => 'View notifications',
            'notifications.manage' => 'Manage notifications',
        ],
        'Settings' => [
            'settings.view' => 'View system settings',
            'settings.update' => 'Update system settings',
        ],
    ];

    private array $roles = [
        'super_admin' => [
            'display_name' => 'Super Administrator',
            'description' => 'Full unrestricted access to all modules and features.',
            'is_system' => true,
            'permissions' => ['*'],
        ],
        'admin' => [
            'display_name' => 'Administrator',
            'description' => 'Full management access to all operational modules.',
            'is_system' => true,
            'permissions' => [
                'dashboard.view',
                'reports.view',
                'reports.export',
                'products.view', 'products.create', 'products.update', 'products.delete',
                'categories.view', 'categories.create', 'categories.update', 'categories.delete',
                'brands.view', 'brands.create', 'brands.update', 'brands.delete',
                'units.view', 'units.create', 'units.update', 'units.delete',
                'warehouses.view', 'warehouses.create', 'warehouses.update', 'warehouses.delete',
                'locations.view', 'locations.create', 'locations.update', 'locations.delete',
                'stock.view', 'stock.adjust',
                'stock-movements.view',
                'adjustments.view', 'adjustments.create',
                'transfers.view', 'transfers.create', 'transfers.update', 'transfers.delete',
                'transfers.approve', 'transfers.ship', 'transfers.receive',
                'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
                'purchase-orders.view', 'purchase-orders.create', 'purchase-orders.update', 'purchase-orders.delete',
                'purchase-orders.approve', 'purchase-orders.receive',
                'customers.view', 'customers.create', 'customers.update', 'customers.delete',
                'sales-orders.view', 'sales-orders.create', 'sales-orders.update', 'sales-orders.delete',
                'sales-orders.confirm', 'sales-orders.cancel',
                'picking.view', 'picking.execute',
                'packing.view', 'packing.execute',
                'shipping.view', 'shipping.execute',
                'users.view', 'users.create', 'users.update', 'users.delete',
                'users.activate', 'users.deactivate',
                'audit-logs.view',
                'notifications.view', 'notifications.manage',
            ],
        ],
        'warehouse_manager' => [
            'display_name' => 'Warehouse Manager',
            'description' => 'Manages warehouse operations, inventory, transfers, and fulfillment.',
            'is_system' => true,
            'permissions' => [
                'dashboard.view',
                'products.view',
                'categories.view',
                'brands.view',
                'units.view',
                'warehouses.view',
                'locations.view', 'locations.create', 'locations.update', 'locations.delete',
                'stock.view', 'stock.adjust',
                'stock-movements.view',
                'adjustments.view', 'adjustments.create',
                'transfers.view', 'transfers.create', 'transfers.update',
                'transfers.approve', 'transfers.ship', 'transfers.receive',
                'suppliers.view',
                'purchase-orders.view', 'purchase-orders.receive',
                'customers.view',
                'sales-orders.view', 'sales-orders.confirm',
                'picking.view', 'picking.execute',
                'packing.view', 'packing.execute',
                'shipping.view', 'shipping.execute',
                'reports.view', 'reports.export',
                'notifications.view', 'notifications.manage',
            ],
        ],
        'warehouse_staff' => [
            'display_name' => 'Warehouse Staff',
            'description' => 'Performs day-to-day warehouse operations: picking, packing, and shipping.',
            'is_system' => true,
            'permissions' => [
                'dashboard.view',
                'products.view',
                'warehouses.view',
                'locations.view',
                'stock.view',
                'sales-orders.view',
                'picking.view', 'picking.execute',
                'packing.view', 'packing.execute',
                'shipping.view', 'shipping.execute',
                'transfers.view', 'transfers.receive',
                'notifications.view',
            ],
        ],
        'inventory_manager' => [
            'display_name' => 'Inventory Manager',
            'description' => 'Manages stock levels, adjustments, transfers and inventory reporting.',
            'is_system' => true,
            'permissions' => [
                'dashboard.view',
                'products.view',
                'categories.view',
                'brands.view',
                'units.view',
                'warehouses.view',
                'locations.view',
                'stock.view', 'stock.adjust',
                'stock-movements.view',
                'adjustments.view', 'adjustments.create',
                'transfers.view', 'transfers.create', 'transfers.update',
                'transfers.approve', 'transfers.ship', 'transfers.receive',
                'purchase-orders.view', 'purchase-orders.receive',
                'reports.view', 'reports.export',
                'notifications.view',
            ],
        ],
        'purchasing_manager' => [
            'display_name' => 'Purchasing Manager',
            'description' => 'Manages suppliers, purchase orders and goods receiving.',
            'is_system' => true,
            'permissions' => [
                'dashboard.view',
                'products.view',
                'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
                'purchase-orders.view', 'purchase-orders.create', 'purchase-orders.update', 'purchase-orders.delete',
                'purchase-orders.approve', 'purchase-orders.receive',
                'stock.view',
                'warehouses.view',
                'reports.view', 'reports.export',
                'notifications.view',
            ],
        ],
        'sales_manager' => [
            'display_name' => 'Sales Manager',
            'description' => 'Manages customers, sales orders and outbound fulfillment.',
            'is_system' => true,
            'permissions' => [
                'dashboard.view',
                'products.view',
                'customers.view', 'customers.create', 'customers.update', 'customers.delete',
                'sales-orders.view', 'sales-orders.create', 'sales-orders.update', 'sales-orders.delete',
                'sales-orders.confirm', 'sales-orders.cancel',
                'stock.view',
                'warehouses.view',
                'picking.view', 'picking.execute',
                'packing.view', 'packing.execute',
                'shipping.view', 'shipping.execute',
                'reports.view', 'reports.export',
                'notifications.view',
            ],
        ],
        'viewer' => [
            'display_name' => 'Viewer',
            'description' => 'Read-only access across all modules.',
            'is_system' => true,
            'permissions' => [
                'dashboard.view',
                'products.view',
                'categories.view',
                'brands.view',
                'units.view',
                'warehouses.view',
                'locations.view',
                'stock.view',
                'stock-movements.view',
                'adjustments.view',
                'transfers.view',
                'suppliers.view',
                'purchase-orders.view',
                'customers.view',
                'sales-orders.view',
                'picking.view',
                'packing.view',
                'shipping.view',
                'reports.view',
                'users.view',
                'roles.view',
                'audit-logs.view',
                'notifications.view',
                'settings.view',
            ],
        ],
    ];

    public function run(): void
    {
        $permissionRecords = $this->flattenPermissions();

        foreach ($permissionRecords as $name => $data) {
            Permission::updateOrCreate(
                ['name' => $name],
                [
                    'module' => $data['module'],
                    'description' => $data['description'],
                ]
            );
        }

        $definedNames = array_keys($permissionRecords);

        foreach ($this->roles as $roleName => $config) {
            $role = Role::updateOrCreate(
                ['name' => $roleName],
                [
                    'display_name' => $config['display_name'],
                    'description' => $config['description'],
                    'is_system' => $config['is_system'],
                ]
            );

            $permissionNames = $config['permissions'] === ['*'] ? $definedNames : $config['permissions'];
            $permissionIds = Permission::whereIn('name', $permissionNames)->pluck('id');

            $role->permissions()->sync($permissionIds);
        }
    }

    private function flattenPermissions(): array
    {
        $flat = [];

        foreach ($this->permissions as $module => $items) {
            foreach ($items as $name => $description) {
                $flat[$name] = [
                    'module' => $module,
                    'description' => $description,
                ];
            }
        }

        return $flat;
    }
}