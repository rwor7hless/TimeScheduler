/**
 * SigV4 diagnostic — bypasses the AWS SDK and the DI container so it can
 * surface what's actually wrong when `SignatureDoesNotMatch` shows up.
 *
 * Iterates over the variables Cloud.ru is most likely to disagree with the
 * SDK on (region, service name, host style, payload-hash mode) and prints
 * the HTTP status of a `HEAD /` against the bucket for each combination.
 * The variant that returns 200 is the right one for your account.
 *
 * Reads env directly via `process.env` — must NOT pull from
 * `S3BackupConfigService` because that lives in the DI graph that wraps the
 * very SDK middleware-strip workaround we are trying to validate exists.
 *
 * Run:  npm run backup:s3:debug-request
 */
import * as crypto from 'node:crypto';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';

interface Variant {
  region: string;
  service: string;
  hostStyle: 'path' | 'virtual';
  payloadHash: 'EMPTY' | 'UNSIGNED-PAYLOAD';
}

const REGIONS = ['ru-central-1', 'ru-1', 'us-east-1'];
const SERVICES = ['s3', 's3e'];
const HOST_STYLES: Variant['hostStyle'][] = ['path', 'virtual'];
const PAYLOAD_HASHES: Variant['payloadHash'][] = ['EMPTY', 'UNSIGNED-PAYLOAD'];

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`[s3-debug] missing env var: ${name}`);
  }
  return v.trim();
}

function buildRequest(variant: Variant, endpoint: URL, bucket: string): HttpRequest {
  const hostname =
    variant.hostStyle === 'virtual' ? `${bucket}.${endpoint.hostname}` : endpoint.hostname;
  const path = variant.hostStyle === 'virtual' ? '/' : `/${bucket}`;
  return new HttpRequest({
    method: 'HEAD',
    protocol: endpoint.protocol,
    hostname,
    port: endpoint.port ? Number(endpoint.port) : undefined,
    path,
    headers: {
      host: hostname + (endpoint.port ? `:${endpoint.port}` : ''),
      'x-amz-content-sha256':
        variant.payloadHash === 'EMPTY' ? EMPTY_SHA256 : 'UNSIGNED-PAYLOAD',
    },
  });
}

async function trySignAndSend(
  variant: Variant,
  endpoint: URL,
  bucket: string,
  accessKey: string,
  secretKey: string,
): Promise<{ status: number; statusText: string } | { error: string }> {
  const signer = new SignatureV4({
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    region: variant.region,
    service: variant.service,
    sha256: Sha256,
  });

  const request = buildRequest(variant, endpoint, bucket);

  let signed;
  try {
    signed = await signer.sign(request, {
      unsignableHeaders: new Set(),
    });
  } catch (err) {
    return { error: `sign-error: ${err instanceof Error ? err.message : String(err)}` };
  }

  try {
    const url = `${signed.protocol}//${signed.hostname}${signed.port ? `:${signed.port}` : ''}${signed.path}`;
    const resp = await fetch(url, {
      method: signed.method,
      headers: signed.headers as Record<string, string>,
    });
    return { status: resp.status, statusText: resp.statusText };
  } catch (err) {
    return { error: `fetch-error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function main(): Promise<void> {
  const endpointStr = readEnv('S3_ENDPOINT');
  const bucket = readEnv('S3_BUCKET');
  const accessKey = readEnv('S3_ACCESS_KEY');
  const secretKey = readEnv('S3_SECRET_KEY');
  const endpoint = new URL(endpointStr);

  console.log(`[s3-debug] endpoint=${endpointStr} bucket=${bucket}`);
  console.log(`[s3-debug] access-key prefix: ${accessKey.slice(0, 8)}…`);
  console.log('');
  console.log('Variant | Region | Service | HostStyle | PayloadHash | Result');
  console.log('--------|--------|---------|-----------|-------------|--------');

  let n = 0;
  for (const region of REGIONS) {
    for (const service of SERVICES) {
      for (const hostStyle of HOST_STYLES) {
        for (const payloadHash of PAYLOAD_HASHES) {
          n += 1;
          const variant: Variant = { region, service, hostStyle, payloadHash };
          const result = await trySignAndSend(variant, endpoint, bucket, accessKey, secretKey);
          const resultStr =
            'status' in result ? `HTTP ${result.status} ${result.statusText}` : result.error;
          console.log(
            `${String(n).padStart(2, ' ')}      | ${region.padEnd(13)} | ${service.padEnd(7)} | ${hostStyle.padEnd(9)} | ${payloadHash.padEnd(11)} | ${resultStr}`,
          );
        }
      }
    }
  }

  console.log('');
  console.log('A 200 row indicates the right combination for your account.');
  console.log('A 403 with SignatureDoesNotMatch means the signature was wrong for that combo.');
  console.log('A 404 NoSuchBucket means the auth was accepted but the bucket name is wrong.');
}

// Avoid unused-import warnings in builds where crypto is bundled.
void crypto;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
