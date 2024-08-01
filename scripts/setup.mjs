import { writeFileSync } from 'node:fs';
import { configDotenv } from 'dotenv';
import { password } from '@inquirer/prompts';
import { handleError } from './inc/common.mjs';
import { checkGCloudCli, gcloudAuth, selectGcloudProject } from './inc/gcloud.mjs';
import { checkStateBucket } from './inc/stateBucket.mjs';
import { echo } from './inc/echo.mjs';

async function main() {
  await checkGCloudCli();
  await gcloudAuth();
  await initEnv();
  await checkStateBucket();
}

async function initEnv() {
  const env = {};
  // read existing .env file
  configDotenv({
    processEnv: env,
  });

  // prompt for new config
  const GOOGLE_CLOUD_PROJECT = await selectGcloudProject({
    message: 'GCP project to store Pulumi state',
    default: env['GOOGLE_CLOUD_PROJECT'],
    validate: (value) => !!value || 'Value is required',
  });

  const PULUMI_CONFIG_PASSPHRASE = await password({
    message: 'Enter passphrase to encrypt secret state values',
    default: env['PULUMI_CONFIG_PASSPHRASE'],
    validate: (value) => !!value || 'Passphrase is required',
  });

  // write new config
  writeFileSync('.env', [
    `GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT}`,
    `PULUMI_CONFIG_PASSPHRASE=${PULUMI_CONFIG_PASSPHRASE}`,
    '',
  ].join('\n'));
  echo.success('.env file updated');

  // populate process.env with new config
  configDotenv({
    override: true,
  });
}

main().catch(handleError);
