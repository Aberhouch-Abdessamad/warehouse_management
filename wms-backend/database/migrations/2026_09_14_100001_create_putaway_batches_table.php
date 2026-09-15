<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('putaway_batches', function (Blueprint $table) {
            $table->id();
            $table->string('number', 40)->unique();
            $table->foreignId('goods_receipt_id')->nullable()->constrained('goods_receipts')->nullOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 20)->default('pending')->index();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('putaway_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('putaway_batch_id')->constrained('putaway_batches')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->cascadeOnDelete();
            $table->foreignId('source_bin_id')->nullable()->constrained('bins')->nullOnDelete();
            $table->foreignId('destination_bin_id')->nullable()->constrained('bins')->nullOnDelete();
            $table->decimal('quantity', 14, 3);
            $table->decimal('putaway_quantity', 14, 3)->default(0);
            $table->string('status', 20)->default('pending');
            $table->timestamp('putaway_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('putaway_items');
        Schema::dropIfExists('putaway_batches');
    }
};