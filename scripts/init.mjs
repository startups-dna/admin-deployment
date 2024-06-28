import { handleError } from './inc/common.mjs';
import { checkGCloudCli, checkStateBucket, gcloudAuth } from './inc/gcloud.mjs';
import { checkPulumiCli, initGlobalConfig, checkPulumiStack, pulumiLogin } from './inc/pulumi.mjs';
import { initCompanyConfig } from './inc/company.mjs';

async function main() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();
  await checkStateBucket();
  await pulumiLogin();
  await checkPulumiStack();
  await initGlobalConfig();
  await initCompanyConfig();
}

main().catch(handleError);
