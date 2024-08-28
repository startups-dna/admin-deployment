import { $, execa } from 'execa';
import chalk from 'chalk';
import ora, { oraPromise } from 'ora';
import { DEFAULT_STACK, PULUMI_PROJECT } from './constants.mjs';
import { echo } from './echo.mjs';
import { getStateBucketId } from './stateBucket.mjs';
import {
  initKmsKey,
  getGcpDefaultProject,
  getGcpDefaultRegion,
} from './gcloud.mjs';

export async function checkPulumiCli() {
  const o = ora().start('Checking pulumi CLI...');
  try {
    await $`pulumi version`;
    o.succeed('pulumi CLI is installed.');
  } catch (e) {
    o.fail('pulumi CLI is not installed');
    echo.info(
      `Please install pulumi:`,
      chalk.white.underline('https://www.pulumi.com/docs/install/'),
    );
    process.exit(1);
  }
}

export async function pulumiLogin() {
  await oraPromise(
    async (o) => {
      const stateBucketId = getStateBucketId();
      const { stdout } = await execa`pulumi login ${stateBucketId}`;
      o.text = stdout;
    },
    {
      text: 'Logging in to pulumi...',
    },
  );
}

export async function checkPulumiStack() {
  const stacks =
    await $`pulumi stack ls --project ${PULUMI_PROJECT} --json`.then(
      ({ stdout }) => JSON.parse(stdout),
    );
  if (stacks.length === 0) {
    await initStack(DEFAULT_STACK);
  } else if (stacks.length === 1) {
    const stackName = stacks[0].name;
    await oraPromise(
      () => execa({ stdio: 'inherit' })`pulumi stack select ${stackName}`,
      {
        text: `Selecting pulumi stack [${stackName}]...`,
        successText: `Pulumi stack [${stackName}] selected.`,
      },
    );
  } else {
    await execa({ stdio: 'inherit' })`pulumi stack select`;
  }
}

export async function initStack(stackName) {
  await oraPromise(
    async () => {
      const kmsKey = await initKmsKey({
        project: getGcpDefaultProject(),
        location: getGcpDefaultRegion(),
        keyRing: 'pulumi',
        key: stackName,
      });
      const secretsProvider = `gcpkms://${kmsKey}`;
      await execa`pulumi stack init ${stackName} --secrets-provider=${secretsProvider}`;
    },
    {
      text: `Initializing Pulumi stack [${stackName}]...`,
      successText: `Pulumi stack [${stackName}] initialized.`,
    },
  );
}

export async function getPulumiStackConfig() {
  return await $`pulumi config --show-secrets --json`
    .then(({ stdout }) => JSON.parse(stdout))
    .then(parsePulumiConfig);
}

export async function pulumiConfigSet(key, value, isSecret = false) {
  return execa`pulumi config set ${
    isSecret ? '--secret' : '--plaintext'
  } --path ${key} ${String(value)}`;
}

export async function pulumiConfigRm(key) {
  return execa`pulumi config rm --path ${key}`;
}

export async function getPulumiStackOutput() {
  return await $`pulumi stack output --json`.then(({ stdout }) =>
    JSON.parse(stdout),
  );
}

function parsePulumiConfig(config) {
  const res = {};
  Object.keys(config).forEach((key) => {
    const value = config[key];
    if (typeof value !== 'object') {
      return;
    }

    if (undefined !== value.objectValue) {
      res[key] = value.objectValue;
    } else if (undefined !== value.value) {
      res[key] = value.value;
    }
  });

  return res;
}

export async function pulumiUp() {
  await execa({ stdio: 'inherit' })`pulumi up --yes`;
}
