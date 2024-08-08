import { $, execa } from 'execa';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { DEFAULT_STACK, PULUMI_PROJECT } from './constants.mjs';
import { echo } from './echo.mjs';
import { getStateBucketId } from './stateBucket.mjs';

export async function checkPulumiCli() {
  echo.log('Checking pulumi CLI...');
  try {
    await $`pulumi version`;
    echo.success('pulumi CLI is installed');
  } catch (e) {
    echo.error('pulumi CLI is not installed');
    echo.info(`Please install pulumi:`, chalk.white.underline('https://www.pulumi.com/docs/install/'));
    process.exit(1);
  }
}

export async function pulumiLogin() {
  echo.log('Logging in to pulumi...');
  const stateBucketId = getStateBucketId();
  await execa({ stdio: 'inherit' })`pulumi login ${stateBucketId}`;
}

export async function checkPulumiStack() {
  const stacks = await $`pulumi stack ls --project ${PULUMI_PROJECT} --json`.then(({ stdout }) => JSON.parse(stdout));
  if (stacks.length === 0) {
    await initStack(DEFAULT_STACK);
  } else if (stacks.length === 1) {
    echo.log(`Selecting pulumi stack [${stacks[0].name}]...`);
    await execa({ stdio: 'inherit' })`pulumi stack select ${stacks[0].name}`;
  } else {
    await execa({ stdio: 'inherit' })`pulumi stack select`;
  }
}

export async function initStack(stackName) {
  // init pulumi stack
  echo.log(`Initializing pulumi stack [${stackName}]...`);
  await $`pulumi stack init ${stackName}`;
}

export async function getPulumiStackConfig() {
  return await $`pulumi config --show-secrets --json`
    .then(({ stdout }) => JSON.parse(stdout))
    .then(parsePulumiConfig);
}

export async function pulumiConfigSet(key, value, isSecret = false) {
  return execa`pulumi config set ${isSecret ? '--secret' : '--plaintext'} --path ${key} ${String(value)}`;
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
