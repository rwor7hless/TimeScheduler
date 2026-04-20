import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { BackupService } from './backup.service';

/** Resolver shim — ConfigService mimic returning env-like lookups. */
function cfgFor(values: Record<string, string | undefined>): ConfigService {
  return {
    get: <T>(k: string): T | undefined => values[k] as unknown as T,
  } as unknown as ConfigService;
}

describe('BackupService', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backups-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('listBackups sorts .sql files by mtime desc and ignores non-sql files', () => {
    const older = path.join(tmpDir, 'backup_20260101_000000.sql');
    const newer = path.join(tmpDir, 'backup_20260420_120000.sql');
    fs.writeFileSync(older, 'old');
    fs.writeFileSync(newer, 'new');
    fs.utimesSync(older, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));
    fs.utimesSync(newer, new Date('2026-04-20T12:00:00Z'), new Date('2026-04-20T12:00:00Z'));
    fs.writeFileSync(path.join(tmpDir, 'readme.txt'), 'noise');

    const svc = new BackupService(cfgFor({ BACKUP_DIR: tmpDir }));
    const rows = svc.listBackups();
    expect(rows.map((r) => r.filename)).toEqual([
      'backup_20260420_120000.sql',
      'backup_20260101_000000.sql',
    ]);
    expect(rows[0].size_bytes).toBe(3);
    expect(rows[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('listBackups creates the dir if missing', () => {
    const newDir = path.join(tmpDir, 'nested', 'backups');
    const svc = new BackupService(cfgFor({ BACKUP_DIR: newDir }));
    expect(svc.listBackups()).toEqual([]);
    expect(fs.existsSync(newDir)).toBe(true);
  });

  it('runBackup rejects when DATABASE_URL is unset', async () => {
    const svc = new BackupService(
      cfgFor({ BACKUP_DIR: tmpDir, DATABASE_URL: undefined, DATABASE_URL_PRISMA: undefined }),
    );
    await expect(svc.runBackup()).rejects.toThrow(/DATABASE_URL is not set/);
  });

  it('runBackup parses +asyncpg driver prefix out of DATABASE_URL', async () => {
    // Use a bogus host so pg_dump (if present) fails; we only assert the
    // URL parse path executed without throwing the "is not set" error.
    const svc = new BackupService(
      cfgFor({
        BACKUP_DIR: tmpDir,
        DATABASE_URL: 'postgresql+asyncpg://u:p@127.0.0.1:1/db',
      }),
    );
    await expect(svc.runBackup()).rejects.toThrow(/Backup failed/);
  });
});
