import { select } from '@inquirer/prompts';
import { $, execa } from 'execa';
import fs from 'fs';
import chalk from 'chalk';
import { echo } from './echo.mjs';

export async function checkGCloudCli() {
  echo.log('Checking gcloud CLI...');
  try {
    await $`gcloud --version`;
    echo.success('gcloud CLI is installed');
  } catch (e) {
    echo.error('gcloud CLI is not installed.');
    echo.info(`Please install gcloud:`, chalk.white.underline('https://cloud.google.com/sdk/docs/install'));
    process.exit(1);
  }
}

export async function gcloudAuth() {
  echo.log('Authenticating gcloud...');
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

export async function checkGcloudServices() {
  const gcpProject = getGcpDefaultProject();

  echo.log(`Checking enabled GCP services...`);
  const enabledServices = await execa`gcloud services list --enabled --format=${'value(config.name)'} --project=${gcpProject}`
    .then(({ stdout }) => stdout.split('\n'));

  const requiredServices = [
    'compute.googleapis.com',
    'sqladmin.googleapis.com',
    'run.googleapis.com',
    'secretmanager.googleapis.com',
  ];

  const missingServices = requiredServices.filter((service) => !enabledServices.includes(service));

  if (missingServices.length === 0) {
    echo.success('All required GCP services are enabled.');
    return;
  }

  for (const service of missingServices) {
    echo.log(`Enabling service ${service}...`);
    await execa`gcloud services enable ${service} --project=${gcpProject}`;
  }
}

export async function setGcloudServiceRoles() {
  const project = getGcpDefaultProject();
  const projectNumber = await getGcloudProjectNumber(project);
  const serviceAccount = `${projectNumber}-compute@developer.gserviceaccount.com`;
  echo.log(`Setting necessary service roles for ${serviceAccount}...`);
  await execa`gcloud projects add-iam-policy-binding ${project} --member=serviceAccount:${serviceAccount} --role=${'roles/secretmanager.secretAccessor'}`;
  await execa`gcloud projects add-iam-policy-binding ${project} --member=serviceAccount:${serviceAccount} --role=${'roles/cloudsql.client'}`;
}

export async function getGcloudProjectNumber(project) {
  const { stdout } = await $`gcloud projects describe ${project} --format=${'value(projectNumber)'}`;
  return stdout.trim();
}

export function getGcpDefaultProject() {
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    throw new Error('GOOGLE_CLOUD_PROJECT env variable is not set. Make sure it is set in .env file');
  }
  return process.env.GOOGLE_CLOUD_PROJECT;
}

export function getGcpDefaultRegion() {
  return process.env.GOOGLE_CLOUD_DEFAULT_REGION || 'europe-west1';
}

export function getGcloudSqlInstances(project, filter = '') {
  return execa`gcloud sql instances list --format=json --project=${project} --filter=${filter}`.then(({ stdout }) => JSON.parse(stdout));
}

export function getGcloudIpAddresses(project, filter = '') {
  return execa`gcloud compute addresses list --format=json --filter=${filter} --project=${project}`.then(({ stdout }) => JSON.parse(stdout));
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

export async function selectGcloudRegion(opts = {}) {
  const regions = await $`gcloud compute regions list --project=${opts.gcpProject} --format=${'value(name)'}`.then(({ stdout }) => stdout.split('\n'));
  return select({
    message: 'Select a GCP region:',
    ...opts,
    choices: regions.map((region) => ({
      name: region,
      value: region,
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
  if (keys.length === 0) {
    throw new Error('No API keys found. Please create an API key in GCP console and rerun this command.');
  }

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
  const instances = await getGcloudSqlInstances(opts.gcpProject, 'databaseVersion:POSTGRES_*');
  if (instances.length === 0) {
    throw new Error('No Cloud SQL instances found. Please create a PostgreSQL instance in GCP console and rerun this command.');
  }

  return select({
    message: 'Select a Cloud SQL instance:',
    ...opts,
    choices: instances.map((item) => ({
      name: `${item.name} (${item.databaseVersion})`,
      value: item.name,
    })),
  });
}

export async function selectGcloudIpAddress(opts = {}) {
  const addresses = await getGcloudIpAddresses(opts.project, 'addressType=EXTERNAL');
  if (addresses.length === 0) {
    throw new Error('No IP addresses found. Please reserve a global external IP address in GCP console and rerun this command.');
  }

  return select({
    message: 'Select an IP address:',
    ...opts,
    choices: addresses.map((item) => ({
      name: `${item.name} (${item.address})`,
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
