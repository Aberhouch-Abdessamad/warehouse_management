<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\AiConversation;
use App\Models\AiMessage;
use App\Services\AiAssistantService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use RuntimeException;

class AiAssistantController extends Controller
{
    private function imageRule(): array
    {
        return ['nullable', 'string', 'max:7000000', 'regex:/^data:image\/(png|jpe?g|webp|gif);base64,/'];
    }

    public function __construct(private AiAssistantService $ai) {}

    public function status()
    {
        return $this->success([
            'configured' => $this->ai->isConfigured(),
            'vision' => true,
        ]);
    }

    /**
     * Chat with the assistant. The conversation is persisted server-side, so
     * history survives page refreshes and logins. Send conversation_id to
     * continue an existing chat; omit it to start a new one. The optional
     * image (data URL) is attached to the newest user message – the AI can
     * read photos of shelves, labels, delivery notes or damaged goods.
     */
    public function chat(Request $request)
    {
        $request->validate([
            'content' => 'required|string|max:8000',
            'image' => $this->imageRule(),
            'page' => 'nullable|string|max:60',
            'conversation_id' => 'nullable|integer',
        ]);

        if (! $this->ai->isConfigured()) {
            return $this->errorResponse('The AI assistant is not configured on this server. Add AI_BASE_URL, AI_API_KEY and AI_MODEL to wms-backend/.env.', 503);
        }

        $user = $request->user();
        $warehouseIds = DashboardController::scopedWarehouseIds($request);

        $conversation = null;
        if ($request->filled('conversation_id')) {
            $conversation = AiConversation::where('user_id', $user->id)
                ->find((int) $request->input('conversation_id'));
            if (! $conversation) {
                return $this->errorResponse('Conversation not found.', 404);
            }
        }

        if (! $conversation) {
            $conversation = AiConversation::create([
                'user_id' => $user->id,
                'title' => Str::limit(trim((string) $request->input('content')), 60, '…'),
            ]);
        }

        // Store the user's message (with photo, when present) before answering.
        $conversation->messages()->create([
            'role' => 'user',
            'content' => (string) $request->input('content'),
            'image' => $request->filled('image') ? (string) $request->input('image') : null,
        ]);

        $history = $conversation->messages()->orderBy('id')->get();
        $latestUserMessageId = $history->where('role', 'user')->pluck('id')->last();

        $messages = [['role' => 'system', 'content' => $this->ai->systemPrompt($user, $warehouseIds, $request->input('page'))]];

        // Only the last 20 messages are sent to the model. Older photos stay
        // in storage but are not re-uploaded to the AI on every turn.
        foreach ($history->take(-20)->values() as $m) {
            /** @var AiMessage $m */
            if ($m->id === $latestUserMessageId && $m->image) {
                $messages[] = [
                    'role' => 'user',
                    'content' => [
                        ['type' => 'text', 'text' => $m->content],
                        ['type' => 'image_url', 'image_url' => ['url' => $m->image]],
                    ],
                ];
            } else {
                $messages[] = ['role' => $m->role, 'content' => $m->content];
            }
        }

        try {
            $reply = $this->ai->complete($messages);
        } catch (RuntimeException $e) {
            report($e);
            return $this->errorResponse($e->getMessage(), 502);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            report($e);
            return $this->errorResponse('Could not reach the AI service. Check AI_BASE_URL and that the server is online.', 504);
        }

        // Store the answer so the whole thread is available after refresh.
        $assistantMessage = $conversation->messages()->create([
            'role' => 'assistant',
            'content' => $reply,
        ]);

        $conversation->touch();

        return $this->success([
            'reply' => $reply,
            'conversation_id' => $conversation->id,
            'message_id' => $assistantMessage->id,
        ]);
    }

