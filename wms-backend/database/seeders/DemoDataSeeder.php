<?php

namespace Database\Seeders;

use App\Models\Bin;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Customer;
use App\Models\InventoryBalance;
use App\Models\InventoryTransaction;
use App\Models\Product;
use App\Models\Rack;
use App\Models\Shelf;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\Aisle;
use App\Models\Zone;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        // --- Users ---
        $adminRole = Role::where('name', 'super_admin')->first();
        $managerRole = Role::where('name', 'warehouse_manager')->first();
        $staffRole = Role::where('name', 'warehouse_staff')->first();
        $purchasingRole = Role::where('name', 'purchasing_manager')->first();
        $salesRole = Role::where('name', 'sales_manager')->first();

        $admin = User::updateOrCreate(
            ['email' => 'admin@wms.test'],
            [
                'name' => 'System Administrator',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );
        $admin->roles()->sync([$adminRole->id]);

        $manager = User::updateOrCreate(
            ['email' => 'manager@wms.test'],
            [
                'name' => 'Warehouse Manager',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );
        $manager->roles()->sync([$managerRole->id]);

        $staff = User::updateOrCreate(
            ['email' => 'staff@wms.test'],
            [
                'name' => 'Warehouse Staff',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );
        $staff->roles()->sync([$staffRole->id]);

        $buyer = User::updateOrCreate(
            ['email' => 'purchasing@wms.test'],
            [
                'name' => 'Purchasing Manager',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );
        $buyer->roles()->sync([$purchasingRole->id]);

        $seller = User::updateOrCreate(
            ['email' => 'sales@wms.test'],
            [
                'name' => 'Sales Manager',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );
        $seller->roles()->sync([$salesRole->id]);

        // --- Warehouses ---
        $warehouseA = Warehouse::updateOrCreate(
            ['code' => 'WH-001'],
            [
                'name' => 'Central Distribution Center',
                'address' => '100 Industrial Parkway',
                'city' => 'Chicago',
                'country' => 'USA',
                'phone' => '+1-312-555-0100',
                'email' => 'central@wms.test',
                'is_active' => true,
            ]
        );

        $warehouseB = Warehouse::updateOrCreate(
            ['code' => 'WH-002'],
            [
                'name' => 'West Coast Fulfillment Hub',
                'address' => '250 Harbor Blvd',
                'city' => 'Los Angeles',
                'country' => 'USA',
                'phone' => '+1-213-555-0200',
                'email' => 'west@wms.test',
                'is_active' => true,
            ]
        );

        // Attach admin + manager to both warehouses
        $admin->warehouses()->sync([$warehouseA->id, $warehouseB->id]);
        $manager->warehouses()->sync([$warehouseA->id, $warehouseB->id]);
        $staff->warehouses()->sync([$warehouseA->id]);
        $buyer->warehouses()->sync([$warehouseA->id]);
        $seller->warehouses()->sync([$warehouseA->id]);

        // --- Location hierarchy: 2 zones -> 1 aisle each -> 1 rack -> 1 shelf -> 3 bins ---
        $bins = [];
        foreach ([$warehouseA, $warehouseB] as $wh) {
            foreach (['ZN-A' => 'Pick Zone', 'ZN-B' => 'Bulk Storage'] as $zoneCode => $zoneName) {
                $zone = Zone::firstOrCreate(
                    ['warehouse_id' => $wh->id, 'code' => $zoneCode],
                    ['name' => $zoneName]
                );
                $aisle = Aisle::firstOrCreate(
                    ['zone_id' => $zone->id, 'code' => 'A-01'],
                    ['name' => 'Aisle 1']
                );
                $rack = Rack::firstOrCreate(
                    ['aisle_id' => $aisle->id, 'code' => 'R-01']
                );
                $shelf = Shelf::firstOrCreate(
                    ['rack_id' => $rack->id, 'code' => 'S-01']
                );
                foreach (['B-01', 'B-02', 'B-03'] as $binCode) {
                    $bin = Bin::firstOrCreate(
                        ['shelf_id' => $shelf->id, 'code' => $binCode],
                        ['type' => 'pickable', 'is_active' => true]
                    );
                    $bins[$wh->code][] = $bin;
                }
            }
        }

        // --- Master data ---
        $unitPcs = Unit::firstOrCreate(['code' => 'PCS'], ['name' => 'Pieces']);
        $unitBox = Unit::firstOrCreate(['code' => 'BOX'], ['name' => 'Box']);
        $unitKg = Unit::firstOrCreate(['code' => 'KG'], ['name' => 'Kilogram']);

        $catElectronics = Category::firstOrCreate(['code' => 'ELEC'], ['name' => 'Electronics']);
        $catOffice = Category::firstOrCreate(['code' => 'OFFC'], ['name' => 'Office Supplies']);
        $catTools = Category::firstOrCreate(['code' => 'TOOL'], ['name' => 'Tools & Hardware']);

        $brandTech = Brand::firstOrCreate(['name' => 'TechPro']);
        $brandOffice = Brand::firstOrCreate(['name' => 'OfficeMax']);
        $brandBuild = Brand::firstOrCreate(['name' => 'BuildCo']);

        $products = [
            ['sku' => 'SKU-1001', 'name' => 'Wireless Mouse Pro', 'category_id' => $catElectronics->id, 'brand_id' => $brandTech->id, 'unit_id' => $unitPcs->id, 'cost_price' => 12.50, 'selling_price' => 24.99, 'tax_rate' => 8.00, 'min_stock' => 10, 'max_stock' => 500, 'reorder_level' => 20, 'weight' => 0.15],
            ['sku' => 'SKU-1002', 'name' => 'Mechanical Keyboard X1', 'category_id' => $catElectronics->id, 'brand_id' => $brandTech->id, 'unit_id' => $unitPcs->id, 'cost_price' => 45.00, 'selling_price' => 89.99, 'tax_rate' => 8.00, 'min_stock' => 5, 'max_stock' => 300, 'reorder_level' => 15, 'weight' => 0.90],
            ['sku' => 'SKU-1003', 'name' => 'USB-C Hub 7-in-1', 'category_id' => $catElectronics->id, 'brand_id' => $brandTech->id, 'unit_id' => $unitPcs->id, 'cost_price' => 18.00, 'selling_price' => 39.99, 'tax_rate' => 8.00, 'min_stock' => 15, 'max_stock' => 400, 'reorder_level' => 30, 'weight' => 0.12],
            ['sku' => 'SKU-1004', 'name' => 'A4 Copy Paper (500 sheets)', 'category_id' => $catOffice->id, 'brand_id' => $brandOffice->id, 'unit_id' => $unitBox->id, 'cost_price' => 4.20, 'selling_price' => 7.99, 'tax_rate' => 5.00, 'min_stock' => 50, 'max_stock' => 2000, 'reorder_level' => 100, 'weight' => 2.50],
            ['sku' => 'SKU-1005', 'name' => 'Gel Pen Blue (12-pack)', 'category_id' => $catOffice->id, 'brand_id' => $brandOffice->id, 'unit_id' => $unitBox->id, 'cost_price' => 2.10, 'selling_price' => 4.99, 'tax_rate' => 5.00, 'min_stock' => 40, 'max_stock' => 1500, 'reorder_level' => 80, 'weight' => 0.30],
            ['sku' => 'SKU-1006', 'name' => 'Cordless Drill 18V', 'category_id' => $catTools->id, 'brand_id' => $brandBuild->id, 'unit_id' => $unitPcs->id, 'cost_price' => 78.00, 'selling_price' => 149.99, 'tax_rate' => 8.00, 'min_stock' => 5, 'max_stock' => 150, 'reorder_level' => 10, 'weight' => 1.80],
            ['sku' => 'SKU-1007', 'name' => 'Screwdriver Set (24 pc)', 'category_id' => $catTools->id, 'brand_id' => $brandBuild->id, 'unit_id' => $unitBox->id, 'cost_price' => 15.00, 'selling_price' => 29.99, 'tax_rate' => 8.00, 'min_stock' => 10, 'max_stock' => 400, 'reorder_level' => 25, 'weight' => 0.75],
            ['sku' => 'SKU-1008', 'name' => 'Safety Gloves (pair)', 'category_id' => $catTools->id, 'brand_id' => $brandBuild->id, 'unit_id' => $unitPcs->id, 'cost_price' => 3.40, 'selling_price' => 8.99, 'tax_rate' => 5.00, 'min_stock' => 100, 'max_stock' => 5000, 'reorder_level' => 200, 'weight' => 0.10],
        ];

        $productModels = [];
        foreach ($products as $p) {
            $productModels[] = Product::updateOrCreate(
                ['sku' => $p['sku']],
                $p + ['description' => $p['name'] . ' - high quality warehouse stock item.', 'status' => 'active']
            );
        }

        // --- Initial inventory levels for warehouses A and B (warehouse-level balances) ---
        $warehouseIds = [
            'WH-001' => $warehouseA->id,
            'WH-002' => $warehouseB->id,
        ];
        $stockLevels = [
            // product ids order matches demo data product seeding order
            $warehouseA->id => [350, 120, 200, 800, 600, 45, 150, 900],
            $warehouseB->id => [180, 60, 90, 400, 350, 25, 80, 500],
        ];

        $user = $admin;
        foreach ($warehouseIds as $code => $whId) {
            foreach ($stockLevels[$whId] as $i => $qty) {
                $product = $productModels[$i];
                InventoryBalance::updateOrCreate(
                    [
                        'product_id' => $product->id,
                        'product_variant_id' => null,
                        'warehouse_id' => $whId,
                        'bin_id' => null, // Allow null for warehouse-level
                    ],
                    [
                        'quantity_on_hand' => $qty,
                        'quantity_reserved' => 0,
                        'quantity_damaged' => 0,
                        'quantity_incoming' => 0,
                    ]
                );
                // Seed stock movement for the balance creation
                InventoryTransaction::create([
                    'product_id' => $product->id,
                    'product_variant_id' => null,
                    'warehouse_id' => $whId,
                    'bin_id' => null,
                    'movement_type' => 'stock_in',
                    'quantity' => $qty,
                    'reference_type' => 'seed',
                    'reference_id' => null,
                    'user_id' => $user->id,
                    'reason' => 'Initial seed stock',
                    'meta' => null,
                    'created_at' => now(),
                ]);
            }
        }

        // --- Suppliers ---
        $supplierData = [
            ['name' => 'TechGlobal Supplies Inc.', 'code' => 'SUP-001'],
            ['name' => 'OfficeWorld Distribution', 'code' => 'SUP-002'],
            ['name' => 'BuildRight Tools LLC', 'code' => 'SUP-003'],
        ];
        $suppliers = [];
        foreach ($supplierData as $s) {
            $suppliers[] = Supplier::updateOrCreate(
                ['code' => $s['code']],
                [
                    'name' => $s['name'],
                    'tax_id' => 'TAX-123456',
                    'contact_name' => 'John Supplier',
                    'email' => strtolower(str_replace(' ', '', $s['name'])) . '@supplier.test',
                    'phone' => '+1-555-0100',
                    'address' => '500 Supplier Ave, Chicago, USA',
                    'is_active' => true,
                ]
            );
        }

        // --- Customers ---
        $customerData = [
            ['name' => 'Acme Retail Group', 'code' => 'CUS-001'],
            ['name' => 'Metro Office Solutions', 'code' => 'CUS-002'],
            ['name' => 'HomeFix Hardware Store', 'code' => 'CUS-003'],
        ];
        foreach ($customerData as $c) {
            Customer::updateOrCreate(
                ['code' => $c['code']],
                [
                    'name' => $c['name'],
                    'tax_id' => 'TAX-987654',
                    'contact_name' => 'Jane Customer',
                    'email' => strtolower(str_replace(' ', '', $c['name'])) . '@customer.test',
                    'phone' => '+1-555-0200',
                    'address' => '900 Customer St, Los Angeles, USA',
                    'is_active' => true,
                ]
            );
        }

        $this->command->info('Demo data seeded: 5 users, 2 warehouses, location hierarchies, 8 products, inventory, 3 suppliers, 3 customers.');
    }
}