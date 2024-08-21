import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { globalConfig } from '../config';
import { CompanyModule } from './CompanyModule';

const PREFIX = 'admin-configurator';

export type ConfiguratorModuleArgs = {
  companyModule: CompanyModule;
  storageBucketName: pulumi.Input<string>;
};

export class ConfiguratorModule extends pulumi.ComponentResource {
  service: gcp.cloudrunv2.Service;

  constructor(
    args: ConfiguratorModuleArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(`startupsdna:admin:${ConfiguratorModule.name}`, PREFIX, args, opts);

    const authConfig = new pulumi.Config('auth');
    const authTenantId = authConfig.get('tenantId');
    const serviceImage =
      'europe-west1-docker.pkg.dev/startupsdna-tools/admin-services/configurator:0.3.1';

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
}
