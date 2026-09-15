<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Backorder extends Model
{
    protected $fillable = [
        'code', 'product_id', 'quantity', 'requested_by_id',
        'warehouse_id', 'status', 'reason', 'created_at', 'resolved_at',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_id');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function backorderItems(): HasMany
    {
        return $this->hasMany(BackorderItem::class);
    }
}