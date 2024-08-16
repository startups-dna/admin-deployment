import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { LoadBalancer } from './components/LoadBalancer';
import { CoreModule } from './components/CoreModule';
import { CompanyModule } from './components/CompanyModule';
import { AppToolsModule } from './components/AppToolsModule';
import { ConfiguratorModule } from './components/ConfiguratorModule';
import { FeedbackApiModule } from './components/FeedbackApiModule';
import { globalConfig } from './config';

const bucket = new gcp.storage.Bucket(
  'admin-storage-bucket',
  {
    name: `${globalConfig.project}-storage`,
    location: globalConfig.location,
    storageClass: 'STANDARD',
    uniformBucketLevelAccess: true,
  },
  { retainOnDelete: true },
);

const coreModule = new CoreModule();
const companyModule = new CompanyModule({ storageBucketName: bucket.name });
const configuratorModule = new ConfiguratorModule({ companyModule });
let appToolsModule: AppToolsModule | undefined;
let feedbackApiModule: FeedbackApiModule | undefined;
const appToolsConfig = new pulumi.Config('appTools');

if (appToolsConfig.get('enabled') === 'true') {
  appToolsModule = new AppToolsModule();
  feedbackApiModule = new FeedbackApiModule({
    database: appToolsModule.database,
  });
}

// Define service map
const serviceMap = new Map<string, pulumi.Output<string>>();
serviceMap.set('', coreModule.serviceBackend.id);
serviceMap.set('company', companyModule.serviceBackend.id);
if (appToolsModule) {
  serviceMap.set('app-tools', appToolsModule.serviceBackend.id);
}

const adminLb = new LoadBalancer({
  defaultService: coreModule.serviceBackend.id,
  serviceMap,
});

export const url = adminLb.url;
export const core = {
  serviceName: coreModule.service.name,
};
export const company = {
  serviceName: companyModule.service?.name,
  dbJobName: companyModule.dbJob?.name,
};
export const configurator = {
  serviceName: configuratorModule.service.name,
};
export const appTools = appToolsModule
  ? {
      serviceName: appToolsModule.service?.name,
      dbJobName: appToolsModule.dbJob?.name,
    }
  : {};
export const feedbackApi = feedbackApiModule
  ? {
      serviceName: feedbackApiModule.service?.name,
      url: feedbackApiModule.url,
    }
  : {};
