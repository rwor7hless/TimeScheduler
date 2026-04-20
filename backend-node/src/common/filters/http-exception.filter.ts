import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';

/**
 * Normalizes every 4xx/5xx response body to FastAPI's `{detail: <string>}`
 * contract. The React frontend reads `response.data.detail` directly
 * (see `frontend/src/pages/AdminPage.tsx` and similar call sites), so we
 * have to emit exactly that shape — not Nest's default
 * `{statusCode, message, error}`.
 *
 * Rules:
 *   - `HttpException` with a string response → `{detail: <string>}`.
 *   - `HttpException` with an object response that already has `detail` → passes through unchanged.
 *   - `HttpException` with an object response that has `message` (Nest default
 *     or ValidationPipe array) → flatten `message` to a single string.
 *   - `ThrottlerException` (rate-limited) → 429 with the Russian text
 *     "Слишком много запросов. Пожалуйста, попробуйте позже." as mandated
 *     by the Phase 3 spec. (The current Python `rate_limit_handler` emits an
 *     English string; the spec treats the Russian version as the
 *     intended user-facing text and a Python-side sync is tracked
 *     separately.)
 *   - Any other thrown (non-HttpException) → 500 with a generic redacted
 *     body; the original error is logged at error level so stack traces
 *     never ship to clients.
 *
 * 401 responses keep the `WWW-Authenticate: Bearer` header that Nest's JWT
 * guard may have already attached. FastAPI sets this header on OAuth2
 * flows; the frontend doesn't inspect it, but parity is cheap.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, detail } = this.resolve(exception, request);

    // Always emit JSON so the frontend can `response.data.detail` safely.
    response.setHeader('Content-Type', 'application/json');

    // Preserve WWW-Authenticate: Bearer on 401s. Nest's JwtAuthGuard doesn't
    // set this automatically (FastAPI does via OAuth2 helpers), but if any
    // upstream middleware or guard attached it, keep it.
    if (status === HttpStatus.UNAUTHORIZED && !response.getHeader('WWW-Authenticate')) {
      response.setHeader('WWW-Authenticate', 'Bearer');
    }

    response.status(status).json({ detail });
  }

  private resolve(exception: unknown, request: Request): { status: number; detail: string } {
    // ThrottlerException extends HttpException but we emit the Russian text
    // mandated by the Phase 3 spec regardless of the underlying message.
    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        detail: 'Слишком много запросов. Пожалуйста, попробуйте позже.',
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        return { status, detail: body };
      }

      if (body && typeof body === 'object') {
        const record = body as Record<string, unknown>;

        // Preexisting {detail: ...} body (e.g. a handler that already
        // matched the Python shape) passes through untouched.
        if (typeof record.detail === 'string') {
          return { status, detail: record.detail };
        }

        // ValidationPipe array payload → pick the first readable string.
        // This is the deliberately simplified shape the Phase 3 spec
        // accepts; richer error trees can come later if the frontend
        // ever needs them.
        if (Array.isArray(record.message)) {
          const first = record.message.find((m): m is string => typeof m === 'string');
          if (first) return { status, detail: first };
          return { status, detail: JSON.stringify(record.message) };
        }

        if (typeof record.message === 'string') {
          return { status, detail: record.message };
        }
      }

      // Fall back to the exception's own .message (HttpException populates
      // this from whatever was passed in). Safe default if body was some
      // unexpected shape.
      return { status, detail: exception.message || 'Error' };
    }

    // Non-HttpException throw — genuine server bug. Log everything for
    // the operator, show nothing to the client.
    const method = request?.method ?? 'UNKNOWN';
    const url = request?.originalUrl ?? request?.url ?? 'unknown';
    this.logger.error(
      `Unhandled exception on ${method} ${url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'Internal server error',
    };
  }
}
