<?php

namespace Database\Factories;

use App\Models\Bin;
use Illuminate\Database\Eloquent\Factories\Factory;

class BinFactory extends Factory
{
    protected $model = Bin::class;

    public function definition(): array
    {
        return [
            'shelf_id' => \App\Models\Shelf::factory(),
            'code' => strtoupper(fake()->bothify('BIN-###')),
            'label' => fake()->word(),
            'type' => 'pickable',
            'is_active' => true,
        ];
    }
}