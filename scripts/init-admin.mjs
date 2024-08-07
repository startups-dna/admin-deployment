import { configDotenv } from 'dotenv';
import { execa } from 'execa';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { echo } from './inc/echo.mjs';
import { handleError } from './inc/common.mjs';
import { checkGCloudCli, gcloudAuth } from './inc/gcloud.mjs';
import {
  checkPulumiCli,
  checkPulumiStack,
  getPulumiStackConfig,
  getPulumiStackOutput,
  pulumiLogin
} from './inc/pulumi.mjs';

configDotenv({ override: true });

async function main() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();
  await pulumiLogin();
  await checkPulumiStack();

  echo.log('Gathering required data from stack...');
  const config = await getPulumiStackConfig();
  const output = await getPulumiStackOutput();

  const gcpProject = config['gcp:project'];
  const gcpRegion = config['gcp:region'];
  const configuratorService = output.configurator?.serviceName;
  if (!configuratorService) {
    echo.error('Configurator service not found. Make sure the stack is deployed.');
    process.exit(1);
  }
  const { stdout: configuratorUrl } = await execa`gcloud run services describe ${configuratorService} --project=${gcpProject} --region=${gcpRegion} --format=${'value(status.url)'}`;
  echo.log(`Configurator URL: ${configuratorUrl}`);

  const email = await input({
    type: 'input',
    message: 'Enter email for admin user:',
    validate: (value) => value ? true : 'Email is required',
  });

  echo.log('Obtaining GCP ID token...');
  const { stdout: gcpIdToken } = await execa`gcloud auth print-identity-token`;

  const res = await fetch(`${configuratorUrl}/api/init-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${gcpIdToken}`,
    },
    body: JSON.stringify({ email }),
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(res.statusText);
      }
      return res.json();
    })

  echo.success('Admin user initialized');
  console.log(chalk.dim(JSON.stringify(res, null, 2)));
}

main().catch(handleError);
