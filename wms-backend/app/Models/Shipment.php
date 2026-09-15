<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shipment extends Model
{
    protected $fillable = [
        'number', 'sales_order_id', 'warehouse_id', 'status',
        'carrier', 'tracking_number', 'scheduled_shipping_date',
        'shipped_at', 'delivery_details',
    ];

    protected $casts = [
        'scheduled_shipping_date' => 'date',
        'shipped_at' => 'datetime',
        'delivery_details' => 'json',
    ];

    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(ShipmentItem::class);
    }
}