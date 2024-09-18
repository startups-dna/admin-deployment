import { configDotenv } from 'dotenv';
import { select } from '@inquirer/prompts';
import { handleError } from './inc/common.mjs';
import { deploy } from './actions/deploy.mjs';
import { setup } from './actions/setup.mjs';
import { initAdmin } from './actions/initAdmin.mjs';
import { migrateSecretsProvider } from './actions/migrateSecretsProvider.mjs';

(async () => {
  configDotenv({ override: true });
  const actionKey = await inputAction();
  const action = actions[actionKey];
  if (!action) {
    throw `Action "${actionKey}" is not supported`;
  }
  await action.callback();
})().catch(handleError);

const actions = {
  ['deploy']: {
    name: 'Deploy the stack',
    callback: deploy,
  },
  ['setup']: {
    name: 'Setup the environment',
    callback: setup,
  },
  ['init-admin']: {
    name: 'Initialize admin user',
    callback: initAdmin,
  },
  ['migrate-secrets-provider']: {
    name: 'Migrate secrets provider',
    callback: migrateSecretsProvider,
  },
};

async function inputAction() {
  const action = process.argv[2];
  if (action) {
    return action;
  }

  const choices = Object.entries(actions).map(([key, value]) => ({
    name: value.name,
    value: key,
  }));

  return select({
    message: 'Choose an action:',
    choices: choices,
  });
}
