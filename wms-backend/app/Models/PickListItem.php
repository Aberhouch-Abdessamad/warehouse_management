<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PickListItem extends Model
{
    protected $fillable = [
        'pick_list_id', 'product_id', 'product_variant_id', 'bin_id',
        'required_quantity', 'picked_quantity', 'status',
    ];

    protected $casts = [
        'required_quantity' => 'decimal:3',
        'picked_quantity' => 'decimal:3',
    ];

    public function pickList(): BelongsTo
    {
        return $this->belongsTo(PickList::class);
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