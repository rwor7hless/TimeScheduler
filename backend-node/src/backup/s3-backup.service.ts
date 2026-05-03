import { Upload } from '@aws-sdk/lib-storage';
import { Injectable, Logger } from '@nestjs/common';
import { Transform } from 'node:stream';
import { BackupNotifierService } from './backup-notifier.service';
import { PgDumpStreamer } from './pg-dump.streamer';
import { S3BackupConfigService } from './s3-backup.config';
import { S3ClientFactory } from './s3-client.factory';

export interface BackupResult {
  key: string;
  size: number;
  durationMs: number;
}

/**
 * Streams `pg_dump -Fc` directly into Cloud.ru S3 via multipart upload.
 *
 * No disk write — the dump is consumed as a `Readable` and chunks are
 * uploaded as soon as `Upload` collects them. Failure → Telegram notification
 * (failure-only by default; opt-in success ping via `BACKUP_NOTIFY_ON_SUCCESS=1`).
 */
@Injectable()
export class S3BackupService {
  private readonly logger = new Logger(S3BackupService.name);

  constructor(
    private readonly config: S3BackupConfigService,
    private readonly s3: S3ClientFactory,
    private readonly pgDump: PgDumpStreamer,
    private readonly notifier: BackupNotifierService,
  ) {}

  async run(): Promise<BackupResult> {
    const key = this.timestampKey(this.config.prefix);
    const startedAt = Date.now();

    this.logger.log(`start -> s3://${this.config.bucket}/${key}`);

    const dumpStream = this.pgDump.stream(this.config.databaseUrl);

    // IMPORTANT: do NOT attach `dumpStream.on('data', ...)` directly — that
    // flips the Readable into flowing mode immediately, and if pg_dump
    // finishes before lib-storage's Upload subscribes its async iterator we
    // lose every chunk and silently upload 0 bytes. Instead, pipe through a
    // Transform that counts bytes while remaining paced by Upload's reads.
    let size = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        size += chunk.length;
        cb(null, chunk);
      },
    });
    dumpStream.on('error', (err) => counter.destroy(err));
    dumpStream.pipe(counter);

    try {
      const upload = new Upload({
        client: this.s3.getClient(),
        params: {
          Bucket: this.config.bucket,
          Key: key,
          Body: counter,
          ContentType: 'application/octet-stream',
        },
        queueSize: 4,
        // S3 minimum part size is 5 MiB. Smaller parts (except the last) are
        // rejected. Do not lower without a very good reason.
        partSize: 5 * 1024 * 1024,
      });

      await upload.done();

      const durationMs = Date.now() - startedAt;
      this.logger.log(`done -> key=${key} size=${size}B duration=${durationMs}ms`);

      const result: BackupResult = { key, size, durationMs };
      if (this.config.notifyOnSuccess) {
        await this.notifier.notifySuccess(result);
      }
      return result;
    } catch (err) {
      this.logger.error(`failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
      await this.notifier.notifyFailure(err);
      throw err;
    }
  }

  /**
   * Doc §5.4: ISO-8601 in the key with `:` swapped for `-` so Windows
   * downloaders don't choke on the resulting filename.
   */
  private timestampKey(prefix: string): string {
    const iso = new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, 'Z');
    return `${prefix}db-${iso}.dump`;
  }
}
