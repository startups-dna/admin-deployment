import { confirm } from '@inquirer/prompts';
import {
  promptAppCmsConfig,
  promptAppToolsConfig,
  promptJiraConfig,
  promptMainConfig,
  StackConfigurator,
} from '../inc/stackConfig.mjs';
import { checkGCloudCli, gcloudAuth } from '../inc/gcloud.mjs';
import {
  checkPulumiCli,
  checkPulumiStack,
  pulumiLogin,
  pulumiUp,
} from '../inc/pulumi.mjs';
import { runMigrations } from '../inc/migrations.mjs';

async function init() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();
  await pulumiLogin();
  await checkPulumiStack();
}

async function deploy() {
  if (!(await confirm({ message: 'Do you want to deploy the updates?' }))) {
    return;
  }
  await pulumiUp();
  await runMigrations();
}

export async function configMainAction() {
  await init();
  const configurator = await StackConfigurator.create(true);
  await promptMainConfig(configurator);
  await deploy();
}

export async function configJiraAction() {
  await init();
  const configurator = await StackConfigurator.create(true);
  await promptJiraConfig(configurator);
  await deploy();
}

export async function configAppToolsAction() {
  await init();
  const configurator = await StackConfigurator.create(true);
  await promptAppToolsConfig(configurator);
  await deploy();
}

export async function configAppCmsAction() {
  await init();
  const configurator = await StackConfigurator.create(true);
  await promptAppCmsConfig(configurator);
  await deploy();
}
