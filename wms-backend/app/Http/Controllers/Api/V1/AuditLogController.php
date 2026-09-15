<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'user_id' => 'nullable|integer',
            'module' => 'nullable|string',
            'action' => 'nullable|string',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
        ]);

        $query = AuditLog::with('user:id,name,email');

        if ($userId = $request->input('user_id')) {
            $query->where('user_id', $userId);
        }
        if ($module = $request->input('module')) {
            $query->where('module', $module);
        }
        if ($action = $request->input('action')) {
            $query->where('action', $action);
        }
        if ($fromDate = $request->input('from_date')) {
            $query->whereDate('created_at', '>=', $fromDate);
        }
        if ($toDate = $request->input('to_date')) {
            $query->whereDate('created_at', '<=', $toDate);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        return $this->paginated($query->orderByDesc('created_at')->paginate($perPage));
    }
}