<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryTransaction extends Model
{
    protected $table = 'inventory_transactions';

    public $timestamps = false;

    protected $fillable = [
        'product_id',
        'product_variant_id',
        'warehouse_id',
        'bin_id',
        'movement_type',
        'quantity',
        'reference_type',
        'reference_id',
        'user_id',
        'reason',
        'meta',
        'created_at',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'meta' => 'json',
        'created_at' => 'datetime',
    ];

    public static array $movementTypes = [
        'stock_in',
        'stock_out',
        'transfer_in',
        'transfer_out',
        'adjustment',
        'return',
        'return_damaged',
        'damage',
        'reservation',
        'reservation_release',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function bin(): BelongsTo
    {
        return $this->belongsTo(Bin::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}