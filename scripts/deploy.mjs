import { configDotenv } from 'dotenv';
import { handleError } from './inc/common.mjs';
import { checkGCloudCli, gcloudAuth } from './inc/gcloud.mjs';
import {
  checkPulumiCli,
  checkPulumiStack,
  pulumiLogin,
  pulumiUp,
} from './inc/pulumi.mjs';
import { initStackConfig } from './inc/stackConfig.mjs';
import { runMigrations } from './inc/migrations.mjs';

configDotenv({ override: true });

async function main() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();
  await pulumiLogin();
  await checkPulumiStack();
  await initStackConfig();
  await pulumiUp();
  await runMigrations();
}

main().catch(handleError);
