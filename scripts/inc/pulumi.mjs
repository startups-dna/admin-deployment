import { $, execa } from 'execa';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { DEFAULT_STACK, PULUMI_PROJECT } from './constants.mjs';
import { echo } from './echo.mjs';
import {
  createServiceAccountKey,
  getGcpProject,
  selectGcloudApiKey,
  selectGcloudProject,
  selectGcloudServiceAccount
} from './gcloud.mjs';
import { getStateBucketId } from './stateBucket.mjs';

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
  const stateBucketId = getStateBucketId();
  await execa({ stdio: 'inherit' })`pulumi login ${stateBucketId}`;
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
  echo.info('Setting up global configuration...');

  // read existing config
  const currentConfig = await getPulumiStackConfig();

  // prompt for new config and set it

  const gcpProject = await selectGcloudProject({
    message: 'GCP project (Admin services will be deployed there)',
    default: currentConfig['gcp:project'] || getGcpProject(),
    validate: (value) => !!value || 'Project is required',
  });
  await $`pulumi config set gcp:project ${gcpProject}`;

  const gcpRegion = await input({
    message: 'Enter GCP default region',
    default: currentConfig['gcp:region'] || 'europe-west1',
    validate: (value) => !!value || 'Region is required',
  });
  await $`pulumi config set gcp:region ${gcpRegion}`;

  const companyName = await input({
    message: 'Enter your company name',
    default: currentConfig[`${PULUMI_PROJECT}:companyName`],
    validate: (value) => !!value || 'Company name is required',
  });
  await $`pulumi config set companyName ${companyName}`;

  const domain = await input({
    message: 'Enter admin domain',
    default: currentConfig[`${PULUMI_PROJECT}:domain`],
    validate: (value) => !!value || 'Domain is required',
  });
  await $`pulumi config set domain ${domain}`;

  const ipName = await input({
    message: 'Enter admin GCP IP address name',
    default: currentConfig[`${PULUMI_PROJECT}:ipName`],
    validate: (value) => !!value || 'IP address name is required',
  });
  await $`pulumi config set ipName ${ipName}`;

  // const firebaseServiceAccount = await selectGcloudServiceAccount({
  //   gcpProject,
  //   message: 'Select a GCP service account for Firebase Admin:',
  //   default: currentConfig['firebase:serviceAccount'],
  //   validate: (value) => !!value || 'Service account is required',
  // });
  // await $`pulumi config set firebase:serviceAccount ${firebaseServiceAccount}`;

  // const firebaseCredentials = await createServiceAccountKey({
  //   gcpProject,
  //   serviceAccount: firebaseServiceAccount,
  // });
  // await $`pulumi config set firebase:credentials ${firebaseCredentials}`;

  const authTenantId = await input({
    message: 'Enter GCP Identity Platform tenant ID:',
    default: currentConfig['auth:tenantId'],
  });
  await $`pulumi config set auth:tenantId ${authTenantId}`;

  const firebaseApiKey = await selectGcloudApiKey({
    gcpProject,
    message: 'Select a GCP API key for Firebase Client:',
    default: currentConfig['firebase:apiKey'],
    validate: (value) => !!value || 'API key is required',
  });
  await $`pulumi config set firebase:apiKey ${firebaseApiKey}`;

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

export async function pulumiUp() {
  await execa({ stdio: 'inherit' })`pulumi up`;
}
