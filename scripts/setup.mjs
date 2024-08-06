import { existsSync, writeFileSync } from 'node:fs';
import { configDotenv, parse } from 'dotenv';
import generatePassword from 'generate-password';
import { readFileSync } from 'fs';
import chalk from 'chalk';
import { execa } from 'execa';
import { confirm } from '@inquirer/prompts';
import { handleError } from './inc/common.mjs';
import {
  checkGCloudCli,
  checkGcloudServices,
  gcloudAuth,
  getGcpDefaultProject,
  getGcpDefaultRegion,
  getGcloudSqlInstances,
  getGcloudIpAddresses,
  getGcloudProjectNumber,
  selectGcloudProject,
  selectGcloudRegion,
  setGcloudServiceRoles,
} from './inc/gcloud.mjs';
import { checkStateBucket } from './inc/stateBucket.mjs';
import { echo } from './inc/echo.mjs';

async function main() {
  await checkGCloudCli();
  await gcloudAuth();
  await initEnv();
  await checkGcloudServices();
  await initEnv2();
  await setGcloudServiceRoles()
  await checkStateBucket();
  await maybeCreateSqlInstance();
  await maybeReserveIpAddress();
  await requestAccessInfo();
}

async function initEnv() {
  // read existing .env file
  const envExists = existsSync('.env');
  let envContents = envExists ? readFileSync('.env').toString() : '';
  let hasChanges = false;
  const env = parse(envContents);

  // prompt for new config if missing
  if (!env['GOOGLE_CLOUD_PROJECT']) {
    const GOOGLE_CLOUD_PROJECT = await selectGcloudProject({
      message: 'Select default GCP project:',
      validate: (value) => !!value || 'Value is required',
    });
    envContents += `\nGOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT}`;
    hasChanges = true;
  }

  if (!env['PULUMI_CONFIG_PASSPHRASE']) {
    const PULUMI_CONFIG_PASSPHRASE = generatePassword.generate({
      length: 16,
      symbols: true,
      numbers: true,
    });
    envContents += `\nPULUMI_CONFIG_PASSPHRASE=${PULUMI_CONFIG_PASSPHRASE}`;
    hasChanges = true;
    echo.info(`Generated new Pulumi passphrase. It will be stored in .env file.`);
  }

  // write new config if changes were made
  if (hasChanges) {
    writeFileSync('.env', envContents);
    echo.success('.env file updated');
  }

  // populate process.env with new config
  configDotenv({
    override: true,
  });
}

async function initEnv2() {
  // read existing .env file
  const envExists = existsSync('.env');
  let envContents = envExists ? readFileSync('.env').toString() : '';
  let hasChanges = false;
  const env = parse(envContents);

  // prompt for new config if missing
  if (!env['GOOGLE_CLOUD_DEFAULT_REGION']) {
    const GOOGLE_CLOUD_DEFAULT_REGION = await selectGcloudRegion({
      gcpProject: getGcpDefaultProject(),
      message: 'Select default GCP region:',
      default: 'europe-west1',
      validate: (value) => !!value || 'Value is required',
    });
    envContents += `\nGOOGLE_CLOUD_DEFAULT_REGION=${GOOGLE_CLOUD_DEFAULT_REGION}`;
    hasChanges = true;
  }

  // write new config if changes were made
  if (hasChanges) {
    writeFileSync('.env', envContents);
    echo.success('.env file updated');
  }

  // populate process.env with new config
  configDotenv({
    override: true,
  });
}

async function maybeCreateSqlInstance() {
  const project = getGcpDefaultProject();
  const region = getGcpDefaultRegion();

  echo.info(`Checking for existing Postgres SQL instances...`);
  const instances = await getGcloudSqlInstances(project, 'databaseVersion:POSTGRES_*');
  if (instances.length > 0) {
    echo.success(`Found ${instances.length} Postgres SQL instance(s)`);
    return;
  }

  echo.info(`No Postgres SQL instances found in your project [${project}].`);
  const yes = await confirm({
    message: `Do you want this script to create a new Cloud SQL instance for you ${chalk.grey('(Y)')} or create manually ${chalk.grey('(n)')}?`,
  });

  if (!yes) {
    return;
  }

  const instanceId = 'main';

  echo.info(`Creating Cloud SQL instance [${instanceId}]...`);
  await execa({ stdio: 'inherit' })`gcloud sql instances create ${instanceId}
    --database-version=POSTGRES_15
    --edition=enterprise
    --tier=db-f1-micro
    --storage-size=10
    --backup
    --enable-point-in-time-recovery
    --deletion-protection
    --async
    --project=${project}
    --region=${region}`;

  echo.success(`Cloud SQL instance [${instanceId}] creation is scheduled.`);
}

async function maybeReserveIpAddress() {
  const project = getGcpDefaultProject();

  echo.info(`Checking for existing IP addresses...`);
  const addresses = await getGcloudIpAddresses(project, 'addressType=EXTERNAL');
  if (addresses.length > 0) {
    echo.success(`Found ${addresses.length} IP address(es)`);
    return;
  }

  echo.info(`No IP address reservation found in your project [${project}].`);
  const yes = await confirm({
    message: `Do you want this script to reserve a new IP address for you ${chalk.grey('(Y)')} or create manually ${chalk.grey('(n)')}?`,
  });

  if (!yes) {
    return;
  }

  const addressName = 'admin-ip';

  echo.info(`Reserving IP address [${addressName}]...`);
  await execa({ stdio: 'inherit' })`gcloud compute addresses create ${addressName}
    --network-tier=PREMIUM
    --ip-version=IPV4
    --global
    --description=${'Admin IP address'}
    --project=${project}`;
  const { stdout: ipAddress } = await execa`gcloud compute addresses describe ${addressName} --format=${'value(address)'} --global --project=${project}`;

  echo.success(`IP address [${addressName}] reserved.`);
  echo.warn(`Please, use the following IP address as A record in your DNS records: ${chalk.white(ipAddress)}.`);
}

async function requestAccessInfo() {
  const project = getGcpDefaultProject();
  const projectNumber = await getGcloudProjectNumber(project);
  echo.warn(`Please share the following service account email to StartupsDNA to grant access to docker image registry:`);
  console.log(`service-${projectNumber}@serverless-robot-prod.iam.gserviceaccount.com`);
}

main().catch(handleError);
