import { select } from '@inquirer/prompts';
import { $, execa } from 'execa';
import fs from 'fs';
import { echo } from './echo.mjs';

export async function checkGCloudCli() {
  echo.info('Checking gcloud CLI...');
  try {
    await $`gcloud --version`;
    echo.success('gcloud CLI is installed');
  } catch (e) {
    echo.error('gcloud CLI is not installed. Please visit this to install: https://cloud.google.com/sdk/docs/install');
    process.exit(1);
  }
}

export async function gcloudAuth() {
  echo.info('Authenticating gcloud...');
  try {
    const { stdout } = await $`gcloud auth application-default print-access-token`;
    if (!stdout) {
      throw new Error('no access token');
    }
    echo.success('gcloud is authenticated');
  }
  catch (e) {
    echo.warn('gcloud authentication is required to proceed');
    await $`gcloud auth application-default login`;
  }
}

export function getGcpProject() {
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    throw new Error('GOOGLE_CLOUD_PROJECT env variable is not set. Make sure it is set in .env file');
  }
  return process.env.GOOGLE_CLOUD_PROJECT;
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
  const serviceAccounts = await $`gcloud iam service-accounts list --format=json --project=${opts.gcpProject}`.then(({ stdout }) => JSON.parse(stdout));
  return select({
    message: 'Select a GCP service account:',
    ...opts,
    choices: serviceAccounts.map((item) => ({
      value: item.email,
    })),
  });
}

export async function selectGcloudApiKey(opts = {}) {
  const keys = await $`gcloud services api-keys list --format=json --project=${opts.gcpProject}`.then(({ stdout }) => JSON.parse(stdout));
  const apiKeyId = await select({
    message: 'Select a GCP API key:',
    ...opts,
    choices: keys.map((item) => ({
      name: `${item.displayName} (${item.createTime})`,
      value: item.uid,
    })),
  });

  const { keyString } = await $`gcloud services api-keys get-key-string ${apiKeyId} --format=json --project=${opts.gcpProject}`.then(({ stdout }) => JSON.parse(stdout));

  return keyString;
}

export async function selectGcloudSqlInstance(opts = {}) {
  const instances = await $`gcloud sql instances list --format=json --project=${opts.gcpProject}`.then(({ stdout }) => JSON.parse(stdout));
  return select({
    message: 'Select a Cloud SQL instance:',
    ...opts,
    choices: instances.map((item) => ({
      name: `${item.name} (${item.databaseVersion})`,
      value: item.name,
    })),
  });
}

export async function createServiceAccountKey({ gcpProject, serviceAccount }) {
  const accountName = serviceAccount.replace(/@.*/, '');
  const keyFile = `./config/${accountName}.json`;
  if (fs.existsSync(keyFile)) {
    echo.warn(`Service account key already exists: ${keyFile}`);
    return keyFile;
  }
  await execa({ stdio: 'inherit' })`gcloud iam service-accounts keys create ${keyFile} --iam-account=${serviceAccount} --project=${gcpProject}`;
  return keyFile;
}
