import { execa } from 'execa';
import { handleError } from './inc/common.mjs';
import { checkGCloudCli, gcloudAuth } from './inc/gcloud.mjs';
import { checkPulumiCli } from './inc/pulumi.mjs';

async function main() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();
  await execa({ stdio: 'inherit' })`pulumi up`;
}

main().catch(handleError);
