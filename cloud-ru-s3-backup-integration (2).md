# Подключение бэкапов Postgres в Cloud.ru Object Storage

Переносимая инструкция: как прикрутить еженедельный дамп Postgres и заливку в Cloud.ru S3 к **любому** Node.js/TypeScript-проекту. Все пути и имена вынесены в `.env` — папка (префикс) в бакете задаётся переменной `S3_PREFIX` и не зашита в код.

Ниже весь исходник готов к копипасту. За основу взято production-решение из Bug_Tracker (`src/backup/`, `scripts/s3-*.ts`). Ссылки на оригинальный код намеренно не делаются — документ самодостаточен.

---

## 0. Что получится

- `pg_dump -Fc` стримится напрямую в S3 через multipart-upload (без записи на диск).
- Расписание — `node-cron` внутри процесса приложения. Отдельный cron на хосте не нужен.
- Retention управляется **лайфсайклом бакета** (`Expiration.Days`), а не приложением. У приложения прав на `DeleteObject` нет — даже если его скомпрометируют, исторические бэкапы не сотрут.
- Уведомления о провалах — в Telegram (опционально, легко заменить на любой другой канал).
- Ручной триггер, setup/teardown lifecycle, диагностический SigV4-скрипт — отдельные npm-команды.

---

## 1. Предварительные требования

### 1.1 В Cloud.ru

1. Создать бакет (например `backups`) в сервисе Object Storage.
2. Сгенерировать пару ключей в разделе *Ключи доступа*.
3. Записать в надёжное место **три значения** (именно так, как они показаны в UI):
   - `tenant_id` — UUID аккаунта;
   - `key_id` — идентификатор ключа;
   - `secret_key` — собственно секрет.

> **ВАЖНО про формат кред.**
> В Cloud.ru `S3_ACCESS_KEY = "<tenant_id>:<key_id>"` — **связка через двоеточие**. В некоторых экранах UI светится длинное составное значение с точкой посередине — это **не секрет**, а display-identifier, его использовать НЕ надо. `S3_SECRET_KEY` — обычная hex-строка из того же диалога.
>
> Если поймаете `SignatureDoesNotMatch` — в 90% случаев проблема именно в том, что в `ACCESS_KEY` положили не ту строку. Запустите диагностический скрипт из §9.

### 1.2 На хосте/в образе

- Node.js 20+.
- В runtime-окружении приложения должен быть **`pg_dump` той же или более новой мажорной версии**, что и сервер Postgres. Для pg16 штатный `postgresql-client` из Debian bookworm не подойдёт (там 15). Ставится из PGDG — §7.
- Сеть до `https://s3.cloud.ru`.

---

## 2. Переменные окружения

Добавить в `.env.example` (и, с реальными значениями — в `.env`):

```dotenv
# --- Cloud.ru S3 (backups) ---
S3_ENDPOINT=https://s3.cloud.ru
S3_REGION=ru-central-1
S3_BUCKET=backups
S3_PREFIX=myproject/           # ПАПКА в бакете — именно её спросил пользователь
S3_ACCESS_KEY=<tenant_id>:<key_id>
S3_SECRET_KEY=<hex_secret>

# --- Канал оповещений (опционально) ---
BACKUP_NOTIFY_CHAT_ID=         # пусто — уведомления уйдут на ADMIN_TELEGRAM_ID
ADMIN_TELEGRAM_ID=             # fallback, если проект уже его использует

# --- Уже есть в проекте ---
DATABASE_URL=postgresql://user:pass@host:5432/db
```

Правила:
- `S3_PREFIX` **должен заканчиваться на `/`**. Если забыли — `config.ts` сам допишет.
- Именно `S3_PREFIX` — это «папка», про которую спрашивал пользователь. Один бакет может хранить бэкапы нескольких проектов, у каждого свой префикс. Lifecycle-правило (см. §8) тоже фильтруется по префиксу — не заденет соседей.
- Секреты в git не коммитим. `.env` — в `.gitignore`.

---

## 3. Зависимости npm

