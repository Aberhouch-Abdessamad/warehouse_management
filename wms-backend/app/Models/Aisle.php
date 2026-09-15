<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Aisle extends Model
{
    protected $fillable = ['zone_id', 'code', 'name'];

    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    public function racks(): HasMany
    {
        return $this->hasMany(Rack::class);
    }
}