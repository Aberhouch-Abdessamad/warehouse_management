<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Symfony\Component\HttpFoundation\Response;

/**
 * Records every successful write (POST/PUT/PATCH/DELETE) made through the API.
 */
class AuditTrail
{
    private const SKIP = ['auth/login', 'auth/logout', 'ai/*', 'notifications/*'];

    private const HIDDEN = ['password', 'password_confirmation', 'current_password', 'new_password', 'confirm_password', 'token', 'api_key'];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        try {
            if (! in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
                return $response;
            }
            if ($response->getStatusCode() >= 400 || ! $request->user()) {
                return $response;
            }

            $path = trim(preg_replace('#^api/v1/?#', '', $request->path()), '/');
            foreach (self::SKIP as $pattern) {
                if (fnmatch($pattern, $path)) {
                    return $response;
                }
            }

            $segments = explode('/', $path);
            $module = $segments[0] ?? 'unknown';
            $recordId = null;
            foreach ($segments as $seg) {
                if (ctype_digit($seg)) {
                    $recordId = (int) $seg;
                    break;
                }
            }
            $last = end($segments);
            $action = match (true) {
                ! ctype_digit((string) $last) && count($segments) > 1 => str_replace('-', '_', $last),
                $request->isMethod('POST') => 'create',
                $request->isMethod('DELETE') => 'delete',
                default => 'update',
            };

            if ($recordId === null) {
                $payload = json_decode((string) $response->getContent(), true);
                $recordId = is_array($payload) ? (Arr::get($payload, 'data.id')) : null;
            }

            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => substr($action, 0, 50),
                'module' => substr($module, 0, 50),
                'record_id' => is_numeric($recordId) ? (int) $recordId : null,
                'record_type' => $module,
                'old_values' => null,
                'new_values' => Arr::except($request->all(), self::HIDDEN) ?: null,
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            report($e); // never break the request because of auditing
        }

        return $response;
    }
}
