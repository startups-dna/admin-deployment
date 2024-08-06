import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import { $ } from 'execa';
import { echo } from './echo.mjs';
import {
  getGcpDefaultProject,
  getGcpDefaultRegion,
  selectGcloudApiKey,
  selectGcloudIpAddress,
  selectGcloudProject,
  selectGcloudSqlInstance
} from './gcloud.mjs';
import { PULUMI_PROJECT } from './constants.mjs';
import { getPulumiStackConfig } from './pulumi.mjs';

export function isConfigAlterMode() {
  // read '--alter' flag from command line
  return process.argv.includes('--alter');
}

export async function initStackConfig() {
  echo.log('Setting up stack configuration...');

  // read existing config
  const currentConfig = await getPulumiStackConfig();
  echo.log('Current stack configuration:');
  console.log('- GCP project:', chalk.bold(currentConfig['gcp:project']));
  console.log('- GCP default region:', chalk.bold(currentConfig['gcp:region']));

  const alterMode = isConfigAlterMode();

  let gcpProject = currentConfig['gcp:project'];
  if (!gcpProject) {
    gcpProject = await selectGcloudProject({
      message: 'GCP project (Admin services will be deployed there):',
      default: gcpProject || getGcpDefaultProject(),
      validate: (value) => !!value || 'Project is required',
    });
    await $`pulumi config set gcp:project ${gcpProject}`;
  }

  let gcpRegion = currentConfig['gcp:region'];
  if (!gcpRegion) {
    gcpRegion = await input({
      message: 'Enter GCP default region:',
      default: gcpRegion || getGcpDefaultRegion(),
      validate: (value) => !!value || 'Region is required',
    });
    await $`pulumi config set gcp:region ${gcpRegion}`;
  }

  if (!currentConfig[`${PULUMI_PROJECT}:companyName`] || alterMode) {
    const companyName = await input({
      message: 'Enter your company name:',
      default: currentConfig[`${PULUMI_PROJECT}:companyName`],
      validate: (value) => !!value || 'Company name is required',
    });
    await $`pulumi config set companyName ${companyName}`;
  }

  if (!currentConfig[`${PULUMI_PROJECT}:domain`] || alterMode) {
    const domain = await input({
      message: 'Enter admin domain',
      default: currentConfig[`${PULUMI_PROJECT}:domain`],
      validate: (value) => !!value || 'Domain is required',
    });
    await $`pulumi config set domain ${domain}`;
  }

  if (!currentConfig[`${PULUMI_PROJECT}:ipName`] || alterMode) {
    const ipName = await selectGcloudIpAddress({
      project: gcpProject,
      message: 'Select GCP IP address for admin services:',
      default: currentConfig[`${PULUMI_PROJECT}:ipName`],
      validate: (value) => !!value || 'IP address name is required',
    });
    await $`pulumi config set ipName ${ipName}`;
  }

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

  if (undefined === currentConfig['auth:tenantId'] || alterMode) {
    const authTenantId = await input({
      message: 'Enter GCP Identity Platform tenant ID (optional):',
      default: currentConfig['auth:tenantId'],
    });
    await $`pulumi config set auth:tenantId ${authTenantId}`;
  }

  if (!currentConfig['firebase:apiKey'] || alterMode) {
    const firebaseApiKey = await selectGcloudApiKey({
      gcpProject,
      message: 'Select a GCP API key for Firebase Client:',
      default: currentConfig['firebase:apiKey'],
      validate: (value) => !!value || 'API key is required',
    });
    await $`pulumi config set firebase:apiKey ${firebaseApiKey}`;
  }

  if (!currentConfig['company:sqlInstance'] || alterMode) {
    const sqlInstance = await selectGcloudSqlInstance({
      gcpProject: gcpProject,
      message: 'Select a Cloud SQL instance for Company service:',
      default: currentConfig['company:sqlInstance'],
      validate: (value) => !!value || 'Value is required',
    });
    await $`pulumi config set company:sqlInstance ${sqlInstance}`;
  }

  echo.success('Stack configuration done.');
}
