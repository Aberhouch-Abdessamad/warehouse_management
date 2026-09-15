<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    /**
     * Seed master data (categories, brands, units) and a realistic
     * catalog of products.
     */
    public function run(): void
    {
        $units = collect([
            ['name' => 'Piece', 'code' => 'PC'],
            ['name' => 'Box', 'code' => 'BOX'],
            ['name' => 'Set', 'code' => 'SET'],
            ['name' => 'Pair', 'code' => 'PAIR'],
            ['name' => 'Ream', 'code' => 'REAM'],
            ['name' => 'Kilogram', 'code' => 'KG'],
            ['name' => 'Gram', 'code' => 'G'],
            ['name' => 'Liter', 'code' => 'L'],
            ['name' => 'Meter', 'code' => 'M'],
            ['name' => 'Pallet', 'code' => 'PLT'],
        ])->mapWithKeys(function (array $unit) {
            $record = Unit::updateOrCreate(
                ['code' => $unit['code']],
                ['name' => $unit['name']]
            );

            return [$unit['code'] => $record->id];
        });

        $brands = collect([
            'Acme Industrial',
            'NorthPeak Supplies',
            'EverFlow Logistics',
            'BrightWorks',
            'TitanPack',
        ])->mapWithKeys(function (string $name) {
            $record = Brand::updateOrCreate(
                ['name' => $name],
                ['description' => "{$name} branded goods.", 'is_active' => true]
            );

            return [$name => $record->id];
        });

        $categories = collect([
            ['name' => 'Electronics', 'code' => 'ELEC', 'children' => [
                ['name' => 'Cables & Adapters', 'code' => 'ELEC-CBL'],
                ['name' => 'Power Supplies', 'code' => 'ELEC-PWR'],
            ]],
            ['name' => 'Tools & Hardware', 'code' => 'TOOL', 'children' => [
                ['name' => 'Hand Tools', 'code' => 'TOOL-HND'],
                ['name' => 'Power Tools', 'code' => 'TOOL-PWR'],
            ]],
            ['name' => 'Packaging', 'code' => 'PACK', 'children' => [
                ['name' => 'Cartons', 'code' => 'PACK-CRT'],
                ['name' => 'Tapes & Labels', 'code' => 'PACK-TPE'],
            ]],
            ['name' => 'Safety Equipment', 'code' => 'SAFE', 'children' => []],
            ['name' => 'Office Supplies', 'code' => 'OFFC', 'children' => []],
        ])->mapWithKeys(function (array $category) use ($brands) {
            $parent = Category::updateOrCreate(
                ['code' => $category['code']],
                [
                    'parent_id' => null,
                    'name' => $category['name'],
                    'description' => "{$category['name']} products.",
                    'is_active' => true,
                ]
            );

            foreach ($category['children'] as $child) {
                Category::updateOrCreate(
                    ['code' => $child['code']],
                    [
                        'parent_id' => $parent->id,
                        'name' => $child['name'],
                        'description' => "{$child['name']} products.",
                        'is_active' => true,
                    ]
                );
            }

            return [$category['code'] => $parent->id];
        });

        $allCategories = Category::pluck('id', 'code');

        $products = [
            ['sku' => 'SKU-1001', 'name' => 'USB-C to USB-A Cable 2m', 'category' => 'ELEC-CBL', 'brand' => 'Acme Industrial', 'unit' => 'PC', 'cost' => 3.20, 'price' => 9.99, 'tax' => 10.00, 'min' => 50, 'max' => 500, 'reorder' => 100, 'weight' => 0.085],
            ['sku' => 'SKU-1002', 'name' => 'HDMI 2.1 Cable 3m', 'category' => 'ELEC-CBL', 'brand' => 'Acme Industrial', 'unit' => 'PC', 'cost' => 6.50, 'price' => 19.99, 'tax' => 10.00, 'min' => 30, 'max' => 300, 'reorder' => 75, 'weight' => 0.210],
            ['sku' => 'SKU-1003', 'name' => '65W USB-C Power Adapter', 'category' => 'ELEC-PWR', 'brand' => 'BrightWorks', 'unit' => 'PC', 'cost' => 12.00, 'price' => 34.99, 'tax' => 10.00, 'min' => 20, 'max' => 200, 'reorder' => 50, 'weight' => 0.180],
            ['sku' => 'SKU-1004', 'name' => 'AA Alkaline Batteries (24-pack)', 'category' => 'ELEC-PWR', 'brand' => 'BrightWorks', 'unit' => 'BOX', 'cost' => 8.75, 'price' => 22.50, 'tax' => 10.00, 'min' => 25, 'max' => 250, 'reorder' => 60, 'weight' => 0.620],
            ['sku' => 'SKU-1005', 'name' => 'Cordless Drill 18V', 'category' => 'TOOL-PWR', 'brand' => 'TitanPack', 'unit' => 'PC', 'cost' => 68.00, 'price' => 149.99, 'tax' => 15.00, 'min' => 5, 'max' => 60, 'reorder' => 15, 'weight' => 1.850],
            ['sku' => 'SKU-1006', 'name' => 'Screwdriver Set (12 pieces)', 'category' => 'TOOL-HND', 'brand' => 'TitanPack', 'unit' => 'SET', 'cost' => 14.25, 'price' => 39.99, 'tax' => 15.00, 'min' => 10, 'max' => 100, 'reorder' => 25, 'weight' => 0.740],
            ['sku' => 'SKU-1007', 'name' => 'Adjustable Wrench 250mm', 'category' => 'TOOL-HND', 'brand' => 'NorthPeak Supplies', 'unit' => 'PC', 'cost' => 7.80, 'price' => 18.50, 'tax' => 15.00, 'min' => 15, 'max' => 150, 'reorder' => 40, 'weight' => 0.410],
            ['sku' => 'SKU-1008', 'name' => 'Claw Hammer 450g', 'category' => 'TOOL-HND', 'brand' => 'NorthPeak Supplies', 'unit' => 'PC', 'cost' => 6.10, 'price' => 15.99, 'tax' => 15.00, 'min' => 15, 'max' => 150, 'reorder' => 40, 'weight' => 0.520],
            ['sku' => 'SKU-1009', 'name' => 'Cardboard Carton 400x300x300mm', 'category' => 'PACK-CRT', 'brand' => 'EverFlow Logistics', 'unit' => 'PC', 'cost' => 0.65, 'price' => 1.85, 'tax' => 5.00, 'min' => 200, 'max' => 2000, 'reorder' => 500, 'weight' => 0.320],
            ['sku' => 'SKU-1010', 'name' => 'Bubble Wrap Roll 50m', 'category' => 'PACK-CRT', 'brand' => 'EverFlow Logistics', 'unit' => 'PC', 'cost' => 9.40, 'price' => 24.99, 'tax' => 5.00, 'min' => 20, 'max' => 200, 'reorder' => 50, 'weight' => 1.100],
            ['sku' => 'SKU-1011', 'name' => 'Packing Tape 48mm x 100m', 'category' => 'PACK-TPE', 'brand' => 'EverFlow Logistics', 'unit' => 'PC', 'cost' => 1.10, 'price' => 3.50, 'tax' => 5.00, 'min' => 100, 'max' => 1000, 'reorder' => 250, 'weight' => 0.150],
            ['sku' => 'SKU-1012', 'name' => 'Shipping Label 100x150mm (500 roll)', 'category' => 'PACK-TPE', 'brand' => 'EverFlow Logistics', 'unit' => 'PC', 'cost' => 4.20, 'price' => 12.99, 'tax' => 5.00, 'min' => 30, 'max' => 300, 'reorder' => 80, 'weight' => 0.580],
            ['sku' => 'SKU-1013', 'name' => 'Safety Helmet ANSI Type I', 'category' => 'SAFE', 'brand' => 'TitanPack', 'unit' => 'PC', 'cost' => 11.50, 'price' => 29.99, 'tax' => 10.00, 'min' => 20, 'max' => 200, 'reorder' => 50, 'weight' => 0.390],
            ['sku' => 'SKU-1014', 'name' => 'Cut-Resistant Gloves Level 5', 'category' => 'SAFE', 'brand' => 'TitanPack', 'unit' => 'PAIR', 'cost' => 4.30, 'price' => 12.50, 'tax' => 10.00, 'min' => 40, 'max' => 400, 'reorder' => 100, 'weight' => 0.120],
            ['sku' => 'SKU-1015', 'name' => 'Safety Goggles Anti-Fog', 'category' => 'SAFE', 'brand' => 'NorthPeak Supplies', 'unit' => 'PC', 'cost' => 3.10, 'price' => 9.99, 'tax' => 10.00, 'min' => 30, 'max' => 300, 'reorder' => 75, 'weight' => 0.095],
            ['sku' => 'SKU-1016', 'name' => 'A4 Copy Paper 80gsm (500 sheets)', 'category' => 'OFFC', 'brand' => 'BrightWorks', 'unit' => 'REAM', 'cost' => 3.90, 'price' => 8.99, 'tax' => 5.00, 'min' => 50, 'max' => 500, 'reorder' => 120, 'weight' => 2.500],
            ['sku' => 'SKU-1017', 'name' => 'Permanent Markers Black (12-pack)', 'category' => 'OFFC', 'brand' => 'BrightWorks', 'unit' => 'BOX', 'cost' => 5.60, 'price' => 14.99, 'tax' => 5.00, 'min' => 20, 'max' => 200, 'reorder' => 50, 'weight' => 0.240],
            ['sku' => 'SKU-1018', 'name' => 'Warehouse Trolley 150kg', 'category' => 'TOOL', 'brand' => 'Acme Industrial', 'unit' => 'PC', 'cost' => 85.00, 'price' => 199.99, 'tax' => 15.00, 'min' => 3, 'max' => 30, 'reorder' => 10, 'weight' => 12.400],
        ];

        foreach ($products as $item) {
            Product::updateOrCreate(
                ['sku' => $item['sku']],
                [
                    'name' => $item['name'],
                    'description' => "{$item['name']} supplied by {$item['brand']}.",
                    'category_id' => $allCategories[$item['category']] ?? null,
                    'brand_id' => $brands[$item['brand']] ?? null,
                    'unit_id' => $units[$item['unit']] ?? null,
                    'cost_price' => $item['cost'],
                    'selling_price' => $item['price'],
                    'tax_rate' => $item['tax'],
                    'min_stock' => $item['min'],
                    'max_stock' => $item['max'],
                    'reorder_level' => $item['reorder'],
                    'weight' => $item['weight'],
                    'has_variants' => false,
                    'status' => 'active',
                ]
            );
        }

        $this->command->info('Seeded '.count($products).' products with categories, brands and units.');
    }
}