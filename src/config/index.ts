import * as pulumi from '@pulumi/pulumi';

const gcpConfig = new pulumi.Config('gcp');
const location = gcpConfig.require('region');
const project = gcpConfig.require('project');

export type ModulesConfig = {
  appTools: boolean;
  appCms: boolean;
};

// Import the program's configuration settings.
const config = new pulumi.Config();
const companyName = config.require('companyName');
const domain = config.require('domain');
const ipName = config.require('ipName');
const timeZone = config.get('timeZone') || 'UTC';
const modules = config.getObject<ModulesConfig>('modules');
const importMode = config.getBoolean('importMode') || false;

export const globalConfig = {
  companyName,
  domain,
  ipName,
  modules,
  timeZone,
  importMode,
  location,
  project,
};
