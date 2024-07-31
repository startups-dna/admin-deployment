import { $ } from 'execa';
import { echo } from './echo.mjs';
import { getPulumiStackConfig } from './pulumi.mjs';
import { selectGcloudSqlInstance } from './gcloud.mjs';

export async function initCompanyConfig() {
  // read existing config
  const currentConfig = await getPulumiStackConfig();

  const sqlInstance = await selectGcloudSqlInstance({
    gcpProject: currentConfig['gcp:project'],
    message: 'Select a Cloud SQL instance for Company service:',
    default: currentConfig['company:sqlInstance'],
    validate: (value) => !!value || 'Value is required',
  });
  await $`pulumi config set company:sqlInstance ${sqlInstance}`;

  echo.success('Company service configuration done');
}