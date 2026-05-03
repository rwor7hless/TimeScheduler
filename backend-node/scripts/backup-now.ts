/**
 * Manual S3 backup trigger. Boots the Nest DI container without HTTP, grabs
 * `S3BackupService` and calls `.run()` once. Prints the result JSON to stdout.
 *
 * Run:  npm run backup:s3:now
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { S3BackupService } from '../src/backup/s3-backup.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const runner = app.get(S3BackupService);
    const result = await runner.run();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
