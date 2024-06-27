import { checkGCloudCli, checkStateBucket, gcloudAuth } from './inc/gcloud.mjs';
import { checkPulumiCli, initGlobalConfig, checkPulumiStack, pulumiLogin } from './inc/pulumi.mjs';

async function main() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();
  await checkStateBucket();
  await pulumiLogin();
  await checkPulumiStack();
  await initGlobalConfig();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
