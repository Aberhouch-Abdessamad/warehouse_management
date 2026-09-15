<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Package extends Model
{
    protected $fillable = [
        'number', 'sales_order_id', 'pick_list_id', 'warehouse_id',
        'status', 'weight', 'width', 'height', 'length', 'packed_by',
    ];

    protected $casts = [
        'weight' => 'decimal:3',
        'width' => 'decimal:3',
        'height' => 'decimal:3',
        'length' => 'decimal:3',
    ];

    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class);
    }

    public function pickList(): BelongsTo
    {
        return $this->belongsTo(PickList::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function packedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'packed_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PackageItem::class);
    }
}