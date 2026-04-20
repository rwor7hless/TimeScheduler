import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BackupEntry {
  filename: string;
  size_bytes: number;
  created_at: string; // ISO-8601
}

/**
 * Ports `backend/app/services/backup.py`. Shells out to `pg_dump` via
 * `child_process.spawn`. Password is passed through the `PGPASSWORD` env var
 * instead of the connection URL so values with `:` or `@` don't corrupt the
 * URL. The DATABASE_URL is parsed with Node's `URL` class after stripping
 * the `+asyncpg` driver prefix Prisma/pg don't understand.
 *
 * Filename format matches Python: `backup_YYYYMMDD_HHmmss.sql` with *local*
 * time (Python uses `datetime.now()` without tzinfo).
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly config: ConfigService) {}

  get backupDir(): string {
    return this.config.get<string>('BACKUP_DIR') ?? './backups';
  }

  async runBackup(): Promise<string> {
    const dir = this.backupDir;
    fs.mkdirSync(dir, { recursive: true });

    const ts = this.timestamp();
    const fullPath = path.join(dir, `backup_${ts}.sql`);

    const rawUrl =
      this.config.get<string>('DATABASE_URL') ?? this.config.get<string>('DATABASE_URL_PRISMA');
    if (!rawUrl) {
      throw new Error('Backup failed: DATABASE_URL is not set');
    }
    const normalized = rawUrl.replace('postgresql+asyncpg://', 'postgresql://');
    let parsed: URL;
    try {
      parsed = new URL(normalized);
    } catch {
      throw new Error(`Backup failed: cannot parse DATABASE_URL`);
    }
    const host = parsed.hostname || 'localhost';
    const port = parsed.port || '5432';
    const user = decodeURIComponent(parsed.username || '');
    const password = decodeURIComponent(parsed.password || '');
    const dbname = decodeURIComponent((parsed.pathname || '/').replace(/^\//, ''));

    return new Promise<string>((resolve, reject) => {
      const child = spawn(
        'pg_dump',
        ['-h', host, '-p', port, '-U', user, '-d', dbname, '-f', fullPath],
        {
          env: { ...process.env, PGPASSWORD: password },
          stdio: 'pipe',
        },
      );

      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });
      child.on('error', (err) => {
        reject(new Error(`Backup failed: ${err.message}`));
      });
      child.on('close', (code) => {
        if (code === 0) {
          resolve(fullPath);
        } else {
          reject(new Error(`Backup failed: ${stderr.trim() || `exit code ${code}`}`));
        }
      });
    });
  }

  listBackups(): BackupEntry[] {
    const dir = this.backupDir;
    fs.mkdirSync(dir, { recursive: true });
    const entries = fs.readdirSync(dir);
    const rows: (BackupEntry & { mtimeMs: number })[] = [];
    for (const name of entries) {
      if (!name.endsWith('.sql')) continue;
      const full = path.join(dir, name);
      try {
        const stat = fs.statSync(full);
        rows.push({
          filename: name,
          size_bytes: stat.size,
          created_at: new Date(stat.mtimeMs).toISOString(),
          mtimeMs: stat.mtimeMs,
        });
      } catch {
        // Skip files that disappeared between listing and stat.
      }
    }
    // Python sorts alphabetically reverse (which happens to align with
    // timestamp order because filenames embed sortable timestamps). We sort
    // by mtime desc to be robust against filename drift but it's equivalent
    // for ours.
    rows.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return rows.map(({ mtimeMs: _m, ...rest }) => rest);
  }

  private timestamp(): string {
    // Python: `datetime.now().strftime("%Y%m%d_%H%M%S")` — naive local time.
    const d = new Date();
    const p = (n: number): string => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_` +
      `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
    );
  }
}
