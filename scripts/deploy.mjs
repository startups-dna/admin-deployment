import { configDotenv } from 'dotenv';
import { handleError } from './inc/common.mjs';
import { checkGCloudCli, checkGcloudServices, gcloudAuth } from './inc/gcloud.mjs';
import { checkPulumiCli, initGlobalConfig, checkPulumiStack, pulumiLogin, pulumiUp } from './inc/pulumi.mjs';
import { initCompanyConfig } from './inc/company.mjs';
import { initAppToolsConfig } from './inc/appTools.mjs';
import { runMigrations } from './inc/migrations.mjs';

configDotenv({ override: true });

async function main() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();
  await pulumiLogin();
  await checkPulumiStack();
  await initGlobalConfig();
  await initCompanyConfig();
  await initAppToolsConfig();
  await pulumiUp();
  await runMigrations();
}

main().catch(handleError);
