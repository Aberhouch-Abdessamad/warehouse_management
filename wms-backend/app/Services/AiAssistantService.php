<?php

namespace App\Services;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Customer;
use App\Models\InventoryBalance;
use App\Models\InventoryTransaction;
use App\Models\PickList;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\SalesOrder;
use App\Models\Supplier;
use App\Models\Transfer;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Talks to an OpenAI-compatible AI endpoint (configured via .env) and grounds every
 * conversation in a live snapshot of the warehouse.
 */
class AiAssistantService
{
    public function isConfigured(): bool
    {
        return config('services.ai.base_url') !== ''
            && ! empty(config('services.ai.api_key'))
            && (string) config('services.ai.model') !== '';
    }

    public function model(): string
    {
        return (string) config('services.ai.model');
    }

    /**
     * @param  array<int, array{role:string, content:mixed}>  $messages
     */
    public function complete(array $messages, ?int $maxTokens = null, float $temperature = 0.3): string
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('The AI assistant is not configured. Set AI_BASE_URL and AI_API_KEY in the backend .env file.');
        }

        $response = Http::withToken((string) config('services.ai.api_key'))
            ->acceptJson()
            ->timeout((int) config('services.ai.timeout', 60))
            ->connectTimeout(10)
            ->post(config('services.ai.base_url') . '/chat/completions', [
                'model' => $this->model(),
                'messages' => $messages,
                'temperature' => $temperature,
                'max_tokens' => $maxTokens ?? (int) config('services.ai.max_tokens', 1200),
                'stream' => false,
            ]);

        if ($response->failed()) {
            $detail = $response->json('error.message') ?? $response->json('message') ?? substr($response->body(), 0, 200);
            throw new RuntimeException("AI service returned HTTP {$response->status()}: {$detail}");
        }

        $content = $response->json('choices.0.message.content');
        if (is_array($content)) { // some servers return content parts
            $content = collect($content)->pluck('text')->filter()->implode("\n");
        }

        // Reasoning models (DeepSeek/GLM style) can spend the whole token
        // budget on thinking and return an empty "content" while the
        // actual answer lives in a reasoning field. Fall back to it.
        if (! is_string($content) || trim($content) === '') {
            $reasoning = $response->json('choices.0.message.reasoning')
                ?? $response->json('choices.0.message.reasoning_content');

            if (is_array($reasoning)) {
                $reasoning = collect($reasoning)->pluck('text')->filter()->implode("\n");
            }

            if (is_string($reasoning) && trim($reasoning) !== '') {
                $content = $reasoning;
            }
        }

        if (! is_string($content) || trim($content) === '') {
            throw new RuntimeException('AI service returned an empty answer.');
        }

        return trim($content);
    }

    /**
     * Create-actions the assistant may draft for this user, gated by permissions.
     * The frontend calls the matching POST endpoint only after the user confirms.
     *
     * @return array<string, string> endpoint => label
     */
    public function allowedActions(User $user): array
    {
        return array_filter([
            'products' => $user->hasAnyPermission(['products.create']) ? 'new product' : null,
            'purchase-orders' => $user->hasAnyPermission(['purchase-orders.create']) ? 'new purchase order' : null,
            'sales-orders' => $user->hasAnyPermission(['sales-orders.create']) ? 'new sales order' : null,
            'adjustments' => $user->hasAnyPermission(['adjustments.create', 'stock.adjust']) ? 'stock adjustment' : null,
            'transfers' => $user->hasAnyPermission(['transfers.create']) ? 'stock transfer' : null,
            'suppliers' => $user->hasAnyPermission(['suppliers.create']) ? 'new supplier' : null,
            'customers' => $user->hasAnyPermission(['customers.create']) ? 'new customer' : null,
        ]);
    }

    /**
     * Operations the assistant may propose on EXISTING records (submit / approve /
     * cancel), gated by the same permissions the routes check (any-of semantics).
     * Endpoint templates are POST paths where {id} is filled with a real record id.
     *
     * @return array<string, string> endpoint template => label
     */
    public function allowedOperations(User $user): array
    {
        return array_filter([
            'purchase-orders/{id}/submit' => $user->hasAnyPermission(['purchase-orders.create', 'purchase-orders.update']) ? 'submit purchase order' : null,
            'purchase-orders/{id}/approve' => $user->hasAnyPermission(['purchase-orders.approve']) ? 'approve purchase order' : null,
            'purchase-orders/{id}/cancel' => $user->hasAnyPermission(['purchase-orders.update', 'purchase-orders.delete']) ? 'cancel purchase order' : null,
            'sales-orders/{id}/confirm' => $user->hasAnyPermission(['sales-orders.confirm']) ? 'confirm sales order (reserves stock)' : null,
            'sales-orders/{id}/cancel' => $user->hasAnyPermission(['sales-orders.cancel']) ? 'cancel sales order' : null,
            'transfers/{id}/submit' => $user->hasAnyPermission(['transfers.create', 'transfers.update']) ? 'submit stock transfer' : null,
            'transfers/{id}/approve' => $user->hasAnyPermission(['transfers.approve']) ? 'approve stock transfer' : null,
        ]);
    }

    /** Status preconditions (mirrors the service guards) shown to the model. */
    private const OPERATION_RULES = [
        'purchase-orders/{id}/submit' => 'status must be "draft"',
        'purchase-orders/{id}/approve' => 'status must be "submitted"',
        'purchase-orders/{id}/cancel' => 'only while not (partially) received',
        'sales-orders/{id}/confirm' => 'status must be "pending"; confirming reserves stock and can fail when stock is short',
        'sales-orders/{id}/cancel' => 'possible until the order has shipped',
        'transfers/{id}/submit' => 'status must be "draft"',
        'transfers/{id}/approve' => 'status must be "requested"',
    ];

    private const ACTION_SCHEMAS = [
        'products' => '"products": {"sku":"...","name":"...","selling_price":0,"cost_price":0,"category_id":0,"unit_id":0,"brand_id":0,"min_stock":0,"reorder_level":0}',
        'purchase-orders' => '"purchase-orders": {"supplier_id":0,"warehouse_id":0,"expected_delivery":"YYYY-MM-DD","notes":"...","items":[{"product_id":0,"quantity":0,"unit_cost":0}]}',
        'sales-orders' => '"sales-orders": {"customer_id":0,"warehouse_id":0,"required_date":"YYYY-MM-DD","notes":"...","items":[{"product_id":0,"quantity":0,"unit_price":0}]}',
        'adjustments' => '"adjustments": {"product_id":0,"warehouse_id":0,"signed_quantity":0,"reason":"..."}',
        'transfers' => '"transfers": {"source_warehouse_id":0,"destination_warehouse_id":0,"transfer_date":"YYYY-MM-DD","notes":"...","items":[{"product_id":0,"quantity":0}]}',
        'suppliers' => '"suppliers": {"code":"...","name":"...","contact_name":"...","phone":"...","email":"..."}',
        'customers' => '"customers": {"code":"...","name":"...","contact_name":"...","phone":"...","email":"..."}',
    ];

    /**
     * Instructions that let the model draft a create-action block, limited to
     * the endpoints the signed-in user is actually allowed to call.
     */
    private function createInstructions(User $user): string
    {
        $allowed = $this->allowedActions($user);

        if (empty($allowed)) {
            return '';
        }

        $endpoints = collect($allowed)
            ->map(fn ($label, $endpoint) => "\"{$endpoint}\" ({$label})")
            ->implode(', ');

        $schemas = collect(array_keys($allowed))
            ->map(fn ($endpoint) => self::ACTION_SCHEMAS[$endpoint] ?? null)
            ->filter()
            ->implode(",\n  ");

        return <<<ACTIONS
- You may PREPARE a new record when the user clearly asks for it. Reply with one short sentence, then exactly ONE fenced block:

```action
{"endpoint": "purchase-orders", "payload": {"supplier_id": 1, "warehouse_id": 1, "items": [{"product_id": 1, "quantity": 50}]}}
```

- Allowed endpoints: {$endpoints}.
- Use ids ONLY from the "references" section of LIVE DATA (warehouse ids come from the "warehouses" section). Never invent an id; if a name cannot be matched, ask the user.
- Payload shape per endpoint:
  {$schemas}
- Nothing is saved until the user presses Confirm on the card, so write "I've prepared…" rather than claiming it is created. Omit unknown optional fields instead of guessing; ask for missing required fields. adjustments: use signed_quantity (negative = write-off, positive = found stock).
- Do not combine a create with a follow-up operation in one reply; if submitting/approving would be the next step, offer it in words (e.g. "I can submit it for approval once you confirm").
ACTIONS;
    }

    /**
     * Instructions that let the model RUN an operation on an existing record
     * (submit / approve / cancel), restricted to what the user may execute.
     */
    private function operationInstructions(User $user): string
    {
        $ops = $this->allowedOperations($user);

        if (empty($ops)) {
            return '';
        }

        $list = collect($ops)
            ->map(fn ($label, $template) => '"endpoint": "' . str_replace('{id}', '<id>', $template) . '" — ' . $label
                . ' (' . self::OPERATION_RULES[$template] . ')')
            ->implode("\n");

        return <<<OPS
- You may also RUN an operation on an EXISTING record when the user clearly asks for it ("submit it", "approve that PO", "cancel this order"). Same reply style: one short sentence, then exactly ONE fenced block whose endpoint contains the record's REAL id from LIVE DATA:

```action
{"endpoint": "purchase-orders/12/approve", "payload": {"id": 12, "number": "PO-2026-0004"}}
```

Allowed operation endpoints (with their preconditions):
  {$list}

- Payload: {"id": <same id>, "number": <its number when known>}; when the user gives a cancellation reason, add "reason". Only operate on ids present in the open_purchase_orders / open_sales_orders / open_transfers lists of LIVE DATA – never guess or reuse an id you were not given. Mention the record's current status; if it does not meet the precondition, explain that instead of preparing the block.
- Nothing runs until the user presses Confirm on the card, so phrase it as "I'll approve/cancel it once you confirm". After confirmation the operation executes immediately.
OPS;
    }

    public function systemPrompt(User $user, Collection $warehouseIds, ?string $page = null): string
    {
        $snapshot = json_encode($this->snapshot($user, $warehouseIds), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        $now = now()->toDayDateTimeString();
        $pageLine = $page ? "The user is currently on the \"{$page}\" screen of the WMS." : '';
        $createInstructions = $this->createInstructions($user);
        $operationInstructions = $this->operationInstructions($user);

        if (trim($createInstructions . $operationInstructions) === '') {
            $createInstructions = '- You cannot change data for this user (no write permissions). Tell them which screen or button to use.';
        }

        return <<<PROMPT
You are "WMS Copilot", the AI operations assistant built into a Warehouse Management System.
You help warehouse managers, inventory controllers, pickers, buyers and sales staff.
Current time: {$now}. User: {$user->name} (roles: {$user->roles()->pluck('display_name')->implode(', ')}).
{$pageLine}

How to answer:
- Be concise, practical and specific. Use short paragraphs or bullet lists, and Markdown tables when comparing items.
- Ground every number in the LIVE DATA below. Never invent SKUs, quantities, order numbers or bins. If data is missing, say so.
- "Available" = on hand minus reserved. Low stock = available at or below the reorder level.
- When recommending actions, reference the WMS module where it is done (Purchase Orders, Transfers, Putaway, Picking, Packing, Shipping, Stock Counts, Returns, Inventory adjustments).
- For reorder suggestions, propose a quantity that brings stock back above the reorder level (use max_stock when known) and explain the reasoning briefly.
- If the user sends a photo (shelf, pallet, label, delivery note, damaged goods), describe what you see and relate it to the WMS data (e.g. match SKUs or product names, flag damage, suggest a return/adjustment).
{$createInstructions}
{$operationInstructions}

LIVE DATA (JSON snapshot):
{$snapshot}
PROMPT;
    }

    /**
     * Compact, permission-aware snapshot of the warehouse state.
     */
    public function snapshot(User $user, Collection $warehouseIds): array
    {
        $data = [
            'warehouses' => Warehouse::whereIn('id', $warehouseIds)->get(['id', 'code', 'name'])->toArray(),
        ];

        if ($user->hasAnyPermission(['stock.view', 'dashboard.view', 'products.view'])) {
            $stock = InventoryBalance::query()
                ->join('products', 'products.id', '=', 'inventory_balances.product_id')
                ->whereIn('inventory_balances.warehouse_id', $warehouseIds)
                ->groupBy('products.id', 'products.sku', 'products.name', 'products.reorder_level', 'products.max_stock', 'products.cost_price')
                ->selectRaw('products.id, products.sku, products.name, products.reorder_level, products.max_stock, products.cost_price,
                    SUM(quantity_on_hand) as on_hand, SUM(quantity_reserved) as reserved, SUM(quantity_damaged) as damaged')
                ->orderBy('products.sku')
                ->limit(150)
                ->get();

            $since = now()->subDays(30);
            $outbound = InventoryTransaction::whereIn('warehouse_id', $warehouseIds)
                ->where('movement_type', 'stock_out')->where('created_at', '>=', $since)
                ->groupBy('product_id')->selectRaw('product_id, SUM(quantity) as qty')->pluck('qty', 'product_id');

            $data['inventory'] = $stock->map(fn ($r) => [
                'sku' => $r->sku,
                'name' => $r->name,
                'on_hand' => (float) $r->on_hand,
                'reserved' => (float) $r->reserved,
                'available' => (float) $r->on_hand - (float) $r->reserved,
                'damaged' => (float) $r->damaged,
                'reorder_level' => (float) $r->reorder_level,
                'max_stock' => $r->max_stock !== null ? (float) $r->max_stock : null,
                'unit_cost' => (float) $r->cost_price,
                'shipped_last_30d' => (float) ($outbound[$r->id] ?? 0),
            ])->values()->all();

            $data['low_stock_by_warehouse'] = InventoryBalance::query()
                ->join('products', 'products.id', '=', 'inventory_balances.product_id')
                ->join('warehouses', 'warehouses.id', '=', 'inventory_balances.warehouse_id')
                ->whereIn('inventory_balances.warehouse_id', $warehouseIds)
                ->groupBy('products.sku', 'products.name', 'products.reorder_level', 'products.max_stock', 'warehouses.code')
                ->selectRaw('products.sku, products.name, products.reorder_level, products.max_stock, warehouses.code as warehouse,
                    SUM(quantity_on_hand) - SUM(quantity_reserved) as available')
                ->havingRaw('SUM(quantity_on_hand) - SUM(quantity_reserved) <= products.reorder_level')
                ->get()
                ->map(fn ($r) => [
                    'sku' => $r->sku, 'name' => $r->name, 'warehouse' => $r->warehouse, 'available' => (float) $r->available,
                    'reorder_level' => (float) $r->reorder_level, 'max_stock' => $r->max_stock !== null ? (float) $r->max_stock : null,
                ])->all();

            $data['products_without_stock'] = Product::whereNotIn('id', $stock->pluck('id'))
                ->where('status', 'active')->limit(30)->pluck('sku')->all();

            $data['stock_by_bin_top'] = InventoryBalance::with(['product:id,sku', 'bin:id,code', 'warehouse:id,code'])
                ->whereIn('warehouse_id', $warehouseIds)->where('quantity_on_hand', '>', 0)
                ->orderByDesc('quantity_on_hand')->limit(40)->get()
                ->map(fn ($b) => [
                    'sku' => $b->product?->sku,
                    'warehouse' => $b->warehouse?->code,
                    'bin' => $b->bin?->code ?? 'STAGING',
                    'on_hand' => (float) $b->quantity_on_hand,
                ])->all();
        }

        if ($user->hasAnyPermission(['sales-orders.view', 'picking.view', 'dashboard.view'])) {
            $data['sales_orders_by_status'] = SalesOrder::whereIn('warehouse_id', $warehouseIds)
                ->selectRaw('status, COUNT(*) as count')->groupBy('status')->pluck('count', 'status');
            $data['open_sales_orders'] = SalesOrder::with('customer:id,name')
                ->whereIn('warehouse_id', $warehouseIds)
                ->whereIn('status', ['pending', 'confirmed', 'picking', 'picked', 'packed'])
                ->orderBy('required_date')->limit(25)
                ->get(['id', 'number', 'status', 'customer_id', 'order_date', 'required_date', 'total'])
                ->map(fn ($o) => [
                    'id' => $o->id,
                    'number' => $o->number, 'status' => $o->status, 'customer' => $o->customer?->name,
                    'required_date' => optional($o->required_date)->toDateString() ?? $o->required_date, 'total' => (float) $o->total,
                ])->all();
            $data['open_pick_lists'] = PickList::whereIn('warehouse_id', $warehouseIds)->whereIn('status', ['pending', 'in_progress'])->count();
        }

        if ($user->hasAnyPermission(['purchase-orders.view', 'dashboard.view'])) {
            $data['open_purchase_orders'] = PurchaseOrder::with('supplier:id,name')
                ->whereIn('warehouse_id', $warehouseIds)
                ->whereIn('status', ['draft', 'submitted', 'approved', 'partially_received'])
                ->orderBy('expected_delivery')->limit(25)
                ->get(['id', 'number', 'status', 'supplier_id', 'expected_delivery', 'total'])
                ->map(fn ($o) => [
                    'id' => $o->id,
                    'number' => $o->number, 'status' => $o->status, 'supplier' => $o->supplier?->name,
                    'expected_delivery' => optional($o->expected_delivery)->toDateString() ?? $o->expected_delivery, 'total' => (float) $o->total,
                ])->all();
        }

        if ($user->hasAnyPermission(['transfers.view', 'dashboard.view'])) {
            $data['open_transfers'] = Transfer::where(fn ($q) => $q->whereIn('source_warehouse_id', $warehouseIds)->orWhereIn('destination_warehouse_id', $warehouseIds))
                ->whereNotIn('status', ['completed', 'cancelled'])->limit(20)
                ->get(['id', 'number', 'status', 'source_warehouse_id', 'destination_warehouse_id'])->toArray();
        }

        $data['recent_movements'] = InventoryTransaction::with(['product:id,sku', 'warehouse:id,code'])
            ->whereIn('warehouse_id', $warehouseIds)
            ->whereNotIn('movement_type', ['reservation', 'reservation_release'])
            ->orderByDesc('id')->limit(20)->get()
            ->map(fn ($t) => [
                'at' => optional($t->created_at)->toDateTimeString(),
                'type' => $t->movement_type,
                'sku' => $t->product?->sku,
                'warehouse' => $t->warehouse?->code,
                'qty' => (float) $t->quantity,
            ])->all();

        // Reference id lists so the assistant can draft create actions with real ids
        // (only for the endpoints this user may actually write to).
        $allowed = $this->allowedActions($user);
        $refs = [];

        if (array_intersect(array_keys($allowed), ['products', 'purchase-orders', 'sales-orders', 'adjustments', 'transfers'])) {
            $refs['products'] = Product::orderBy('sku')->limit(300)->get(['id', 'sku', 'name'])->toArray();
        }
        if (isset($allowed['purchase-orders'])) {
            $refs['suppliers'] = Supplier::orderBy('name')->limit(200)->get(['id', 'code', 'name'])->toArray();
        }
        if (isset($allowed['sales-orders'])) {
            $refs['customers'] = Customer::orderBy('name')->limit(200)->get(['id', 'code', 'name'])->toArray();
        }
        if (isset($allowed['products'])) {
            $refs['categories'] = Category::orderBy('name')->get(['id', 'name'])->toArray();
            $refs['units'] = Unit::orderBy('name')->get(['id', 'code', 'name'])->toArray();
            $refs['brands'] = Brand::orderBy('name')->get(['id', 'name'])->toArray();
        }
        if (! empty($refs)) {
            $data['references'] = $refs;
        }

        return $data;
    }

    /**
     * Deterministic insights used when the model is unreachable (and to seed the AI).
     */
    public function ruleBasedInsights(array $snapshot): array
    {
        $insights = [];
        $inventory = collect($snapshot['inventory'] ?? []);

        $low = collect($snapshot['low_stock_by_warehouse'] ?? [])->sortBy('available');
        foreach ($low->take(3) as $i) {
            $target = $i['max_stock'] ?? max($i['reorder_level'] * 2, $i['reorder_level'] + 1);
            $insights[] = [
                'severity' => $i['available'] <= 0 ? 'critical' : 'warning',
                'title' => "Reorder {$i['sku']} ({$i['warehouse']})",
                'detail' => "{$i['name']}: {$i['available']} available in {$i['warehouse']} vs reorder level {$i['reorder_level']}. Suggested PO quantity ≈ " . max(1, round($target - $i['available'])) . '.',
                'action' => 'purchasing',
            ];
        }

        $damaged = $inventory->filter(fn ($i) => $i['damaged'] > 0);
        if ($damaged->isNotEmpty()) {
            $insights[] = [
                'severity' => 'warning',
                'title' => 'Damaged stock to resolve',
                'detail' => $damaged->sum('damaged') . ' damaged units across ' . $damaged->count() . ' SKU(s). Inspect and write off or return to supplier.',
                'action' => 'inventory',
            ];
        }

        $dead = $inventory->filter(fn ($i) => $i['on_hand'] > 0 && $i['shipped_last_30d'] == 0)->sortByDesc(fn ($i) => $i['on_hand'] * $i['unit_cost']);
        if ($dead->isNotEmpty()) {
            $top = $dead->first();
            $insights[] = [
                'severity' => 'info',
                'title' => 'Slow-moving inventory',
                'detail' => $dead->count() . " SKU(s) had no shipments in 30 days. Largest tied-up value: {$top['sku']} (" . number_format($top['on_hand'] * $top['unit_cost'], 2) . ').',
                'action' => 'reports',
            ];
        }

        $byStatus = collect($snapshot['sales_orders_by_status'] ?? []);
        if (($byStatus['confirmed'] ?? 0) + ($byStatus['picking'] ?? 0) > 0) {
            $insights[] = [
                'severity' => 'info',
                'title' => 'Orders waiting on the floor',
                'detail' => (($byStatus['confirmed'] ?? 0) + ($byStatus['picking'] ?? 0)) . ' order(s) are waiting to be picked and ' . ($byStatus['picked'] ?? 0) . ' to be packed.',
                'action' => 'picking',
            ];
        }

        if (empty($insights)) {
            $insights[] = [
                'severity' => 'success',
                'title' => 'Operations look healthy',
                'detail' => 'No stock-outs, damaged stock or fulfilment backlog detected right now.',
                'action' => 'dashboard',
            ];
        }

        return $insights;
    }
}