    /**
     * Short list of actionable insights for the dashboard. Uses the model when
     * available and falls back to deterministic rules otherwise.
     */
    public function insights(Request $request)
    {
        $request->validate(['warehouse_id' => 'nullable|integer|exists:warehouses,id', 'refresh' => 'nullable|boolean']);

        $user = $request->user();
        $warehouseIds = DashboardController::scopedWarehouseIds($request);
        $cacheKey = 'ai_insights:' . $user->id . ':' . $warehouseIds->sort()->implode('-');

        if ($request->boolean('refresh')) {
            Cache::forget($cacheKey);
        }

        $result = Cache::remember($cacheKey, now()->addMinutes(10), function () use ($user, $warehouseIds) {
            $snapshot = $this->ai->snapshot($user, $warehouseIds);
            $rules = $this->ai->ruleBasedInsights($snapshot);

            if (! $this->ai->isConfigured()) {
                return ['source' => 'rules', 'insights' => $rules, 'generated_at' => now()->toIso8601String()];
            }

            try {
                $raw = $this->ai->complete([
                    ['role' => 'system', 'content' => $this->ai->systemPrompt($user, $warehouseIds, 'Dashboard')],
                    ['role' => 'user', 'content' => 'Give me the 4 most important, actionable insights for this warehouse right now. '
                        . 'Respond ONLY with a JSON array (no prose, no code fences). Each item: '
                        . '{"severity":"critical|warning|info|success","title":"max 6 words","detail":"one or two sentences with concrete numbers","action":"one of: purchasing, inventory, picking, packing, shipping, transfers, stock-counts, reports, receiving, putaway"}'],
                ], 2000, 0.2);

                $json = trim(preg_replace('/^```(?:json)?|```$/m', '', $raw));
                $start = strpos($json, '[');
                $end = strrpos($json, ']');
                $parsed = ($start !== false && $end !== false) ? json_decode(substr($json, $start, $end - $start + 1), true) : null;

                if (is_array($parsed) && count($parsed) > 0) {
                    $clean = collect($parsed)->filter(fn ($i) => is_array($i) && isset($i['title'], $i['detail']))
                        ->take(5)
                        ->map(fn ($i) => [
                            'severity' => in_array($i['severity'] ?? '', ['critical', 'warning', 'info', 'success'], true) ? $i['severity'] : 'info',
                            'title' => (string) $i['title'],
                            'detail' => (string) $i['detail'],
                            'action' => (string) ($i['action'] ?? 'dashboard'),
                        ])->values()->all();
                    if ($clean) {
                        return ['source' => 'ai', 'insights' => $clean, 'generated_at' => now()->toIso8601String()];
                    }
                }
            } catch (\Throwable $e) {
                report($e);
            }

            return ['source' => 'rules', 'insights' => $rules, 'generated_at' => now()->toIso8601String()];
        });

        return $this->success($result);
    }

    /**
     * The user's saved conversations, newest first.
     */
    public function conversations(Request $request)
    {
        $conversations = AiConversation::where('user_id', $request->user()->id)
            ->withCount('messages')
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get(['id', 'title', 'updated_at']);

        return $this->success($conversations);
    }

    /**
     * Full message history of one conversation.
     */
    public function show(Request $request, AiConversation $conversation)
    {
        if ($conversation->user_id !== $request->user()->id) {
            return $this->errorResponse('Conversation not found.', 404);
        }

        $messages = $conversation->messages()
            ->orderBy('id')
            ->get(['id', 'role', 'content', 'image', 'action_state', 'action_result', 'created_at'])
            ->map(fn (AiMessage $m) => [
                'id' => $m->id,
                'role' => $m->role,
                'content' => $m->content,
                'image' => $m->image, // only user messages carry an image
                'action_state' => $m->action_state,
                'action_result' => $m->action_result,
                'created_at' => $m->created_at?->toIso8601String(),
            ])->all();

        return $this->success([
            'id' => $conversation->id,
            'title' => $conversation->title,
            'messages' => $messages,
        ]);
    }

    public function destroy(Request $request, AiConversation $conversation)
    {
        if ($conversation->user_id !== $request->user()->id) {
            return $this->errorResponse('Conversation not found.', 404);
        }

        $conversation->delete();

        return $this->success(null, 'Conversation deleted.');
    }

    public function destroyAll(Request $request)
    {
        AiConversation::where('user_id', $request->user()->id)->delete();

        return $this->success(null, 'All conversations deleted.');
    }

    /**
     * Remember whether a proposed create-action was confirmed or dismissed,
     * so an already-executed action card is inert after refresh.
     */
    public function actionResult(Request $request, AiMessage $aiMessage)
    {
        $request->validate([
            'state' => 'required|in:done,dismissed',
            'result' => 'nullable|string|max:200',
        ]);

        if ($aiMessage->role !== 'assistant' || $aiMessage->conversation->user_id !== $request->user()->id) {
            return $this->errorResponse('Message not found.', 404);
        }

        $aiMessage->update([
            'action_state' => (string) $request->input('state'),
            'action_result' => $request->filled('result') ? (string) $request->input('result') : null,
        ]);

        return $this->success(null, 'Saved.');
    }
}
