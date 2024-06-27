import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import figures from 'figures';
import { $, execa } from 'execa';
import fs from 'fs';
import { PULUMI_STATE_BUCKET } from './constants.mjs';

export async function checkGCloudCli() {
  console.log(chalk.dim(`${figures.circle} Checking gcloud CLI...`));
  try {
    await $`gcloud --version`;
    console.log(chalk.green(`${figures.tick} gcloud is installed`));
  } catch (e) {
    console.error(chalk.red(`${figures.cross} gcloud is not installed`));
    console.error('Please install gcloud: https://cloud.google.com/sdk/docs/install');
    process.exit(1);
  }
}

export async function gcloudAuth() {
  console.log(chalk.dim(`${figures.circle} Authenticating gcloud...`));
  try {
    const { stdout } = await $`gcloud auth application-default print-access-token`;
    if (!stdout) {
      throw new Error('no access token');
    }
    console.log(chalk.green(`${figures.tick} gcloud is authenticated`));
  }
  catch (e) {
    console.error(chalk.red(`${figures.cross} gcloud reauthentication required`));
    await $`gcloud auth application-default login`;
  }
}

export async function checkStateBucket() {
  console.log(chalk.dim(`${figures.circle} Checking Pulumi state bucket ...`));
  try {
    await $`gcloud storage buckets describe ${PULUMI_STATE_BUCKET}`;
    console.log(chalk.green(`${figures.tick} Pulumi state bucket OK: ${PULUMI_STATE_BUCKET}`));
  } catch (e) {
    console.log(chalk.yellow(`Not found. Creating Pulumi state bucket [${PULUMI_STATE_BUCKET}]...`));
    await createStateBucket();
  }
}

async function createStateBucket() {
  const gcpProject = await selectGcloudProject({ message: 'Enter GCP project ID to create Pulumi state bucket:' });
  await $({ stdio: 'inherit' })`gcloud storage buckets create ${PULUMI_STATE_BUCKET} --project=${gcpProject}`;
}

export async function selectGcloudProject(opts = {}) {
  const projects = await $`gcloud projects list --format=json`.then(({ stdout }) => JSON.parse(stdout));
  return select({
    message: 'Select a GCP project:',
    ...opts,
    choices: projects.map((item) => ({
      name: `${item.name} (${item.projectNumber})`,
      value: item.projectId,
    })),
  });
}

export async function selectGcloudServiceAccount(opts = {}) {
  const serviceAccounts = await $`gcloud iam service-accounts list --format=json`.then(({ stdout }) => JSON.parse(stdout));
  return select({
    message: 'Select a GCP service account:',
    ...opts,
    choices: serviceAccounts.map((item) => ({
      value: item.email,
    })),
  });
}

export async function selectGcloudApiKey(opts = {}) {
  const keys = await $`gcloud services api-keys list --format=json`.then(({ stdout }) => JSON.parse(stdout));
  const apiKeyId = await select({
    message: 'Select a GCP API key:',
    ...opts,
    choices: keys.map((item) => ({
      name: `${item.displayName} (${item.createTime})`,
      value: item.uid,
    })),
  });

  const { keyString } = await $`gcloud services api-keys get-key-string ${apiKeyId} --format=json`.then(({ stdout }) => JSON.parse(stdout));

  return keyString;
}

export async function createServiceAccountKey(serviceAccount) {
  const accountName = serviceAccount.replace(/@.*/, '');
  const keyFile = `./config/${accountName}.json`;
  if (fs.existsSync(keyFile)) {
    console.log(chalk.yellow(`Service account key already exists: ${keyFile}`));
    return keyFile;
  }
  await execa({ stdio: 'inherit' })`gcloud iam service-accounts keys create ${keyFile} --iam-account=${serviceAccount}`;
  return keyFile;
}
