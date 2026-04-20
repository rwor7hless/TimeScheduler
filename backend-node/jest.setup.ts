/**
 * Jest setup: load the same `.env` file that ConfigModule reads at runtime so
 * integration tests see real credentials (e.g. DATABASE_URL_PRISMA,
 * USER_LOGIN, USER_PASSWORD) without having to configure them separately.
 *
 * We look at the repo-root .env first (`../.env`) and fall back to a local
 * `./.env` — same order as `AppModule`'s `ConfigModule.forRoot({envFilePath:
 * ['../.env', '.env']})`. Tests that don't touch the DB are unaffected.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

for (const candidate of [path.resolve(__dirname, '../.env'), path.resolve(__dirname, '.env')]) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
  }
}
