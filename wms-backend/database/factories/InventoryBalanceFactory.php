<?php

namespace Database\Factories;

use App\Models\InventoryBalance;
use App\Models\Product;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Factories\Factory;

class InventoryBalanceFactory extends Factory
{
    protected $model = InventoryBalance::class;

    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'warehouse_id' => Warehouse::factory(),
            'quantity_on_hand' => fake()->numberBetween(0, 500),
            'quantity_reserved' => 0,
            'quantity_damaged' => 0,
            'quantity_incoming' => 0,
        ];
    }
}