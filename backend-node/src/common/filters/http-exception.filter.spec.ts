import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { AllExceptionsFilter } from './http-exception.filter';

/**
 * Unit tests for the global exception filter. Each case builds a minimal
 * fake `ArgumentsHost` that exposes just `getResponse` and `getRequest`
 * on the HTTP context — matching the surface the filter actually reads.
 */
describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let setHeaderMock: jest.Mock;
  let getHeaderMock: jest.Mock;
  let response: {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
    getHeader: jest.Mock;
  };
  let request: { method: string; originalUrl: string; url: string };
  let host: ArgumentsHost;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock }));
    setHeaderMock = jest.fn();
    getHeaderMock = jest.fn(() => undefined);

    response = {
      status: statusMock,
      json: jsonMock,
      setHeader: setHeaderMock,
      getHeader: getHeaderMock,
    };
    request = { method: 'GET', originalUrl: '/api/whatever', url: '/api/whatever' };

    host = {
      switchToHttp: () => ({
        getResponse: <T = unknown>() => response as unknown as T,
        getRequest: <T = unknown>() => request as unknown as T,
        getNext: <T = unknown>() => undefined as unknown as T,
      }),
      // The filter never reaches these branches but the interface requires them.
      getArgs: () => [] as unknown[],
      getArgByIndex: () => undefined,
      switchToRpc: () => ({}) as never,
      switchToWs: () => ({}) as never,
      getType: () => 'http' as never,
    } as unknown as ArgumentsHost;

    filter = new AllExceptionsFilter();
  });

  it('wraps a bare HttpException(string) into {detail}', () => {
    filter.catch(new HttpException('Something bad', HttpStatus.BAD_REQUEST), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith({ detail: 'Something bad' });
    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'application/json');
  });

  it('passes preexisting {detail} bodies through unchanged', () => {
    filter.catch(new BadRequestException({ detail: 'Preexisting detail' }), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith({ detail: 'Preexisting detail' });
  });

  it('flattens ValidationPipe array payload to the first string message', () => {
    // ValidationPipe emits {statusCode, message: string[], error} — we pick
    // the first readable string.
    const validationError = new BadRequestException({
      statusCode: 400,
      message: ['username should not be empty', 'username must be a string'],
      error: 'Bad Request',
    });

    filter.catch(validationError, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith({ detail: 'username should not be empty' });
  });

  it('extracts .message from Nest default {statusCode, message, error} body', () => {
    // Nest's UnauthorizedException() with no args produces
    // {statusCode:401, message:"Unauthorized", error:"Unauthorized"}.
    const exc = new HttpException(
      { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' },
      HttpStatus.UNAUTHORIZED,
    );

    filter.catch(exc, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(jsonMock).toHaveBeenCalledWith({ detail: 'Unauthorized' });
    // 401 → WWW-Authenticate: Bearer is set when not already present.
    expect(setHeaderMock).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer');
  });

  it('does not overwrite a WWW-Authenticate header that upstream already set', () => {
    getHeaderMock.mockReturnValue('Bearer realm="x"');
    const exc = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

    filter.catch(exc, host);

    // setHeader called once for Content-Type, but NOT for WWW-Authenticate
    // since it was already present.
    const wwwCalls = setHeaderMock.mock.calls.filter(([h]) => h === 'WWW-Authenticate');
    expect(wwwCalls.length).toBe(0);
  });

  it('maps ThrottlerException to 429 with the Russian text mandated by spec', () => {
    filter.catch(new ThrottlerException(), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    expect(jsonMock).toHaveBeenCalledWith({
      detail: 'Слишком много запросов. Пожалуйста, попробуйте позже.',
    });
  });

  it('maps an unknown throw to 500 {detail: "Internal server error"} and logs it', () => {
    const errSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const boom = new Error('unknown boom');

    filter.catch(boom, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith({ detail: 'Internal server error' });
    expect(errSpy).toHaveBeenCalled();
    // Ensure the original message is somewhere in the log arguments — we
    // don't pin the exact format, but the stack/message must be passed in.
    const loggedArgs = errSpy.mock.calls[0]?.join(' ') ?? '';
    expect(loggedArgs).toContain('unknown boom');

    errSpy.mockRestore();
  });

  it('falls back to JSON.stringify when ValidationPipe array has no strings', () => {
    const exc = new BadRequestException({ statusCode: 400, message: [{ x: 1 }], error: 'x' });

    filter.catch(exc, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = jsonMock.mock.calls[0][0] as { detail: string };
    expect(typeof body.detail).toBe('string');
    expect(body.detail.length).toBeGreaterThan(0);
  });
});
