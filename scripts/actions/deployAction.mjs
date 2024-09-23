import { checkGCloudCli, gcloudAuth } from '../inc/gcloud.mjs';
import {
  checkPulumiCli,
  checkPulumiStack,
  getPulumiStackOutput,
  pulumiLogin,
  pulumiUp,
} from '../inc/pulumi.mjs';
import {
  promptAppCmsConfig,
  promptAppToolsConfig,
  promptJiraConfig,
  promptMainConfig,
  StackConfigurator,
} from '../inc/stackConfig.mjs';
import { runMigrations } from '../inc/migrations.mjs';
import { echo } from '../inc/echo.mjs';
import chalk from 'chalk';

export async function deployAction() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();
  await pulumiLogin();
  await checkPulumiStack();
  await initStackConfig();
  await pulumiUp();
  await runMigrations();
  await dnsInfo();
}

export async function initStackConfig(alterMode) {
  echo.log('Setting up stack configuration...');
  const configurator = await StackConfigurator.create(alterMode);

  echo.log('Current stack configuration:');
  console.log('- GCP project:', chalk.bold(configurator.get('gcp:project')));
  console.log(
    '- GCP default region:',
    chalk.bold(configurator.get('gcp:region')),
  );

  await promptMainConfig(configurator);
  await promptJiraConfig(configurator);
  await promptAppToolsConfig(configurator);
  await promptAppCmsConfig(configurator);

  echo.success('Stack configuration done.');
}

async function dnsInfo() {
  const output = await getPulumiStackOutput();
  const records = [
    `${output.loadBalancer?.domain} -> ${output.loadBalancer?.ipAddress}`,
  ];

  if (output.feedbackApi?.domain && output.feedbackApi?.ipAddress) {
    records.push(
      `${output.feedbackApi?.domain} -> ${output.feedbackApi?.ipAddress}`,
    );
  }

  echo.infoBox(
    chalk.cyan`Make sure to update your DNS records with the following values:\n` +
      records.join('\n'),
  );
}
