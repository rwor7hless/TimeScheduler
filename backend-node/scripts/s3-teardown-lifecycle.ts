/**
 * Remove our lifecycle rule from the bucket. Does NOT delete already-uploaded
 * objects — only stops them from being expired by the rule.
 *
 * Three branches:
 *   - No lifecycle config at all → nothing to remove.
 *   - Our rule absent → nothing to remove.
 *   - Our rule present:
 *       - If it's the only rule, `DeleteBucketLifecycleCommand`.
 *       - Otherwise `Put` with the surviving rules.
 *
 * Run:  npm run backup:s3:teardown-lifecycle
 */
import {
  DeleteBucketLifecycleCommand,
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
  type LifecycleRule,
} from '@aws-sdk/client-s3';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { S3BackupConfigService } from '../src/backup/s3-backup.config';
import { S3ClientFactory } from '../src/backup/s3-client.factory';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const config = app.get(S3BackupConfigService);
    const s3 = app.get(S3ClientFactory).getClient();

    let existingRules: LifecycleRule[] = [];
    try {
      const current = await s3.send(
        new GetBucketLifecycleConfigurationCommand({ Bucket: config.bucket }),
      );
      existingRules = current.Rules ?? [];
    } catch (err) {
      const code =
        (err as { name?: string; Code?: string }).name ??
        (err as { name?: string; Code?: string }).Code;
      if (code === 'NoSuchLifecycleConfiguration') {
        console.log('[lifecycle] no lifecycle config — nothing to remove');
        return;
      }
      throw err;
    }

    if (!existingRules.some((r) => r.ID === config.lifecycleRuleId)) {
      console.log(`[lifecycle] rule "${config.lifecycleRuleId}" not found — nothing to remove`);
      return;
    }

    const remaining = existingRules.filter((r) => r.ID !== config.lifecycleRuleId);

    if (remaining.length === 0) {
      await s3.send(new DeleteBucketLifecycleCommand({ Bucket: config.bucket }));
      console.log(
        `[lifecycle] removed "${config.lifecycleRuleId}" (was the only rule — whole config deleted)`,
      );
      return;
    }

    await s3.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: config.bucket,
        LifecycleConfiguration: { Rules: remaining },
      }),
    );
    console.log(
      `[lifecycle] removed "${config.lifecycleRuleId}", kept ${remaining.length} other rule(s)`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
