<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Controller;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $query = $request->user()->notifications();

        if ($request->boolean('unread_only')) {
            $query->whereNull('read_at');
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $notifications = $query->orderByDesc('created_at')->paginate($perPage);

        return $this->paginated($notifications);
    }

    public function markRead(Request $request, DatabaseNotification $notification)
    {
        if ($notification->notifiable_id !== $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden.',
                'errors' => (object) [],
                'data' => null,
                'meta' => [],
            ], 403);
        }

        $notification->markAsRead();
        return $this->success($notification->fresh(), 'Notification marked as read.');
    }

    public function markAllRead(Request $request)
    {
        $request->user()->unreadNotifications->markAsRead();
        return $this->success(null, 'All notifications marked as read.');
    }

    public function unreadCount(Request $request)
    {
        return $this->success([
            'count' => $request->user()->unreadNotifications()->count(),
        ]);
    }
}