<?php

namespace Database\Factories;

use App\Models\InventoryTransaction;
use App\Models\Product;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Factories\Factory;

class InventoryTransactionFactory extends Factory
{
    protected $model = InventoryTransaction::class;

    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'warehouse_id' => Warehouse::factory(),
            'movement_type' => fake()->randomElement(['stock_in', 'stock_out', 'adjustment', 'return', 'damage']),
            'quantity' => fake()->randomFloat(3, 1, 100),
            'created_at' => now(),
        ];
    }
}