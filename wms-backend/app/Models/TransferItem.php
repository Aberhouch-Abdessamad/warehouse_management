<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TransferItem extends Model
{
    protected $fillable = [
        'transfer_id', 'product_id', 'product_variant_id',
        'quantity', 'status', 'picked_quantity', 'received_quantity',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'picked_quantity' => 'decimal:3',
        'received_quantity' => 'decimal:3',
    ];

    public function transfer(): BelongsTo
    {
        return $this->belongsTo(Transfer::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}