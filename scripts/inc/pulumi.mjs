import { $, execa } from 'execa';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { DEFAULT_STACK, PULUMI_PROJECT, PULUMI_STATE_BUCKET } from './constants.mjs';
import { echo } from './echo.mjs';
import {
  createServiceAccountKey,
  selectGcloudApiKey,
  selectGcloudProject,
  selectGcloudServiceAccount
} from './gcloud.mjs';

export async function checkPulumiCli() {
  echo.info('Checking pulumi CLI...');
  try {
    await $`pulumi version`;
    echo.success('pulumi CLI is installed');
  } catch (e) {
    echo.error('pulumi CLI is not installed');
    console.error(chalk.blue`Please install pulumi: https://www.pulumi.com/docs/install/`);
    process.exit(1);
  }
}

export async function pulumiLogin() {
  echo.info('Logging in to pulumi...');
  await execa({ stdio: 'inherit' })`pulumi login ${PULUMI_STATE_BUCKET}`;
}

export async function checkPulumiStack() {
  const stacks = await $`pulumi stack ls --project ${PULUMI_PROJECT} --json`.then(({ stdout }) => JSON.parse(stdout));
  let currentStack = stacks.find((stack) => stack.current);
  if (stacks.length === 0) {
    await initStack(DEFAULT_STACK);
    currentStack = DEFAULT_STACK;
  }

  if (!currentStack) {
    await execa({ stdio: 'inherit' })`pulumi stack select`;
  }
}

export async function initStack(stackName) {
  // create pulumi stack
  echo.info(`Initializing pulumi stack [${stackName}]...`);
  await $`pulumi stack init ${stackName}`;
}

export async function initGlobalConfig() {
  // read existing config
  const currentConfig = await getPulumiStackConfig();

  // prompt for new config
  const gcpProject = await selectGcloudProject({
    message: 'GCP project (Admin services will be deployed there)',
    default: currentConfig['gcp:project'],
    validate: (value) => !!value || 'Project is required',
  });
  const gcpRegion = await input({
    message: 'Enter GCP default region',
    default: currentConfig['gcp:region'] || 'europe-west1',
    validate: (value) => !!value || 'Region is required',
  });
  const companyName = await input({
    message: 'Enter your company name',
    default: currentConfig[`${PULUMI_PROJECT}:companyName`],
    validate: (value) => !!value || 'Company name is required',
  });
  const domain = await input({
    message: 'Enter admin domain',
    default: currentConfig[`${PULUMI_PROJECT}:domain`],
    validate: (value) => !!value || 'Domain is required',
  });
  const ipAddress = await input({
    message: 'Enter admin GCP IP address name',
    default: currentConfig[`${PULUMI_PROJECT}:ipName`],
    validate: (value) => !!value || 'IP address name is required',
  });
  const firebaseServiceAccount = await selectGcloudServiceAccount({
    gcpProject,
    message: 'Select a GCP service account for Firebase Admin:',
    default: currentConfig['firebase:serviceAccount'],
    validate: (value) => !!value || 'Service account is required',
  });
  const firebaseCredentials = await createServiceAccountKey({
    gcpProject,
    serviceAccount: firebaseServiceAccount,
  });
  const authTenantId = await input({
    message: 'Enter GCP Identity Platform tenant ID:',
    default: currentConfig['auth:tenantId'],
  });
  const firebaseApiKey = await selectGcloudApiKey({
    gcpProject,
    message: 'Select a GCP API key for Firebase Client:',
    default: currentConfig['firebase:apiKey'],
    validate: (value) => !!value || 'API key is required',
  });

  // set pulumi config
  echo.info('Setting up global configuration...');
  await $`pulumi config set gcp:project ${gcpProject}`;
  await $`pulumi config set gcp:region ${gcpRegion}`;
  await $`pulumi config set companyName ${companyName}`;
  await $`pulumi config set domain ${domain}`;
  await $`pulumi config set ipName ${ipAddress}`;
  await $`pulumi config set firebase:serviceAccount ${firebaseServiceAccount}`;
  await $`pulumi config set firebase:credentials ${firebaseCredentials}`;
  await $`pulumi config set firebase:apiKey ${firebaseApiKey}`;
  await $`pulumi config set auth:tenantId ${authTenantId}`;
  echo.success('Global configuration done');
}

export async function getPulumiStackConfig() {
  return await $`pulumi config --json`
    .then(({ stdout }) => JSON.parse(stdout))
    .then(parsePulumiConfig);
}

export async function getPulumiStackOutput() {
  return await $`pulumi stack output --json`
    .then(({ stdout }) => JSON.parse(stdout));
}

function parsePulumiConfig(config) {
  const res = {};
  Object.keys(config).forEach(key => {
    const value = config[key];
    if (typeof value !== 'object') {
      return;
    }

    if (value.value) {
      res[key] = value.value;
    }
  });

  return res;
}
