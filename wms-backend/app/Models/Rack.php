<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Rack extends Model
{
    protected $fillable = ['aisle_id', 'code'];

    public function aisle(): BelongsTo
    {
        return $this->belongsTo(Aisle::class);
    }

    public function shelves(): HasMany
    {
        return $this->hasMany(Shelf::class);
    }
}