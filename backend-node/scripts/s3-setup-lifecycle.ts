/**
 * Apply (or refresh) the S3 lifecycle rule that expires backup objects under
 * the configured prefix after `BACKUP_RETENTION_DAYS` (default 84).
 *
 * The rule is `Filter.Prefix`-scoped — running this in a bucket shared with
 * other projects will NOT touch their objects. Re-running is idempotent: any
 * existing rule with the same `ID` is replaced; rules with other IDs are
 * preserved.
 *
 * Run:  npm run backup:s3:setup-lifecycle
 */
import {
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

    const desiredRule: LifecycleRule = {
      ID: config.lifecycleRuleId,
      Status: 'Enabled',
      Filter: { Prefix: config.prefix },
      Expiration: { Days: config.retentionDays },
    };

    let existingRules: LifecycleRule[] = [];
    try {
      const current = await s3.send(
        new GetBucketLifecycleConfigurationCommand({ Bucket: config.bucket }),
      );
      existingRules = current.Rules ?? [];
      console.log(`[lifecycle] found ${existingRules.length} existing rule(s)`);
    } catch (err) {
      const code =
        (err as { name?: string; Code?: string }).name ??
        (err as { name?: string; Code?: string }).Code;
      if (code === 'NoSuchLifecycleConfiguration') {
        console.log('[lifecycle] no existing lifecycle configuration');
      } else {
        throw err;
      }
    }

    // Drop our previous rule (if any) and append the desired one. Other
    // projects' rules survive untouched.
    const merged = existingRules.filter((r) => r.ID !== config.lifecycleRuleId);
    merged.push(desiredRule);

    await s3.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: config.bucket,
        LifecycleConfiguration: { Rules: merged },
      }),
    );

    console.log(
      `[lifecycle] applied: rule "${config.lifecycleRuleId}" expires ${config.prefix}* after ${config.retentionDays} days`,
    );

    const verify = await s3.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: config.bucket }),
    );
    console.log('[lifecycle] current rules:');
    console.log(JSON.stringify(verify.Rules, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
