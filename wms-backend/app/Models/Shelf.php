<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shelf extends Model
{
    protected $fillable = ['rack_id', 'code'];

    public function rack(): BelongsTo
    {
        return $this->belongsTo(Rack::class);
    }

    public function bins(): HasMany
    {
        return $this->hasMany(Bin::class);
    }
}