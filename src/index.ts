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
const adminLb = new LoadBalancer({
  defaultService: coreModule.serviceBackend.id,
});
adminLb.addPathRules(configAssets.pathRules());
adminLb.addPathRules(companyModule.pathRules());

let appToolsModule: AppToolsModule | undefined;
let feedbackApiModule: FeedbackApiModule | undefined;
if (globalConfig.modules?.appTools) {
  appToolsModule = new AppToolsModule();
  feedbackApiModule = new FeedbackApiModule({
    database: appToolsModule.database,
  });
  adminLb.addPathRules(appToolsModule.pathRules());
}

let appCmsModule: AppCmsModule | undefined;
if (globalConfig.modules?.appCms) {
  appCmsModule = new AppCmsModule();
  adminLb.addPathRules(appCmsModule.pathRules());
}

// Export the outputs
export const loadBalancer = adminLb.output();
export const core = coreModule.output();
export const company = companyModule.output();
export const configurator = configuratorModule.output();
export const appTools = appToolsModule ? appToolsModule.output() : {};
export const feedbackApi = feedbackApiModule ? feedbackApiModule.output() : {};
export const appCms = appCmsModule ? appCmsModule.output() : {};
