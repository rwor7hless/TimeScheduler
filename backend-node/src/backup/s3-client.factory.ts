import { Injectable, Logger } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { S3BackupConfigService } from './s3-backup.config';

/**
 * Cloud.ru-flavoured S3Client factory.
 *
 * AWS SDK v3 by default attaches `x-amz-sdk-checksum-algorithm`,
 * `amz-sdk-invocation-id`, `amz-sdk-request`, `x-amz-user-agent` and
 * `x-amz-checksum-*` headers and signs them in SigV4. Cloud.ru drops or
 * normalizes these headers in transit, so the signature computed by the SDK
 * no longer matches what the server sees and you get `SignatureDoesNotMatch`.
 *
 * The fix is a middleware that strips those headers BEFORE the signing
 * middleware runs. Insertion order is load-bearing — see the doc at
 * `cloud-ru-s3-backup-integration (2).md` §5.2 for the original derivation.
 */
const HEADERS_TO_STRIP_EXACT = new Set([
  'x-amz-sdk-checksum-algorithm',
  'amz-sdk-invocation-id',
  'amz-sdk-request',
  'x-amz-user-agent',
]);
const HEADERS_TO_STRIP_PREFIX = ['x-amz-checksum-'];

function shouldStrip(headerName: string): boolean {
  const lower = headerName.toLowerCase();
  if (HEADERS_TO_STRIP_EXACT.has(lower)) return true;
  return HEADERS_TO_STRIP_PREFIX.some((p) => lower.startsWith(p));
}

function stripHeaders(headers: Record<string, unknown>): void {
  for (const key of Object.keys(headers)) {
    if (shouldStrip(key)) delete headers[key];
  }
}

const stripMiddleware =
  (next: (args: unknown) => unknown) =>
  async (args: unknown): Promise<unknown> => {
    const request = (args as { request?: { headers?: Record<string, unknown> } }).request;
    if (request?.headers) stripHeaders(request.headers);
    return next(args);
  };

@Injectable()
export class S3ClientFactory {
  private readonly logger = new Logger(S3ClientFactory.name);
  private client: S3Client | null = null;

  constructor(private readonly config: S3BackupConfigService) {}

  getClient(): S3Client {
    if (this.client) return this.client;

    const client = new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      forcePathStyle: true, // Cloud.ru rejects virtual-host-style URLs.
      credentials: {
        accessKeyId: this.config.accessKey,
        secretAccessKey: this.config.secretKey,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    // First pass: strip in `build` step as a safety net in case `build` runs
    // before sign in the current SDK version.
    client.middlewareStack.add(stripMiddleware as never, {
      step: 'build',
      name: 'stripCloudRuHeadersBuild',
    });

    // Main pass: position the strip middleware BEFORE whichever signer
    // middleware this SDK version exposes. The names have churned across
    // releases — try the known candidates in order.
    let positionedBeforeSigner = false;
    for (const signerName of ['awsAuthMiddleware', 'httpSigningMiddleware', 'signingMiddleware']) {
      try {
        client.middlewareStack.addRelativeTo(stripMiddleware as never, {
          name: `stripCloudRuHeadersBefore_${signerName}`,
          relation: 'before',
          toMiddleware: signerName,
        });
        positionedBeforeSigner = true;
        break;
      } catch {
        // No such middleware in this SDK build — try the next candidate.
      }
    }

    // Last resort: tack onto `finalizeRequest` with low priority. Should not
    // be needed on any current SDK release but keeps the contract loud.
    if (!positionedBeforeSigner) {
      client.middlewareStack.add(stripMiddleware as never, {
        step: 'finalizeRequest',
        name: 'stripCloudRuHeadersFinalizeFallback',
        priority: 'low',
      });
    }

    if (this.config.s3Debug) {
      const stack = client.middlewareStack.identify();
      this.logger.debug(`[S3-DEBUG] middleware stack (${stack.length} items):`);
      for (const line of stack) this.logger.debug(`[S3-DEBUG]   ${line}`);
      this.logger.debug(`[S3-DEBUG] stripper positionedBeforeSigner=${positionedBeforeSigner}`);

      client.middlewareStack.add(
        ((next: (args: unknown) => unknown) =>
          async (args: unknown): Promise<unknown> => {
            const req = (
              args as {
                request?: {
                  method?: string;
                  hostname?: string;
                  path?: string;
                  query?: Record<string, unknown>;
                  headers?: Record<string, unknown>;
                };
              }
            ).request;
            if (req) {
              this.logger.debug('[S3-DEBUG] ===== Outgoing =====');
              this.logger.debug(`[S3-DEBUG] ${req.method} https://${req.hostname}${req.path}`);
              if (req.query && Object.keys(req.query).length) {
                this.logger.debug(`[S3-DEBUG] query: ${JSON.stringify(req.query)}`);
              }
              this.logger.debug(`[S3-DEBUG] headers: ${JSON.stringify(req.headers)}`);
            }
            try {
              return await next(args);
            } catch (err) {
              this.logger.debug(`[S3-DEBUG] error: ${String(err)}`);
              throw err;
            }
          }) as never,
        { step: 'finalizeRequest', name: 'debugLogger', priority: 'low' },
      );
    }

    this.client = client;
    return client;
  }
}
