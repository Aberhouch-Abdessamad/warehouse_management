<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\Category;
use App\Models\Brand;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'sku' => fake()->unique()->numerify('SKU-####'),
            'name' => fake()->unique()->words(3, true),
            'description' => fake()->paragraph(),
            'category_id' => Category::factory(),
            'brand_id' => Brand::factory(),
            'unit_id' => Unit::factory(),
            'cost_price' => fake()->randomFloat(2, 5, 200),
            'selling_price' => fake()->randomFloat(2, 10, 400),
            'tax_rate' => fake()->randomFloat(2, 0, 20),
            'min_stock' => fake()->randomFloat(3, 0, 50),
            'max_stock' => fake()->randomFloat(3, 100, 1000),
            'reorder_level' => fake()->randomFloat(3, 10, 100),
            'weight' => fake()->randomFloat(3, 0.1, 50),
            'has_variants' => false,
            'status' => 'active',
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['status' => 'inactive']);
    }
}