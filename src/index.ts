import * as pulumi from '@pulumi/pulumi';
import { ConfigAssets } from './components/ConfigAssets';
import { StorageResources } from './components/StorageResources';
import { LoadBalancer } from './components/LoadBalancer';
import { CoreModule } from './components/CoreModule';
import { CompanyModule } from './components/CompanyModule';
import { AppToolsModule } from './components/AppToolsModule';
import { ConfiguratorModule } from './components/ConfiguratorModule';
import { FeedbackApiModule } from './components/FeedbackApiModule';
import { AppCmsModule } from './components/AppCmsModule';
import { globalConfig } from './config';

const storage = new StorageResources();
const configAssets = new ConfigAssets();
const coreModule = new CoreModule();
const companyModule = new CompanyModule({
  storageBucketName: storage.bucket.name,
});
const configuratorModule = new ConfiguratorModule({
  companyModule,
  storageBucketName: storage.bucket.name,
});

let appToolsModule: AppToolsModule | undefined;
let feedbackApiModule: FeedbackApiModule | undefined;
if (globalConfig.modules?.appTools) {
  appToolsModule = new AppToolsModule();
  feedbackApiModule = new FeedbackApiModule({
    database: appToolsModule.database,
  });
}

let appCmsModule: AppCmsModule | undefined;
if (globalConfig.modules?.appCms) {
  appCmsModule = new AppCmsModule();
}

// Define service map
const serviceMap = new Map<string, pulumi.Output<string>>();
serviceMap.set('', coreModule.serviceBackend.id);
serviceMap.set('config', configAssets.backendBucket.id);
serviceMap.set('company', companyModule.serviceBackend.id);
if (appToolsModule) {
  serviceMap.set('app-tools', appToolsModule.serviceBackend.id);
}
if (appCmsModule) {
  serviceMap.set('app-cms', appCmsModule.backendService.id);
}

const adminLb = new LoadBalancer({
  defaultService: coreModule.serviceBackend.id,
  serviceMap,
});

export const loadBalancer = adminLb.output;
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
export const feedbackApi = feedbackApiModule ? feedbackApiModule.output : {};
export const appCms = appCmsModule
  ? {
      serviceName: appCmsModule.service.name,
    }
  : {};
