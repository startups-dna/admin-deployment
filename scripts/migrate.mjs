import { execa } from 'execa';
import { echo } from './inc/echo.mjs';
import { handleError } from './inc/common.mjs';
import { checkGCloudCli, gcloudAuth } from './inc/gcloud.mjs';
import { checkPulumiCli, getPulumiStackConfig, getPulumiStackOutput } from './inc/pulumi.mjs';

async function main() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();
  echo.info('Gathering required data from stack...');
  const config = await getPulumiStackConfig();
  const output = await getPulumiStackOutput();

  echo.info('Running company db migration...');
  await execa({ stdio: 'inherit' })`gcloud run jobs execute ${output.company?.dbJobName} --wait --args=npx,prisma,migrate,deploy --region=${config['gcp:region']} --project=${config['gcp:project']}`;

  if (output.appTools?.dbJobName) {
    echo.info('Running app-tools db migration...');
    await execa({ stdio: 'inherit' })`gcloud run jobs execute ${output.appTools?.dbJobName} --wait --args=npx,prisma,migrate,deploy --region=${config['gcp:region']} --project=${config['gcp:project']}`;
  }
}

main().catch(handleError);