```bash
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage node-cron
npm install -D @types/node-cron
# Если используете уведомления в Telegram:
# npm install telegraf   (скорее всего уже есть)
```

Добавить в `package.json` → `scripts`:

```json
{
  "scripts": {
    "backup:now": "node dist/scripts/backup-now.js",
    "backup:setup-lifecycle": "node dist/scripts/s3-setup-lifecycle.js",
    "backup:teardown-lifecycle": "node dist/scripts/s3-teardown-lifecycle.js",
    "backup:debug-request": "node dist/scripts/s3-debug-request.js"
  }
}
```

---

## 4. Структура файлов

```
src/backup/
├── config.ts        Чтение + валидация env
├── s3Client.ts      Singleton S3Client + workaround под Cloud.ru
├── pgDump.ts        spawn pg_dump, возвращает stdout как Readable
├── runner.ts        Оркестрирует dump → upload → notify
├── scheduler.ts     node-cron wiring
└── notify.ts        Уведомления (здесь — Telegram, легко заменить)

scripts/
├── backup-now.ts              Ручной триггер
├── s3-setup-lifecycle.ts      One-time retention-правило
├── s3-teardown-lifecycle.ts   Снять retention-правило
└── s3-debug-request.ts        Сырой SigV4-запрос для диагностики 403
```

---

## 5. Исходный код (копипаст)

### 5.1 `src/backup/config.ts`

```ts
export interface BackupConfig {
  s3: {
    endpoint: string;
    region: string;
    bucket: string;
    prefix: string;
    accessKey: string;
    secretKey: string;
  };
  notifyChatId: string | null;
  databaseUrl: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[backup] Missing required env var: ${name}`);
  }
  return value;
}

