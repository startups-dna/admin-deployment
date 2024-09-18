import { existsSync, writeFileSync } from 'node:fs';
import { configDotenv, parse } from 'dotenv';
import { readFileSync } from 'fs';
import chalk from 'chalk';
import { execa } from 'execa';
import { confirm } from '@inquirer/prompts';
import {
  checkGCloudCli,
  checkGcloudServices,
  gcloudAuth,
  getGcloudProjectNumber,
  getGcloudSqlInstances,
  getGcpDefaultProject,
  getGcpDefaultRegion,
  selectGcloudProject,
  selectGcloudRegion,
  setGcloudServiceRoles,
} from '../inc/gcloud.mjs';
import { checkStateBucket } from '../inc/stateBucket.mjs';
import { echo } from '../inc/echo.mjs';

export async function setup() {
  await checkGCloudCli();
  await gcloudAuth();
  await initEnv();
  await checkGcloudServices();
  await initEnv2();
  await setGcloudServiceRoles();
  await checkStateBucket();
  await maybeCreateSqlInstance();
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

  echo.log(`Checking for existing Postgres SQL instances...`);
  const instances = await getGcloudSqlInstances(
    project,
    'databaseVersion:POSTGRES_*',
  );
  if (instances.length > 0) {
    echo.success(`Found ${instances.length} Postgres SQL instance(s)`);
    return;
  }

  echo.log(`No Postgres SQL instances found in your project [${project}].`);
  const yes = await confirm({
    message: `Do you want this script to create a new Cloud SQL instance for you ${chalk.grey(
      '(Y)',
    )} or create manually ${chalk.grey('(n)')}?`,
  });

  if (!yes) {
    return;
  }

  const instanceId = 'main';

  echo.log(`Creating Cloud SQL instance [${instanceId}]...`);
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

async function requestAccessInfo() {
  const project = getGcpDefaultProject();
  const projectNumber = await getGcloudProjectNumber(project);
  echo.info(
    'Please share the following service account email to StartupsDNA to grant access to docker image registry:',
  );
  echo.infoBox(
    `service-${projectNumber}@serverless-robot-prod.iam.gserviceaccount.com`,
  );
}
