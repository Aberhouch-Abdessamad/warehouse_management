<?php

namespace Database\Seeders;

use App\Models\Aisle;
use App\Models\Bin;
use App\Models\InventoryBalance;
use App\Models\Product;
use App\Models\Rack;
use App\Models\Shelf;
use App\Models\Warehouse;
use App\Models\Zone;
use Illuminate\Database\Seeder;

class InventoryBalanceSeeder extends Seeder
{
    /**
     * Seed warehouse location hierarchy and opening inventory balances
     * for the products created by ProductSeeder.
     */
    public function run(): void
    {
        $warehouse = Warehouse::where('code', 'WH-MAIN')->first();

        if (! $warehouse) {
            $warehouse = Warehouse::create([
                'code' => 'WH-MAIN',
                'name' => 'Main Distribution Center',
                'address' => '1 Logistics Park Drive',
                'city' => 'Springfield',
                'country' => 'United States',
                'phone' => '+1-555-888-2000',
                'email' => 'ops@wms.com',
                'is_active' => true,
                'allow_self_transfer' => true,
            ]);

            $this->createBins($warehouse);
        }

        $bins = $warehouse->bins ?? $this->collectBins($warehouse);

        if ($bins->count() === 0) {
            $bins = collect($this->createBins($warehouse));
        }

        $binList = $bins->shuffle();
        $products = Product::where('status', 'active')->get();

        foreach ($products as $product) {
            // Distribute across up to 3 bins for a realistic layout.
            $assignedBins = $binList->random(min(3, $binList->count()));

            $totalOnHand = (int) ($product->reorder_level + $product->min_stock + ($product->max_stock - $product->min_stock) * 0.4);
            $reserved = (int) round($totalOnHand * 0.08);
            $damaged = (int) round($totalOnHand * 0.02);
            $incoming = (int) round($totalOnHand * 0.15);

            $remaining = $totalOnHand;
            $count = $assignedBins->count();

            foreach ($assignedBins as $i => $bin) {
                // Give the last bin the remainder so quantities tie out.
                $quantity = ($i === $count - 1) ? $remaining : (int) floor($totalOnHand / $count);

                InventoryBalance::updateOrCreate(
                    [
                        'product_id' => $product->id,
                        'product_variant_id' => null,
                        'warehouse_id' => $warehouse->id,
                        'bin_id' => $bin->id,
                    ],
                    [
                        'quantity_on_hand' => $quantity,
                        'quantity_reserved' => ($i === 0) ? $reserved : 0,
                        'quantity_damaged' => ($i === 1) ? $damaged : 0,
                        'quantity_incoming' => ($i === 2) ? $incoming : 0,
                    ]
                );

                $remaining -= $quantity;
            }
        }

        $this->command->info('Seeded inventory balances for '.$products->count().' products across '.$bins->count().' bins.');
    }

    private function createBins(Warehouse $warehouse): array
    {
        $zone = Zone::firstOrCreate(
            ['warehouse_id' => $warehouse->id, 'code' => 'ZN-A'],
            ['name' => 'Storage Zone A']
        );

        $bins = [];
        $aisleCodes = ['AA', 'AB', 'BA', 'BB'];

        foreach ($aisleCodes as $i => $aisleCode) {
            $aisle = Aisle::firstOrCreate(
                ['zone_id' => $zone->id, 'code' => $aisleCode],
                ['name' => "Aisle {$aisleCode}"]
            );

            $rack = Rack::firstOrCreate(
                ['aisle_id' => $aisle->id, 'code' => $aisleCode.'-R1'],
                []
            );

            $shelf = Shelf::firstOrCreate(
                ['rack_id' => $rack->id, 'code' => $aisleCode.'-S1'],
                []
            );

            for ($pos = 1; $pos <= 2; $pos++) {
                $code = $aisleCode.'-'.$pos;

                $bins[] = Bin::firstOrCreate(
                    ['shelf_id' => $shelf->id, 'code' => $code],
                    [
                        'label' => "Storage bin {$code}",
                        'type' => $i % 2 === 0 ? 'pickable' : 'bulk',
                        'is_active' => true,
                    ]
                );
            }
        }

        return $bins;
    }

    private function collectBins(Warehouse $warehouse): \Illuminate\Support\Collection
    {
        $zoneIds = Zone::where('warehouse_id', $warehouse->id)->pluck('id');
        $aisleIds = Aisle::whereIn('zone_id', $zoneIds)->pluck('id');
        $rackIds = Rack::whereIn('aisle_id', $aisleIds)->pluck('id');
        $shelfIds = Shelf::whereIn('rack_id', $rackIds)->pluck('id');

        return Bin::whereIn('shelf_id', $shelfIds)->get();
    }
}