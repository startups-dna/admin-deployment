import * as pulumi from '@pulumi/pulumi';
import { LoadBalancer } from './components/LoadBalancer';
import { AuthModule } from './components/AuthModule';
import { CompanyModule } from './components/CompanyModule';

const authModule = new AuthModule();
const companyConfig = new pulumi.Config('company');
const companyModule = companyConfig.getBoolean('enabled') ? new CompanyModule() : undefined;

// Define service map
const serviceMap = new Map<string, pulumi.Output<string>>();
serviceMap.set('auth', authModule.serviceBackend.id);
if (companyModule) {
  serviceMap.set('company', companyModule.serviceBackend.id);
}

const adminLb = new LoadBalancer({ serviceMap });

export const url = adminLb.url;
export const auth = {
  serviceName: authModule.service.name,
};
export const company = companyModule ? {
  serviceName: companyModule.service?.name,
  dbJobName: companyModule.dbJob?.name,
} : undefined;
