import * as pulumi from '@pulumi/pulumi';

const gcpConfig = new pulumi.Config('gcp');
const location = gcpConfig.require('region');
const project = gcpConfig.require('project');

// Import the program's configuration settings.
const config = new pulumi.Config();
const domain = config.require('domain');
const ipName = config.require('ipName');
const defaultService = config.get('defaultService') || 'auth';

export const globalConfig = {
  domain,
  ipName,
  defaultService,
  location,
  project,
};

export * from './firebase';
