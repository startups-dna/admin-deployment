import figures from 'figures';
import chalk from 'chalk';
import { execa } from 'execa';
import { handleError } from './inc/common.mjs';
import { checkGCloudCli, gcloudAuth } from './inc/gcloud.mjs';
import { checkPulumiCli, getPulumiStackConfig, getPulumiStackOutput } from './inc/pulumi.mjs';

process.env.PULUMI_CONFIG_PASSPHRASE_FILE = './config/passphrase.txt';

async function main() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();
  console.log(chalk.dim(`${figures.circle} Gathering required data from stack...`));
  const config = await getPulumiStackConfig();
  const output = await getPulumiStackOutput();

  console.log(chalk.dim(`${figures.circle} Running company db migration...`));
  await execa({ stdio: 'inherit' })`gcloud run jobs execute ${output.company?.dbJobName} --wait --args=npx,prisma,migrate,deploy --region=${config['gcp:region']} --project=${config['gcp:project']}`;

  if (output.appTools?.dbJobName) {
    console.log(chalk.dim(`${figures.circle} Running app-tools db migration...`));
    await execa({ stdio: 'inherit' })`gcloud run jobs execute ${output.appTools?.dbJobName} --wait --args=npx,prisma,migrate,deploy --region=${config['gcp:region']} --project=${config['gcp:project']}`;
  }
}

main().catch(handleError);
