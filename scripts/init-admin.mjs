import { configDotenv } from 'dotenv';
import { execa } from 'execa';
import chalk from 'chalk';
import { confirm, input } from '@inquirer/prompts';
import { echo } from './inc/echo.mjs';
import { handleError } from './inc/common.mjs';
import { checkGCloudCli, gcloudAuth } from './inc/gcloud.mjs';
import {
  checkPulumiCli,
  checkPulumiStack,
  getPulumiStackConfig,
  getPulumiStackOutput,
  pulumiLogin,
} from './inc/pulumi.mjs';

configDotenv({ override: true });

async function main() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();
  await pulumiLogin();
  await checkPulumiStack();

  echo.log('Gathering required data from stack...');
  const config = await getPulumiStackConfig();
  const output = await getPulumiStackOutput();

  const gcpProject = config['gcp:project'];
  const gcpRegion = config['gcp:region'];
  const configuratorService = output.configurator?.serviceName;
  if (!configuratorService) {
    echo.error(
      'Configurator service not found. Make sure the stack is deployed.',
    );
    process.exit(1);
  }
  const { stdout: configuratorUrl } =
    await execa`gcloud run services describe ${configuratorService} --project=${gcpProject} --region=${gcpRegion} --format=${'value(status.url)'}`;
  echo.log(`Configurator URL: ${configuratorUrl}`);

  const email = await input({
    type: 'input',
    message: 'Enter email for admin user:',
    validate: (value) => (value ? true : 'Email is required'),
  });

  echo.log('Obtaining GCP ID token...');
  const { stdout: gcpIdToken } = await execa`gcloud auth print-identity-token`;

  const api = new ConfiguratorApi(configuratorUrl, gcpIdToken);

  const adminUser = await api.request('POST', 'init-admin', { email });
  echo.success('Admin user initialized');
  console.log(chalk.dim(JSON.stringify(adminUser, null, 2)));

  if (
    !(await confirm({
      message: 'Would you like to generate a password reset link?',
    }))
  ) {
    return;
  }

  const passwordReset = await api.request('POST', 'password-reset', { email });
  echo.log('Password reset link:', passwordReset.link);
}

class ConfiguratorApi {
  constructor(configuratorUrl, token) {
    this.configuratorUrl = configuratorUrl;
    this.token = token;
  }

  async request(method, endpoint, body) {
    return fetch(`${this.configuratorUrl}/api/${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: undefined !== body && JSON.stringify(body),
    }).then((res) => {
      if (!res.ok) {
        throw new Error(
          `Request failed with status ${res.status}: ` + res.statusText,
        );
      }
      return res.json();
    });
  }
}

main().catch(handleError);