function normalizePrefix(prefix: string): string {
  if (!prefix) return "";
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

export function loadBackupConfig(): BackupConfig {
  const prefix = normalizePrefix(required("S3_PREFIX"));
  const notifyChatId =
    process.env.BACKUP_NOTIFY_CHAT_ID || process.env.ADMIN_TELEGRAM_ID || null;

  return {
    s3: {
      endpoint: required("S3_ENDPOINT"),
      region: required("S3_REGION"),
      bucket: required("S3_BUCKET"),
      prefix,
      accessKey: required("S3_ACCESS_KEY"),
      secretKey: required("S3_SECRET_KEY"),
    },
    notifyChatId,
    databaseUrl: required("DATABASE_URL"),
  };
}
```

### 5.2 `src/backup/s3Client.ts` — тут главный workaround под Cloud.ru

**Почему это нужно.** AWS SDK v3 по умолчанию кладёт в запрос заголовки `x-amz-sdk-checksum-algorithm`, `amz-sdk-invocation-id`, `amz-sdk-request`, `x-amz-user-agent`, `x-amz-checksum-*` и подписывает их в SigV4. Cloud.ru эти заголовки может отбросить по дороге — подпись становится невалидной и прилетает `SignatureDoesNotMatch`. Решение — middleware, которая срезает их **до** подписывающей middleware.

```ts
import { S3Client } from "@aws-sdk/client-s3";
import { loadBackupConfig } from "./config.js";

let _client: S3Client | null = null;

const HEADERS_TO_STRIP_EXACT = new Set([
  "x-amz-sdk-checksum-algorithm",
  "amz-sdk-invocation-id",
  "amz-sdk-request",
  "x-amz-user-agent",
]);
const HEADERS_TO_STRIP_PREFIX = ["x-amz-checksum-"];

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
  (next: (args: unknown) => unknown) => async (args: unknown) => {
    const request = (args as { request?: { headers?: Record<string, unknown> } }).request;
    if (request?.headers) stripHeaders(request.headers);
    return next(args);
  };

export function getS3Client(): S3Client {
  if (_client) return _client;

  const { s3 } = loadBackupConfig();
  const client = new S3Client({
    endpoint: s3.endpoint,
    region: s3.region,
    forcePathStyle: true, // Cloud.ru любит path-style
    credentials: {
      accessKeyId: s3.accessKey,
      secretAccessKey: s3.secretKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  // Сначала добавляем strip в build-шаг (на всякий случай)
  client.middlewareStack.add(stripMiddleware as never, {
    step: "build",
    name: "stripCloudRuHeadersBuild",
  });

  // Главное — попасть ПЕРЕД подписывающей middleware.
  // Имя signer'а в разных версиях SDK отличается — пробуем по порядку.
  let positionedBeforeSigner = false;
  for (const signerName of ["awsAuthMiddleware", "httpSigningMiddleware", "signingMiddleware"]) {
    try {
      client.middlewareStack.addRelativeTo(stripMiddleware as never, {
        name: `stripCloudRuHeadersBefore_${signerName}`,
        relation: "before",
        toMiddleware: signerName,
      });
      positionedBeforeSigner = true;
      break;
    } catch {
      // этого signer'а нет — пробуем следующий
    }
  }

  if (!positionedBeforeSigner) {
    client.middlewareStack.add(stripMiddleware as never, {
      step: "finalizeRequest",
      name: "stripCloudRuHeadersFinalizeFallback",
      priority: "low",
    });
  }

  if (process.env.S3_DEBUG === "1") {
    const stack = client.middlewareStack.identify();
    console.log("[S3-DEBUG] middleware stack (" + stack.length + " items):");
    for (const line of stack) console.log("  " + line);
    console.log(`[S3-DEBUG] stripper positionedBeforeSigner=${positionedBeforeSigner}`);

    client.middlewareStack.add(
      (next) => async (args) => {
        const req = args.request as {
          method?: string; hostname?: string; path?: string;
          query?: Record<string, unknown>; headers?: Record<string, unknown>;
        };
        console.log("\n[S3-DEBUG] ===== Outgoing =====");
        console.log(`[S3-DEBUG] ${req.method} https://${req.hostname}${req.path}`);
        if (req.query && Object.keys(req.query).length) console.log("[S3-DEBUG] query:", req.query);
        console.log("[S3-DEBUG] headers:", req.headers);
        try { return await next(args); }
        catch (err) { console.log("[S3-DEBUG] error:", err); throw err; }
      },
      { step: "finalizeRequest", name: "debugLogger", priority: "low" },
    );
  }

  _client = client;
  return _client;
}
```

### 5.3 `src/backup/pgDump.ts`

```ts
import { spawn } from "child_process";
import { Readable } from "stream";

interface PgConnection {
  host: string; port: string; user: string; password: string; database: string;
}

function parseDatabaseUrl(url: string): PgConnection {
  const parsed = new URL(url);
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`[backup] Unsupported DATABASE_URL protocol: ${parsed.protocol}`);
  }
  const database = parsed.pathname.replace(/^\//, "");
  if (!database) throw new Error(`[backup] DATABASE_URL is missing database name`);
  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
}

export function streamPgDump(databaseUrl: string): Readable {
  const conn = parseDatabaseUrl(databaseUrl);
  const child = spawn(
    "pg_dump",
    [
      "-h", conn.host, "-p", conn.port,
      "-U", conn.user, "-d", conn.database,
      "-Fc", "--no-owner", "--no-privileges",
    ],
    {
      env: { ...process.env, PGPASSWORD: conn.password },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const stderrChunks: Buffer[] = [];
  child.stderr.on("data", (c: Buffer) => stderrChunks.push(c));

  child.on("error", (err) => child.stdout.destroy(err));
  child.on("close", (code) => {
    if (code !== 0) {
      const stderrText = Buffer.concat(stderrChunks).toString("utf8").trim();
      const msg = stderrText
        ? `pg_dump exited with code ${code}: ${stderrText}`
        : `pg_dump exited with code ${code}`;
      child.stdout.destroy(new Error(msg));
    }
  });

  return child.stdout;
}
```

### 5.4 `src/backup/runner.ts`

```ts
import { Upload } from "@aws-sdk/lib-storage";
import { loadBackupConfig } from "./config.js";
import { getS3Client } from "./s3Client.js";
import { streamPgDump } from "./pgDump.js";
import { notifyFailure } from "./notify.js";

export interface BackupResult { key: string; size: number; durationMs: number; }

function timestampKey(prefix: string): string {
  // UTC в ключе: двоеточия заменены на дефисы, чтобы не ломаться на Windows при скачивании.
  const iso = new Date().toISOString().replace(/:/g, "-").replace(/\.\d+Z$/, "Z");
  return `${prefix}db-${iso}.dump`;
}

export async function runBackup(): Promise<BackupResult> {
  const config = loadBackupConfig();
  const key = timestampKey(config.s3.prefix);
  const startedAt = Date.now();

  console.log(`[backup] start -> s3://${config.s3.bucket}/${key}`);

  const dumpStream = streamPgDump(config.databaseUrl);

  try {
    const upload = new Upload({
      client: getS3Client(),
      params: {
        Bucket: config.s3.bucket,
        Key: key,
        Body: dumpStream,
        ContentType: "application/octet-stream",
      },
      queueSize: 4,
      partSize: 5 * 1024 * 1024, // 5 MiB — минимальный part для S3
    });

    let size = 0;
    dumpStream.on("data", (chunk: Buffer) => { size += chunk.length; });

    await upload.done();
    const durationMs = Date.now() - startedAt;
    console.log(`[backup] done -> key=${key} size=${size}B duration=${durationMs}ms`);
    return { key, size, durationMs };
  } catch (err) {
    console.error("[backup] failed:", err);
    await notifyFailure(config.notifyChatId, err);
    throw err;
  }
}
```

### 5.5 `src/backup/scheduler.ts`

```ts
import cron from "node-cron";
import { runBackup } from "./runner.js";

const CRON_EXPRESSION = "0 9 * * 0";   // воскресенье 09:00
const TIMEZONE = "Europe/Moscow";

export function startBackupScheduler(): void {
  cron.schedule(
    CRON_EXPRESSION,
    async () => {
      try { await runBackup(); }
      catch (err) { console.error("[backup] scheduled run failed:", err); }
    },
    {
      timezone: TIMEZONE,
      noOverlap: true, // если предыдущий запуск ещё идёт — новый не стартует
      name: "s3-backup",
    },
  );
  console.log(`[backup] scheduler started (cron="${CRON_EXPRESSION}" tz=${TIMEZONE})`);
}
```

### 5.6 `src/backup/notify.ts` — Telegram (подмените на что угодно)

```ts
import { getBot } from "../bot/botInstance.js"; // ← адаптируйте под свой проект

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${(((ms % 60_000) / 1000) | 0)}s`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function send(chatId: string | null, text: string): Promise<void> {
  if (!chatId) return;
  const bot = getBot();
  if (!bot) { console.warn("[backup] notify skipped: bot not initialized"); return; }
  try { await bot.telegram.sendMessage(chatId, text, { parse_mode: "HTML" }); }
  catch (err) { console.error("[backup] failed to send Telegram notification:", err); }
}

export async function notifyFailure(chatId: string | null, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await send(chatId, `<b>Backup failed</b>\n<code>${escapeHtml(message)}</code>`);
}

export async function notifySuccess(
  chatId: string | null,
  meta: { key: string; size: number; durationMs: number },
): Promise<void> {
  await send(chatId, [
    "<b>Backup uploaded</b>",
    `key: <code>${escapeHtml(meta.key)}</code>`,
    `size: ${formatBytes(meta.size)}`,
    `duration: ${formatDuration(meta.durationMs)}`,
  ].join("\n"));
}
```

> Если у проекта нет Telegram-бота — замените тело `send()` на вызов webhook, лог в Sentry, e-mail или просто `console.error` и удалите импорт `getBot`. `runner.ts` всё равно `await`-ит `notifyFailure` и ловит его ошибки неявно.

### 5.7 `scripts/backup-now.ts` — ручной триггер

```ts
import { runBackup } from "../src/backup/runner.js";

async function main(): Promise<void> {
  const result = await runBackup();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
```

### 5.8 `scripts/s3-setup-lifecycle.ts` — retention на бакете

Правило навешивается **на префикс**, а не на весь бакет. Поэтому безопасно запускать в бакете, где лежат бэкапы других проектов. Константу `RULE_ID` поменяйте под имя проекта, а `RETENTION_DAYS` — под нужный срок хранения.

```ts
import {
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
  type LifecycleRule,
} from "@aws-sdk/client-s3";
import { loadBackupConfig } from "../src/backup/config.js";
import { getS3Client } from "../src/backup/s3Client.js";

const RULE_ID = "myproject-retention";   // ← поменяйте под свой проект
const RETENTION_DAYS = 84;               // 12 недель

async function main(): Promise<void> {
  const config = loadBackupConfig();
  const s3 = getS3Client();

  const desiredRule: LifecycleRule = {
    ID: RULE_ID,
    Status: "Enabled",
    Filter: { Prefix: config.s3.prefix },
    Expiration: { Days: RETENTION_DAYS },
  };

  let existingRules: LifecycleRule[] = [];
  try {
    const current = await s3.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: config.s3.bucket }),
    );
    existingRules = current.Rules ?? [];
    console.log(`[lifecycle] found ${existingRules.length} existing rule(s)`);
  } catch (err) {
    const code = (err as { name?: string; Code?: string }).name
      || (err as { name?: string; Code?: string }).Code;
    if (code === "NoSuchLifecycleConfiguration") {
      console.log(`[lifecycle] no existing lifecycle configuration`);
    } else { throw err; }
  }

  // merge: удаляем своё правило (если было) и добавляем заново — чужие не трогаем
  const merged = existingRules.filter((r) => r.ID !== RULE_ID);
  merged.push(desiredRule);

  await s3.send(new PutBucketLifecycleConfigurationCommand({
    Bucket: config.s3.bucket,
    LifecycleConfiguration: { Rules: merged },
  }));

  console.log(`[lifecycle] applied: rule "${RULE_ID}" expires ${config.s3.prefix}* after ${RETENTION_DAYS} days`);

  const verify = await s3.send(
    new GetBucketLifecycleConfigurationCommand({ Bucket: config.s3.bucket }),
  );
  console.log("[lifecycle] current rules:");
  console.log(JSON.stringify(verify.Rules, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
```

### 5.9 `scripts/s3-teardown-lifecycle.ts` — снять retention

Важный момент — **не удаляет уже залитые объекты**, только отключает правило истечения.

```ts
import {
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
  DeleteBucketLifecycleCommand,
  type LifecycleRule,
} from "@aws-sdk/client-s3";
import { loadBackupConfig } from "../src/backup/config.js";
import { getS3Client } from "../src/backup/s3Client.js";

const RULE_ID = "myproject-retention"; // то же имя, что в setup

async function main(): Promise<void> {
  const config = loadBackupConfig();
  const s3 = getS3Client();

  let existingRules: LifecycleRule[] = [];
  try {
    const current = await s3.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: config.s3.bucket }),
    );
    existingRules = current.Rules ?? [];
  } catch (err) {
    const code = (err as { name?: string; Code?: string }).name
      || (err as { name?: string; Code?: string }).Code;
    if (code === "NoSuchLifecycleConfiguration") {
      console.log(`[lifecycle] no lifecycle config — nothing to remove`);
      return;
    }
    throw err;
  }

  if (!existingRules.some((r) => r.ID === RULE_ID)) {
    console.log(`[lifecycle] rule "${RULE_ID}" not found — nothing to remove`);
    return;
  }

  const remaining = existingRules.filter((r) => r.ID !== RULE_ID);

  if (remaining.length === 0) {
    await s3.send(new DeleteBucketLifecycleCommand({ Bucket: config.s3.bucket }));
    console.log(`[lifecycle] removed "${RULE_ID}" (was the only rule — whole config deleted)`);
    return;
  }

  await s3.send(new PutBucketLifecycleConfigurationCommand({
    Bucket: config.s3.bucket,
    LifecycleConfiguration: { Rules: remaining },
  }));
  console.log(`[lifecycle] removed "${RULE_ID}", kept ${remaining.length} other rule(s)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

### 5.10 `scripts/s3-debug-request.ts` — сырая SigV4-подпись

Когда AWS SDK возвращает `SignatureDoesNotMatch` — непонятно, что именно не так: не тот регион, не тот формат access key, виртуальный vs path-style хост, кодировка payload-hash. Этот скрипт обходит SDK целиком, подписывает запрос руками и печатает результат по десятку вариантов. В продакшене не нужен, но бесценен при первичной настройке.

Код объёмный — возьмите целиком из Bug_Tracker (`scripts/s3-debug-request.ts`) и подложите к себе.

---

## 6. Wiring в entry point приложения

```ts
// src/index.ts (или аналог)
import { startBackupScheduler } from "./backup/scheduler.js";

// ...инициализация приложения...

startBackupScheduler();
```

Планировщик сам не запускает бэкап при старте — только регистрирует cron. Первый прогон случится по расписанию, а проверить интеграцию руками можно через `npm run backup:now`.

---

## 7. Dockerfile — `pg_dump` в runtime-образе

Если используете Docker и Postgres 16, штатный `postgresql-client` из `node:20-slim` (Debian bookworm) — версии 15. `pg_dump 15` **не может** дампить сервер 16 (скажет `server version mismatch`). Берём клиент из PGDG:

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc

FROM node:20-slim
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates gnupg wget lsb-release && \
    install -d /usr/share/postgresql-common/pgdg && \
    wget -qO /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
         https://www.postgresql.org/media/keys/ACCC4CF8.asc && \
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
          https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
         > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends postgresql-client-16 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/src/index.js"]
```

Номер клиента (`postgresql-client-16`) подгоните под версию сервера. Для pg15 достаточно штатного `postgresql-client`.

---

## 8. Первичная настройка (чек-лист)

1. В Cloud.ru UI создать бакет и пару ключей. Скопировать `tenant_id`, `key_id`, `secret_key`.
2. Заполнить `.env` всеми переменными из §2.
3. `npm install` — подтянет новые зависимости.
4. Пересобрать образ/перезапустить процесс — в логах должна появиться строка `[backup] scheduler started`.
5. `npm run backup:now` (или `docker compose exec app npm run backup:now`). В логах — `[backup] done -> key=...`. В бакете — объект `<S3_PREFIX>db-<ts>.dump` с ненулевым размером.
6. `npm run backup:setup-lifecycle` — один раз. В выводе должен напечататься применённый `Rules` JSON.
7. (опционально) Тест провала: временно поставить `S3_SECRET_KEY=broken`, запустить `backup:now` — ждём non-zero exit и уведомление в Telegram.

---

## 9. Диагностика — что делать, если не заработало

### `SignatureDoesNotMatch`

1. Проверить формат `S3_ACCESS_KEY` — обязательно `tenant_id:key_id` через двоеточие. Не путать с display-identifier'ом с точкой.
2. Запустить `S3_DEBUG=1 npm run backup:now` — выведется middleware stack и финальные заголовки. Убедиться, что в `headers` **нет** `x-amz-sdk-*`, `amz-sdk-*`, `x-amz-user-agent`, `x-amz-checksum-*`.
3. Если всё равно не подписывается — `npm run backup:debug-request`. Скрипт перебирает регионы (`ru-central-1`, `ru-1`, `us-east-1`), service (`s3`/`s3e`), virtual vs path-style, payload-hash `UNSIGNED-PAYLOAD`. Тот вариант, что вернёт 200 — правильная комбинация.

### `pg_dump: server version mismatch`

Установлен `postgresql-client` младше сервера. В Dockerfile поставьте нужный `postgresql-client-<N>` из PGDG (§7). Проверка: `docker compose exec app pg_dump --version`.

### `NoSuchBucket`

Проверить, что бакет реально создан, `S3_BUCKET` совпадает по регистру, и у ключа есть доступ на этот бакет (в Cloud.ru это настраивается отдельно).

### Пустой/крошечный дамп

`pg_dump` выполнился, но БД пустая или вы подключились не к той базе. Проверьте `DATABASE_URL` и количество записей: `psql $DATABASE_URL -c '\dt'`.

### Бэкапы не удаляются по истечении N дней

Lifecycle-правило не применено или префикс в правиле не совпадает с префиксом объектов. `npm run backup:setup-lifecycle` — идемпотентный, можно запустить повторно и проверить JSON в stdout.

---

## 10. Восстановление из дампа

Обязательно порепетируйте один раз на тестовой БД. **Непроверенный бэкап — это не бэкап.**

```bash
# 1. Скачать последний дамп
aws s3 cp s3://$S3_BUCKET/$S3_PREFIX/db-<ts>.dump ./restore.dump \
  --endpoint-url https://s3.cloud.ru

# 2. Поднять чистый Postgres на свободном порту
docker run --rm -d --name pg-restore \
  -e POSTGRES_USER=myuser -e POSTGRES_PASSWORD=mypass -e POSTGRES_DB=mydb \
  -p 5433:5432 postgres:16
  # Если в проекте используется pgvector — образ pgvector/pgvector:pg16

# 3. Если нужны расширения (pgvector, pg_trgm и т.п.) — создать их
#    pg_dump -Fc ссылается на типы расширений, но CREATE EXTENSION не пишет:
docker exec pg-restore psql -U myuser -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 4. Восстановить
pg_restore -h localhost -p 5433 -U myuser -d mydb \
  --no-owner --no-privileges ./restore.dump

# 5. Смоук-чек
psql postgresql://myuser:mypass@localhost:5433/mydb -c '\dt'
```

Для реального disaster recovery — то же самое, но target — продакшен-БД. Предварительно снимите нагрузку, отключите приложение, обрежьте схему (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;` — если нужен чистый старт) и повторите шаги 4–5.

---

## 11. Что НЕ делает этот сетап

Честный список ограничений — чтобы не было сюрпризов:

- **Не инкрементальный.** Каждую неделю — полный дамп. Для проектов объёмом > 50 ГБ стоит посмотреть в сторону WAL-shipping / `pg_basebackup` + архивирование WAL.
- **Не алертит на отсутствие бэкапа.** Если приложение упало и пропустило воскресенье — никто не заметит. Как минимум, можно прикрутить внешний мониторинг (healthcheck) с проверкой `LastModified` самого свежего объекта.
- **Не шифрует дампы на клиенте.** Полагаемся на server-side encryption Cloud.ru. Если нужны более жёсткие требования — добавить GPG/age-шифрование перед upload.
- **Не включает файлы приложения** (загруженные картинки, uploaded files). Если в проекте есть такой слой и он важен — добавьте второй pipeline (s3 sync / rsync).
- **Не реплицирует бэкапы в другой регион/провайдер.** Для критичных систем стоит повторно лить дамп в B2/Wasabi/другой Cloud.ru регион.

---

## 12. Краткая шпаргалка команд

| Команда                         | Что делает                                                  |
|---------------------------------|-------------------------------------------------------------|
| `npm run backup:now`            | Прямо сейчас сделать и залить дамп                          |
| `npm run backup:setup-lifecycle`| Включить retention на `S3_PREFIX` (запустить один раз)      |
| `npm run backup:teardown-lifecycle` | Снять retention (не удаляет уже залитое)                |
| `npm run backup:debug-request`  | Перебрать варианты SigV4-подписи при 403                    |
| `S3_DEBUG=1 npm run backup:now` | Запустить с полным логированием middleware stack и запросов |

---

## 13. Финальная проверка перед тем, как считать всё готовым

- [ ] `npm run backup:now` проходит, объект появился в `s3://$S3_BUCKET/$S3_PREFIX/`.
- [ ] Размер объекта адекватен объёму данных в БД.
- [ ] Рехерсал восстановления по §10 прошёл, счётчики строк совпали с прод-БД.
- [ ] Телеграм получает сообщение при `S3_SECRET_KEY=broken`.
- [ ] `docker compose exec app pg_dump --version` репортит нужную мажорную версию.
- [ ] В логах приложения на старте есть `[backup] scheduler started`.
- [ ] Lifecycle-правило применено и видно в выводе `backup:setup-lifecycle`.
