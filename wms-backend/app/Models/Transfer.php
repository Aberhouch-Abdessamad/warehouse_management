<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Transfer extends Model
{
    protected $fillable = [
        'number',
        'source_warehouse_id',
        'destination_warehouse_id',
        'requester_id',
        'approver_id',
        'received_by_id',
        'status',
        'type',
        'transfer_date',
        'picking_started_at',
        'shipped_at',
        'received_at',
        'completed_at',
        'notes',
    ];

    protected $casts = [
        'transfer_date' => 'date',
        'picking_started_at' => 'datetime',
        'shipped_at' => 'datetime',
        'received_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function sourceWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
    }

    public function destinationWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'destination_warehouse_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(TransferItem::class);
    }

    public function isActionable(): bool
    {
        return in_array($this->status, ['draft', 'requested', 'approved', 'picking', 'in_transit'], true);
    }
}