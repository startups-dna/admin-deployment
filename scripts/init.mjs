import { configDotenv } from 'dotenv';
import { handleError } from './inc/common.mjs';
import { checkGCloudCli, gcloudAuth } from './inc/gcloud.mjs';
import { checkPulumiCli, initGlobalConfig, checkPulumiStack, pulumiLogin } from './inc/pulumi.mjs';
import { initCompanyConfig } from './inc/company.mjs';
import { initAppToolsConfig } from './inc/appTools.mjs';
import { checkStateBucket } from './inc/stateBucket.mjs';

configDotenv({ override: true });

async function main() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();
  await checkStateBucket();
  await pulumiLogin();
  await checkPulumiStack();
  await initGlobalConfig();
  await initCompanyConfig();
  await initAppToolsConfig();
}

main().catch(handleError);
