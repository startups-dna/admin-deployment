import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { globalConfig } from '../config';
import { CompanyModule } from './CompanyModule';

const PREFIX = 'admin-configurator';

export type ConfiguratorModuleOptions = pulumi.ComponentResourceOptions & {
  companyModule: CompanyModule;
};

export class ConfiguratorModule extends pulumi.ComponentResource {
  service: gcp.cloudrunv2.Service;

  constructor(opts: ConfiguratorModuleOptions) {
    super(`startupsdna:index:${ConfiguratorModule.name}`, PREFIX, {}, opts);

    const authConfig = new pulumi.Config('auth');
    const authTenantId = authConfig.get('tenantId');
    const serviceImage = 'europe-west1-docker.pkg.dev/startupsdna-tools/admin-services/configurator:0.1.0';

    // Create a Cloud Run service definition.
    this.service = new gcp.cloudrunv2.Service(`${PREFIX}-service`, {
      location: globalConfig.location,
      template: {
        containers: [
          {
            image: serviceImage,
            envs: [
              {
                name: 'DATABASE_URL',
                valueSource: {
                  secretKeyRef: {
                    secret: opts.companyModule.dbUrlSecret.secretId,
                    version: opts.companyModule.dbUrlSecretVersion.version,
                  },
                },
              },
              {
                name: 'ADMIN_AUTH_TENANT_ID',
                value: authTenantId,
              },
            ],
            volumeMounts: [
              { name: 'cloudsql', mountPath: '/cloudsql' },
            ],
          },
        ],
        volumes: [
          { name: 'cloudsql', cloudSqlInstance: { instances: [opts.companyModule.dbInstance.connectionName] } },
        ],
      },
    }, {
      parent: this,
    });
  }
}