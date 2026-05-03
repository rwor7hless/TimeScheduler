import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Typed accessor over the Cloud.ru S3 backup envs. Keeps `S3_PREFIX` slash
 * normalization (`todo_list` → `todo_list/`) in one place so the rest of the
 * module is a pure consumer.
 *
 * Reuses `DATABASE_URL` / `DATABASE_URL_PRISMA` with the same `+asyncpg`
 * driver-prefix strip the legacy local-disk backup did, so existing `.env`
 * files keep working untouched.
 */
@Injectable()
export class S3BackupConfigService {
  constructor(private readonly config: ConfigService) {}

  private required(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`[s3-backup] Missing required env var: ${key}`);
    }
    return value;
  }

  get endpoint(): string {
    return this.required('S3_ENDPOINT');
  }

  get region(): string {
    return this.required('S3_REGION');
  }

  get bucket(): string {
    return this.required('S3_BUCKET');
  }

  /** Always returns a string ending in `/`, even if the env var omitted it. */
  get prefix(): string {
    const raw = this.required('S3_PREFIX');
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  get accessKey(): string {
    return this.required('S3_ACCESS_KEY');
  }

  get secretKey(): string {
    return this.required('S3_SECRET_KEY');
  }

  /** `1` enables middleware-stack dump + outgoing-request logging in S3ClientFactory. */
  get s3Debug(): boolean {
    return (this.config.get<string>('S3_DEBUG') ?? '').trim() === '1';
  }

  /**
   * Returns the Postgres URL after stripping the `+asyncpg` driver prefix.
   * Mirrors the legacy `backup.service.ts` parsing exactly so we never diverge
   * on what counts as a valid `DATABASE_URL`.
   */
  get databaseUrl(): string {
    const raw =
      this.config.get<string>('DATABASE_URL') ?? this.config.get<string>('DATABASE_URL_PRISMA');
    if (!raw) {
      throw new Error('[s3-backup] DATABASE_URL is not set');
    }
    return raw.replace('postgresql+asyncpg://', 'postgresql://');
  }

  /** Optional override; falls through to admin user's `telegram_chat_id` in the notifier. */
  get notifyChatId(): string | null {
    const v = this.config.get<string>('BACKUP_NOTIFY_CHAT_ID');
    return v && v.trim().length > 0 ? v.trim() : null;
  }

  /** `1` opts into a Telegram message on every successful backup. Off by default. */
  get notifyOnSuccess(): boolean {
    return (this.config.get<string>('BACKUP_NOTIFY_ON_SUCCESS') ?? '').trim() === '1';
  }

  /** Lifecycle expiration window applied to objects under `prefix`. */
  get retentionDays(): number {
    const raw = this.config.get<string>('BACKUP_RETENTION_DAYS') ?? '84';
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`[s3-backup] BACKUP_RETENTION_DAYS must be a positive integer, got: ${raw}`);
    }
    return n;
  }

  get lifecycleRuleId(): string {
    return (
      this.config.get<string>('BACKUP_LIFECYCLE_RULE_ID') ?? 'timescheduler-todo-list-retention'
    );
  }
}
