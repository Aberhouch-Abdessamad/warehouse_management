<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PutawayItem extends Model
{
    protected $fillable = [
        'putaway_batch_id', 'product_id', 'product_variant_id',
        'source_bin_id', 'destination_bin_id', 'quantity',
        'putaway_quantity', 'status', 'putaway_at',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'putaway_quantity' => 'decimal:3',
        'putaway_at' => 'datetime',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(PutawayBatch::class, 'putaway_batch_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function sourceBin(): BelongsTo
    {
        return $this->belongsTo(Bin::class, 'source_bin_id');
    }

    public function destinationBin(): BelongsTo
    {
        return $this->belongsTo(Bin::class, 'destination_bin_id');
    }
}