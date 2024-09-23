const registry = 'europe-west1-docker.pkg.dev/startupsdna-tools/admin-services';

const MODULE_VERSIONS = {
  company: '0.4.0',
  appTools: '0.4.0',
  core: '0.3.2',
};

export const companyDockerImages = {
  company: `${registry}/company:${MODULE_VERSIONS.company}`,
  companyDb: `${registry}/company-db:${MODULE_VERSIONS.company}`,
  configurator: `${registry}/configurator:${MODULE_VERSIONS.company}`,
};

export const appToolsDockerImages = {
  appTools: `${registry}/app-tools:${MODULE_VERSIONS.appTools}`,
  appToolsDb: `${registry}/app-tools-db:${MODULE_VERSIONS.appTools}`,
  feedback: `${registry}/feedback-api:${MODULE_VERSIONS.appTools}`,
};

export const coreDockerImages = {
  core: `${registry}/core:${MODULE_VERSIONS.core}`,
};
