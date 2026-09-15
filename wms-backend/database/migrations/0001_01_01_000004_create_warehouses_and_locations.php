<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warehouses', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name');
            $table->string('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('country', 100)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('allow_self_transfer')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('zones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->string('code', 20);
            $table->string('name');
            $table->string('description')->nullable();
            $table->timestamps();

            $table->unique(['warehouse_id', 'code']);
        });

        Schema::create('user_warehouse', function (Blueprint $table) {
            $table->primary(['warehouse_id', 'user_id']);
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
        });

        Schema::create('aisles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_id')->constrained()->cascadeOnDelete();
            $table->string('code', 20);
            $table->string('name');
            $table->timestamps();

            $table->unique(['zone_id', 'code']);
        });

        Schema::create('racks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('aisle_id')->constrained()->cascadeOnDelete();
            $table->string('code', 20);
            $table->timestamps();

            $table->unique(['aisle_id', 'code']);
        });

        Schema::create('shelves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rack_id')->constrained()->cascadeOnDelete();
            $table->string('code', 20);
            $table->timestamps();

            $table->unique(['rack_id', 'code']);
        });

        Schema::create('bins', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shelf_id')->constrained()->cascadeOnDelete();
            $table->string('code', 20);
            $table->string('label')->nullable();
            $table->string('type', 20)->default('pickable');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['shelf_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bins');
        Schema::dropIfExists('shelves');
        Schema::dropIfExists('racks');
        Schema::dropIfExists('aisles');
        Schema::dropIfExists('zones');
        Schema::dropIfExists('warehouses');
    }
};