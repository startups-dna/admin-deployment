import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { globalConfig } from '../config';
import { HasOutput } from '../interfaces';
import { CompanyModule } from './CompanyModule';
import { companyDockerImages } from '../constants';

const PREFIX = 'admin-configurator';

export type ConfiguratorModuleArgs = {
  companyModule: CompanyModule;
  storageBucketName: pulumi.Input<string>;
};

export class ConfiguratorModule
  extends pulumi.ComponentResource
  implements HasOutput
{
  service: gcp.cloudrunv2.Service;

  constructor(
    args: ConfiguratorModuleArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(`startupsdna:admin:${ConfiguratorModule.name}`, PREFIX, args, opts);

    const authConfig = new pulumi.Config('auth');
    const authTenantId = authConfig.get('tenantId');
    const serviceImage = companyDockerImages.configurator;

    // Create a Cloud Run service definition.
    this.service = new gcp.cloudrunv2.Service(
      `${PREFIX}-service`,
      {
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
                      secret: args.companyModule.dbUrlSecret.secretId,
                      version: args.companyModule.dbUrlSecretVersion.version,
                    },
                  },
                },
                {
                  name: 'ADMIN_AUTH_TENANT_ID',
                  value: authTenantId,
                },
                {
                  name: 'FIREBASE_BUCKET_NAME',
                  value: args.storageBucketName,
                },
              ],
              volumeMounts: [{ name: 'cloudsql', mountPath: '/cloudsql' }],
            },
          ],
          volumes: [
            {
              name: 'cloudsql',
              cloudSqlInstance: {
                instances: [args.companyModule.dbInstance.connectionName],
              },
            },
          ],
        },
      },
      {
        parent: this,
      },
    );
  }

  output() {
    return {
      serviceName: this.service.name,
    };
  }
}
