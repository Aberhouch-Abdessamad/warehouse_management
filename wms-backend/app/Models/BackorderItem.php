<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BackorderItem extends Model
{
    protected $fillable = [
        'backorder_id', 'product_id', 'product_variant_id',
        'bin_id', 'quantity', 'status', 'reason',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
    ];

    public function backorder(): BelongsTo
    {
        return $this->belongsTo(Backorder::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function bin(): BelongsTo
    {
        return $this->belongsTo(Bin::class);
    }
}