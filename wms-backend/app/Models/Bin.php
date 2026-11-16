<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Bin extends Model
{
    use SoftDeletes;

    protected $fillable = ['shelf_id', 'code', 'label', 'type', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function shelf(): BelongsTo
    {
        return $this->belongsTo(Shelf::class);
    }

    public function inventoryBalances(): HasMany
    {
        return $this->hasMany(InventoryBalance::class);
    }

    /** e.g. "ZN-A / A-01 / R-01 / S-01 / B-01" (requires shelf.rack.aisle.zone) */
    public function getFullCodeAttribute(): string
    {
        $shelf = $this->shelf;
        $rack = $shelf?->rack;
        $aisle = $rack?->aisle;
        $zone = $aisle?->zone;

        return collect([$zone?->code, $aisle?->code, $rack?->code, $shelf?->code, $this->code])->filter()->implode(' / ');
    }
}
