import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import figures from 'figures';
import { getPulumiStackConfig } from './pulumi.mjs';
import { $ } from 'execa';
import { selectGcloudSqlInstance } from './gcloud.mjs';

export async function initCompanyConfig() {
  // read existing config
  const currentConfig = await getPulumiStackConfig();

  const enabled = await confirm({
    message: 'Enable Company Service?',
    default: currentConfig['company:enabled'] === 'true' || false,
  });
  await $`pulumi config set company:enabled ${enabled ? 'true' : 'false'}`;

  // if (!enabled) {
  //   return;
  // }

  const sqlInstance = await selectGcloudSqlInstance({
    gcpProject: currentConfig['gcp:project'],
    message: 'Select a Cloud SQL instance for Company service:',
    default: currentConfig['company:sqlInstance'],
    validate: (value) => !!value || 'Value is required',
  });
  await $`pulumi config set company:sqlInstance ${sqlInstance}`;

  console.log(chalk.green(`${figures.tick} Company service configuration done`));
}