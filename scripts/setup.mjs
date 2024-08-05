import { existsSync, writeFileSync } from 'node:fs';
import { configDotenv, parse } from 'dotenv';
import generatePassword from 'generate-password';
import { handleError } from './inc/common.mjs';
import {
  checkGCloudCli,
  checkGcloudServices,
  gcloudAuth,
  getGcpProjectNumber,
  selectGcloudProject, setGcpServiceRoles
} from './inc/gcloud.mjs';
import { checkStateBucket } from './inc/stateBucket.mjs';
import { echo } from './inc/echo.mjs';
import { readFileSync } from 'fs';

async function main() {
  await checkGCloudCli();
  await gcloudAuth();
  await initEnv();
  await checkGcloudServices();
  await setGcpServiceRoles()
  await checkStateBucket();
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
      message: 'GCP project to store Pulumi state',
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

async function requestAccessInfo() {
  const projectNumber = await getGcpProjectNumber();
  echo.warn(`Please share the following service account email to StartupsDNA to grant access to docker image registry:`);
  console.log(`service-${projectNumber}@serverless-robot-prod.iam.gserviceaccount.com`);
}

main().catch(handleError);
