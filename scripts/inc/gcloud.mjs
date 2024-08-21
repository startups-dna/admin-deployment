import { select } from '@inquirer/prompts';
import { $, execa } from 'execa';
import fs from 'fs';
import chalk from 'chalk';
import ora, { oraPromise } from 'ora';
import { echo } from './echo.mjs';

export async function checkGCloudCli() {
  const o = ora().start('Checking gcloud CLI...');
  try {
    await $`gcloud --version`;
    o.succeed('gcloud CLI is installed.');
  } catch (e) {
    o.fail('gcloud CLI is not installed.');
    echo.info(
      `Please install gcloud:`,
      chalk.white.underline('https://cloud.google.com/sdk/docs/install'),
    );
    process.exit(1);
  }
}

export async function gcloudAuth() {
  const o = ora().start('Authenticating gcloud...');
  try {
    const { stdout } =
      await $`gcloud auth application-default print-access-token`;
    if (!stdout) {
      throw new Error('no access token');
    }
    o.succeed('gcloud is authenticated.');
  } catch (e) {
    o.warn('gcloud authentication is required to proceed');
    await $`gcloud auth application-default login`;
  }
}

export async function checkGcloudServices() {
  await oraPromise(
    async (o) => {
      const gcpProject = getGcpDefaultProject();
      const enabledServices =
        await execa`gcloud services list --enabled --format=${'value(config.name)'} --project=${gcpProject}`.then(
          ({ stdout }) => stdout.split('\n'),
        );

      const requiredServices = [
        'compute.googleapis.com',
        'sqladmin.googleapis.com',
        'run.googleapis.com',
        'secretmanager.googleapis.com',
      ];

      const missingServices = requiredServices.filter(
        (service) => !enabledServices.includes(service),
      );

      if (missingServices.length === 0) {
        return;
      }

      for (const service of missingServices) {
        o.text = `Enabling service ${service}...`;
        await execa`gcloud services enable ${service} --project=${gcpProject}`;
      }
    },
    {
      text: 'Checking required GCP services...',
      successText: 'All required GCP services are enabled.',
    },
  );
}

export async function setGcloudServiceRoles() {
  await oraPromise(
    async () => {
      const project = getGcpDefaultProject();
      const projectNumber = await getGcloudProjectNumber(project);
      const serviceAccount = `${projectNumber}-compute@developer.gserviceaccount.com`;
      await execa`gcloud projects add-iam-policy-binding ${project} --member=serviceAccount:${serviceAccount} --role=${'roles/secretmanager.secretAccessor'}`;
      await execa`gcloud projects add-iam-policy-binding ${project} --member=serviceAccount:${serviceAccount} --role=${'roles/cloudsql.client'}`;
    },
    {
      text: 'Setting necessary GCP service roles...',
      successText: 'GCP service roles are set.',
    },
  );
}

export async function getGcloudProjectNumber(project) {
  const { stdout } =
    await $`gcloud projects describe ${project} --format=${'value(projectNumber)'}`;
  return stdout.trim();
}

export function getGcpDefaultProject() {
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    throw new Error(
      'GOOGLE_CLOUD_PROJECT env variable is not set. Make sure it is set in .env file',
    );
  }
  return process.env.GOOGLE_CLOUD_PROJECT;
}

export function getGcpDefaultRegion() {
  return process.env.GOOGLE_CLOUD_DEFAULT_REGION || 'europe-west1';
}

export function getGcloudSqlInstances(project, filter = '') {
  return execa`gcloud sql instances list --format=json --project=${project} --filter=${filter}`.then(
    ({ stdout }) => JSON.parse(stdout),
  );
}

export function getGcloudIpAddresses(project, filter = '') {
  return execa`gcloud compute addresses list --format=json --filter=${filter} --project=${project}`.then(
    ({ stdout }) => JSON.parse(stdout),
  );
}

export async function selectGcloudProject(opts = {}) {
  const projects = await $`gcloud projects list --format=json`.then(
    ({ stdout }) => JSON.parse(stdout),
  );
  return select({
    message: 'Select a GCP project:',
    ...opts,
    choices: projects.map((item) => ({
      name: `${item.name} (${item.projectId})`,
      value: item.projectId,
    })),
  });
}

