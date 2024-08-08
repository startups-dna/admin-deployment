import { confirm, input } from '@inquirer/prompts';
import chalk from 'chalk';
import getValue from 'get-value';
import setValue from 'set-value';
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
import { getPulumiStackConfig, pulumiConfigSet } from './pulumi.mjs';

export function isConfigAlterMode() {
  // read '--alter' flag from command line
  return process.argv.includes('--alter');
}

export async function initStackConfig() {
  echo.log('Setting up stack configuration...');
  const alterMode = isConfigAlterMode();
  const configurator = new StackConfigurator(alterMode);
  await configurator.load();

  echo.log('Current stack configuration:');
  console.log('- GCP project:', chalk.bold(configurator.get('gcp:project')));
  console.log('- GCP default region:', chalk.bold(configurator.get('gcp:region')));

  if (!configurator.get('gcp:project')) {
    const gcpProject = await selectGcloudProject({
      message: 'GCP project (Admin services will be deployed there):',
      default: getGcpDefaultProject(),
      validate: (value) => !!value || 'Project is required',
    });
    configurator.set('gcp:project', gcpProject);
  }

  await configurator.prompt(
    'gcp:region',
    async (currentValue) => {
      return input({
        message: 'Enter GCP default region:',
        default: currentValue || getGcpDefaultRegion(),
        validate: (value) => !!value || 'Region is required',
      });
    },
  );

  await configurator.prompt(
    `${PULUMI_PROJECT}:companyName`,
    async (currentValue) => {
      return input({
        message: 'Enter your company name:',
        default: currentValue,
        validate: (value) => !!value || 'Company name is required',
      });
    }
  );

  await configurator.prompt(
    `${PULUMI_PROJECT}:domain`,
    async (currentValue) => {
      return input({
        message: 'Enter admin domain',
        default: currentValue,
        validate: (value) => !!value || 'Domain is required',
      });
    },
  );

  await configurator.prompt(
    `${PULUMI_PROJECT}:ipName`,
    async (currentValue) => {
      return selectGcloudIpAddress({
        project: configurator.get('gcp:project'),
        message: 'Select GCP IP address for admin services:',
        default: currentValue,
        validate: (value) => !!value || 'IP address name is required',
      });
    },
  );

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

  await configurator.prompt(
    'auth:tenantId',
    async (currentValue) => {
      return input({
        message: 'Enter GCP Identity Platform tenant ID (optional):',
        default: currentValue,
      });
    },
  );

  await configurator.prompt(
    'firebase:apiKey',
    async (currentValue) => {
      return selectGcloudApiKey({
        gcpProject: configurator.get('gcp:project'),
        message: 'Select a GCP API key for Firebase Client:',
        default: currentValue,
        validate: (value) => !!value || 'API key is required',
      });
    },
  );

  await configurator.prompt(
    'company:sqlInstance',
    async (currentValue) => {
      return selectGcloudSqlInstance({
        gcpProject: configurator.get('gcp:project'),
        message: 'Select a Cloud SQL instance for Company service:',
        default: currentValue,
        validate: (value) => !!value || 'Value is required',
      });
    },
  );

  await initAppToolsConfig(configurator);

  echo.success('Stack configuration done.');
}

async function initAppToolsConfig(configurator) {
  await configurator.prompt(
    'appTools:enabled',
    async (currentValue) => {
      const enabled = await confirm({
        message: 'Enable App Tools Service?',
        default: currentValue === 'true',
      });
      return enabled ? 'true' : 'false';
    },
  );

  if (configurator.get('appTools:enabled') !== 'true') {
    return;
  }

  await configurator.prompt(
    'appTools:sqlInstance',
    async (currentValue) => {
      return selectGcloudSqlInstance({
        gcpProject: configurator.get('gcp:project'),
        message: 'Select a Cloud SQL instance for App Tools service:',
        default: currentValue,
        validate: (value) => !!value || 'Value is required',
      });
    },
  );

  await configurator.prompt(
    'appTools:appStoreAppId',
    async (currentValue) => {
      return input({
        message: 'Enter App Store App ID:',
        default: currentValue,
      });
    },
  );

  await configurator.prompt(
    'appTools:appStoreConnect.enabled',
    async (currentValue) => {
      return confirm({
        message: 'Enable App Store Connect integration?',
        default: currentValue,
      });
    },
  );

  if (configurator.get('appTools:appStoreConnect.enabled')) {
    await configurator.promptSecret(
      'appTools:appStoreConnect.issuerId',
      async (currentValue) => {
        return input({
          message: 'Enter App Store Connect Issuer ID:',
          default: currentValue,
          validate: (value) => !!value || 'Value is required',
        });
      },
    );
    await configurator.promptSecret(
      'appTools:appStoreConnect.keyId',
      async (currentValue) => {
        return input({
          message: 'Enter App Store Connect Key ID:',
          default: currentValue,
          validate: (value) => !!value || 'Value is required',
        });
      },
    );
    await configurator.prompt(
      'appTools:appStoreConnect.privateKeyFile',
      async (currentValue) => {
        const relative = chalk.grey('(relative to ' + process.cwd() + ')');
        return input({
          message: `Choose App Store Connect Private Key file ${relative}:`,
          default: currentValue,
          validate: (value) => !!value || 'Value is required',
        });
      },
    );
  }

  await configurator.prompt(
    'appTools:googlePlayPackageName',
    async (currentValue) => {
      return input({
        message: 'Enter Google Play Package Name:',
        default: currentValue,
      });
    },
  );

  await configurator.prompt(
    'appTools:googlePlay.enabled',
    async (currentValue) => {
      return confirm({
        message: 'Enable Google Play integration?',
        default: currentValue,
      });
    },
  );

  if (configurator.get('appTools:googlePlay.enabled')) {
    await configurator.prompt(
      'appTools:googlePlay.serviceKeyFile',
      async (currentValue) => {
        const relative = chalk.grey('(relative to ' + process.cwd() + ')');
        return input({
          message: `Choose Google Play Service Account Key file ${relative}:`,
          default: currentValue,
          validate: (value) => !!value || 'Value is required',
        });
      },
    );
  }
}

class StackConfigurator {
  constructor(alterMode) {
    this.alterMode = alterMode;
    this.values = {};
  }

  async load() {
    this.values = await getPulumiStackConfig();
  }

  async prompt(key, prompter) {
    const currentValue = this.get(key);
    const isDefined = currentValue !== undefined;

    if (isDefined && !this.alterMode) {
      return currentValue;
    }

    const value = await prompter(currentValue);
    await this.set(key, value);

    return value;
  }

  async promptSecret(key, prompter) {
    const currentValue = this.get(key);
    const isDefined = currentValue !== undefined;

    if (isDefined && !this.alterMode) {
      return currentValue;
    }

    const value = await prompter(currentValue);
    await this.set(key, value, true);

    return value;
  }

  get(key) {
    return getValue(this.values, key);
  }

  async set(key, value, isSecret = false) {
    setValue(this.values, key, value);
    await pulumiConfigSet(key, value, isSecret);
  }
}