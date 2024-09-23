import { configDotenv } from 'dotenv';
import { select } from '@inquirer/prompts';
import { handleError } from './inc/common.mjs';
import { deployAction } from './actions/deployAction.mjs';
import { setupAction } from './actions/setupAction.mjs';
import { initAdminAction } from './actions/initAdminAction.mjs';
import { migrateSecretsProviderAction } from './actions/migrateSecretsProviderAction.mjs';
import {
  configAppCmsAction,
  configAppToolsAction,
  configJiraAction,
  configMainAction,
} from './actions/configActions.mjs';

const actions = {
  ['deploy']: {
    name: '🚀 Deploy the stack',
    callback: deployAction,
  },
  ['setup']: {
    name: '🛠️ Setup the environment',
    callback: setupAction,
  },
  ['init-admin']: {
    name: '🔑 Initialize admin user access',
    callback: initAdminAction,
  },
  ['config:main']: {
    name: '⚙️ Configure main settings',
    callback: configMainAction,
  },
  ['config:jira']: {
    name: '⚙️ Configure Jira settings',
    callback: configJiraAction,
  },
  ['config:app-tools']: {
    name: '⚙️ Configure App Tools settings',
    callback: configAppToolsAction,
  },
  ['config:app-cms']: {
    name: '⚙️ Configure App CMS settings',
    callback: configAppCmsAction,
  },
  ['migrate:secrets-provider']: {
    name: 'Migrate secrets provider',
    callback: migrateSecretsProviderAction,
  },
};

(async () => {
  configDotenv({ override: true });
  const actionKey = await inputAction();
  const action = actions[actionKey];
  if (!action) {
    throw `Action "${actionKey}" is not supported`;
  }
  await action.callback();
})().catch(handleError);

async function inputAction() {
  const action = process.argv[2];
  if (action) {
    return action;
  }

  const choices = Object.entries(actions).map(([value, action]) => ({
    value: value,
    name: action.name,
  }));

  return select({
    message: 'Choose an action:',
    choices: choices,
    pageSize: 10,
    loop: false,
  });
}
