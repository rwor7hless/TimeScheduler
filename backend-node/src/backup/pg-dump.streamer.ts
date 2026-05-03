import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { Injectable, Logger } from '@nestjs/common';

interface PgConnection {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

/**
 * Spawns `pg_dump -Fc` and exposes its stdout as a `Readable` for piping into
 * `@aws-sdk/lib-storage`'s multipart `Upload`. Custom format (`-Fc`) produces
 * a binary `.dump` consumable by `pg_restore` — different from the legacy
 * local-disk service which used plain SQL via `-f file.sql`.
 *
 * Password goes through `PGPASSWORD` env (not the URL) so it can contain
 * `:`, `@`, or other URL-reserved chars without breaking parsing.
 */
@Injectable()
export class PgDumpStreamer {
  private readonly logger = new Logger(PgDumpStreamer.name);

  stream(databaseUrl: string): Readable {
    const conn = this.parseDatabaseUrl(databaseUrl);

    this.logger.log(
      `spawn pg_dump host=${conn.host} port=${conn.port} db=${conn.database} user=${conn.user}`,
    );

    const child = spawn(
      'pg_dump',
      [
        '-h',
        conn.host,
        '-p',
        conn.port,
        '-U',
        conn.user,
        '-d',
        conn.database,
        '-Fc',
        '--no-owner',
        '--no-privileges',
        '--verbose',
      ],
      {
        env: { ...process.env, PGPASSWORD: conn.password },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    const stderrChunks: Buffer[] = [];
    child.stderr.on('data', (c: Buffer) => {
      stderrChunks.push(c);
      // pg_dump --verbose writes progress to stderr; surface it so 0-byte
      // dumps stop being silent. Trim trailing newline for log cleanliness.
      this.logger.debug(`pg_dump: ${c.toString('utf8').trimEnd()}`);
    });

    child.on('error', (err) => {
      this.logger.error(`pg_dump spawn error: ${err.message}`);
      child.stdout.destroy(err);
    });
    child.on('close', (code) => {
      const stderrText = Buffer.concat(stderrChunks).toString('utf8').trim();
      if (code !== 0) {
        const msg = stderrText
          ? `pg_dump exited with code ${code}: ${stderrText}`
          : `pg_dump exited with code ${code}`;
        this.logger.error(msg);
        child.stdout.destroy(new Error(msg));
      } else {
        this.logger.log(`pg_dump exited 0 (stderr: ${stderrText || '<empty>'})`);
      }
    });

    return child.stdout;
  }

  private parseDatabaseUrl(url: string): PgConnection {
    // Mirrors the existing pattern in the legacy `backup.service.ts`:
    // strip `+asyncpg` first so `new URL(...)` accepts the scheme.
    const normalized = url.replace('postgresql+asyncpg://', 'postgresql://');
    let parsed: URL;
    try {
      parsed = new URL(normalized);
    } catch {
      throw new Error('[s3-backup] cannot parse DATABASE_URL');
    }
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
      throw new Error(`[s3-backup] unsupported DATABASE_URL protocol: ${parsed.protocol}`);
    }
    const database = decodeURIComponent((parsed.pathname || '/').replace(/^\//, ''));
    if (!database) {
      throw new Error('[s3-backup] DATABASE_URL is missing database name');
    }
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port || '5432',
      user: decodeURIComponent(parsed.username || ''),
      password: decodeURIComponent(parsed.password || ''),
      database,
    };
  }
}
