import { execa } from 'execa';
import chalk from 'chalk';
import figures from 'figures';
import { input } from '@inquirer/prompts';
import { handleError } from './inc/common.mjs';
import { checkGCloudCli, gcloudAuth } from './inc/gcloud.mjs';
import { checkPulumiCli, getPulumiStackOutput } from './inc/pulumi.mjs';

process.env.PULUMI_CONFIG_PASSPHRASE_FILE = './config/passphrase.txt';

async function main() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();

  console.log(chalk.dim(`${figures.circle} Gathering required data from stack...`));
  const output = await getPulumiStackOutput();

  const configuratorUrl = output.configurator?.url;
  if (!configuratorUrl) {
    console.error(chalk.red(`${figures.cross} Configurator URL not found. Make sure the stack is deployed.`));
    process.exit(1);
  }

  const email = await input({
    type: 'input',
    message: 'Enter email for admin user:',
    validate: (value) => value ? true : 'Email is required',
  });

  console.log(chalk.dim(`${figures.circle} Obtaining GCP ID token...`));
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

  console.log(chalk.green(`${figures.tick} Admin user initialized`));
  console.log(chalk.dim(JSON.stringify(res, null, 2)));
}

main().catch(handleError);
