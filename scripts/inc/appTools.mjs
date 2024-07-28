import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import figures from 'figures';
import { $ } from 'execa';
import { getPulumiStackConfig } from './pulumi.mjs';
import { selectGcloudSqlInstance } from './gcloud.mjs';

export async function initAppToolsConfig() {
  // read existing config
  const currentConfig = await getPulumiStackConfig();

  const enabled = await confirm({
    message: 'Enable App Tools Service?',
    default: currentConfig['app-tools:enabled'] === 'true' || false,
  });
  await $`pulumi config set app-tools:enabled ${enabled ? 'true' : 'false'}`;

  if (!enabled) {
    return;
  }

  const sqlInstance = await selectGcloudSqlInstance({
    gcpProject: currentConfig['gcp:project'],
    message: 'Select a Cloud SQL instance for App Tools service:',
    default: currentConfig['app-tools:sqlInstance'],
    validate: (value) => !!value || 'Value is required',
  });
  await $`pulumi config set app-tools:sqlInstance ${sqlInstance}`;

  console.log(chalk.green(`${figures.tick} App Tools service configuration done`));
}