export async function selectGcloudRegion(opts = {}) {
  const regions = await $`gcloud compute regions list --project=${
    opts.gcpProject
  } --format=${'value(name)'}`.then(({ stdout }) => stdout.split('\n'));
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
  const serviceAccounts =
    await $`gcloud iam service-accounts list --format=json --project=${opts.gcpProject}`.then(
      ({ stdout }) => JSON.parse(stdout),
    );
  return select({
    message: 'Select a GCP service account:',
    ...opts,
    choices: serviceAccounts.map((item) => ({
      value: item.email,
    })),
  });
}

export async function selectGcloudApiKey(opts = {}) {
  const keys =
    await $`gcloud services api-keys list --format=json --project=${opts.gcpProject}`.then(
      ({ stdout }) => JSON.parse(stdout),
    );
  if (keys.length === 0) {
    throw new Error(
      'No API keys found. Please create an API key in GCP console and rerun this command.',
    );
  }

  const apiKeyId = await select({
    message: 'Select a GCP API key:',
    ...opts,
    choices: keys.map((item) => ({
      name: `${item.displayName} (${item.createTime})`,
      value: item.uid,
    })),
  });

  const { keyString } =
    await $`gcloud services api-keys get-key-string ${apiKeyId} --format=json --project=${opts.gcpProject}`.then(
      ({ stdout }) => JSON.parse(stdout),
    );

  return keyString;
}

export async function selectGcloudSqlInstance(opts = {}) {
  const instances = await getGcloudSqlInstances(
    opts.gcpProject,
    'databaseVersion:POSTGRES_*',
  );
  if (instances.length === 0) {
    throw new Error(
      'No Cloud SQL instances found. Please create a PostgreSQL instance in GCP console and rerun this command.',
    );
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
  const { project, create, ...selectOpts } = opts;
  const addresses = await getGcloudIpAddresses(project, 'addressType=EXTERNAL');
  let choice;
  if (addresses.length > 0) {
    const choices = addresses.map((item) => ({
      name: `${item.name} (${item.address})`,
      value: item.name,
    }));

    if (create) {
      choices.push({ name: 'Create new IP address', value: '__create__' });
    }

    choice = await select({
      message: 'Select an IP address:',
      ...selectOpts,
      choices: choices,
    });
  } else {
    choice = '__create__';
  }

  if (choice === '__create__') {
    return create();
  }

  return choice;
}

export async function selectGcloudRunService(opts = {}) {
  const services =
    await execa`gcloud run services list --format=json --project=${opts.project}`.then(
      ({ stdout }) => JSON.parse(stdout),
    );
  return select({
    message: 'Select a Cloud Run service:',
    ...opts,
    choices: services.map((item) => {
      const location = item.metadata.labels['cloud.googleapis.com/location'];
      return {
        name: `${item.metadata.name} (${location})`,
        value: `${location}/${item.metadata.name}`,
      };
    }),
  });
}

export async function createServiceAccountKey({ gcpProject, serviceAccount }) {
  const accountName = serviceAccount.replace(/@.*/, '');
  const keyFile = `./config/${accountName}.json`;
  if (fs.existsSync(keyFile)) {
    echo.warn(`Service account key already exists: ${keyFile}`);
    return keyFile;
  }
  await execa({
    stdio: 'inherit',
  })`gcloud iam service-accounts keys create ${keyFile} --iam-account=${serviceAccount} --project=${gcpProject}`;
  return keyFile;
}

export async function createGlobalIp(project, addressName, description = '') {
  await execa({
    stdio: 'inherit',
  })`gcloud compute addresses create ${addressName}
    --network-tier=PREMIUM
    --ip-version=IPV4
    --global
    --description=${description}
    --project=${project}`;
  const { stdout } =
    await execa`gcloud compute addresses describe ${addressName} --format=json --global --project=${project}`;
  return JSON.parse(stdout);
}
