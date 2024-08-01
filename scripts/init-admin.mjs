import { configDotenv } from 'dotenv';
import { execa } from 'execa';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { echo } from './inc/echo.mjs';
import { handleError } from './inc/common.mjs';
import { checkGCloudCli, gcloudAuth } from './inc/gcloud.mjs';
import { checkPulumiCli, getPulumiStackOutput } from './inc/pulumi.mjs';

configDotenv({ override: true });

async function main() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();

  echo.info('Gathering required data from stack...');
  const output = await getPulumiStackOutput();

  const configuratorUrl = output.configurator?.url;
  if (!configuratorUrl) {
    echo.error('Configurator URL not found. Make sure the stack is deployed.');
    process.exit(1);
  }

  const email = await input({
    type: 'input',
    message: 'Enter email for admin user:',
    validate: (value) => value ? true : 'Email is required',
  });

  echo.info('Obtaining GCP ID token...');
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
