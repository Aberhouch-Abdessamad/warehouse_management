<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api/v1',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(append: [
            \App\Http\Middleware\ForceJsonResponse::class,
            \App\Http\Middleware\AuditTrail::class,
        ]);

        $middleware->alias([
            'role' => \App\Http\Middleware\CheckRole::class,
            'permission' => \App\Http\Middleware\CheckPermission::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $status = 500;
            $message = 'Server error.';
            $errors = [];

            if ($e instanceof ValidationException) {
                $status = 422;
                $message = 'Validation failed.';
                $errors = $e->errors();
            } elseif ($e instanceof AuthenticationException) {
                $status = 401;
                $message = 'Unauthenticated.';
            } elseif ($e instanceof AuthorizationException) {
                $status = 403;
                $message = 'Forbidden.';
            } elseif ($e instanceof ModelNotFoundException || $e instanceof NotFoundHttpException) {
                $status = 404;
                $message = 'Resource not found.';
            } elseif ($e instanceof \Illuminate\Http\Exceptions\ThrottleRequestsException) {
                $status = 429;
                $message = 'Too many requests.';
            } elseif ($e instanceof \Illuminate\Validation\UnauthorizedException) {
                $status = 403;
                $message = 'Forbidden.';
            } elseif ($e instanceof HttpException) {
                $status = $e->getStatusCode();
                $message = $e->getMessage() ?: 'Request failed.';
            } elseif ($e instanceof \InvalidArgumentException) {
                // Business-rule violations raised by the domain services.
                $status = 422;
                $message = $e->getMessage();
            } elseif ($e instanceof \Illuminate\Database\QueryException && in_array((string) $e->getCode(), ['23000', '23505'], true)) {
                $status = 409;
                $message = 'Conflict or duplicate entry.';
            }

            if ($status === 500 && config('app.debug')) {
                $message = $e->getMessage();
            }

            return response()->json([
                'success' => false,
                'message' => $message,
                'errors' => $errors ?: (object) [],
                'data' => null,
                'meta' => [],
            ], $status);
        });
    })->create();