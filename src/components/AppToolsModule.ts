import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import * as fs from 'node:fs';
import { globalConfig } from '../config';
import { DatabaseResources } from './DatabaseResources';
import { HasOutput, HasPathRules } from '../interfaces';

const PREFIX = 'admin-app-tools';
const DB_USER = 'admin-app-tools';
const DB_NAME = 'admin-app-tools';

type ServiceEnvs = gcp.types.input.cloudrunv2.ServiceTemplateContainerEnv[];

export class AppToolsModule
  extends pulumi.ComponentResource
  implements HasOutput, HasPathRules
{
  readonly database: DatabaseResources;
  readonly service: gcp.cloudrunv2.Service;
  readonly serviceBackend: gcp.compute.BackendService;
  readonly dbJob: gcp.cloudrunv2.Job;

  constructor(opts: pulumi.ComponentResourceOptions = {}) {
    super(`startupsdna:admin:${AppToolsModule.name}`, PREFIX, {}, opts);

    const authConfig = new pulumi.Config('auth');
    const authTenantId = authConfig.get('tenantId');
    const config = new pulumi.Config('appTools');
    const sqlInstanceName = config.require('sqlInstance');
    const cpu = config.get('cpu') || '1';
    const memory = config.get('memory') || '512Mi';
    const concurrency = config.getNumber('concurrency') || 80;
    const serviceImage =
      config.get('serviceImage') ||
      'europe-west1-docker.pkg.dev/startupsdna-tools/admin-services/app-tools:0.3.0';
    const dbImage =
      config.get('dbImage') ||
      'europe-west1-docker.pkg.dev/startupsdna-tools/admin-services/app-tools-db:0.3.0';
    const appStoreAppId = config.get('appStoreAppId');
    type AppStoreConnectConfig = {
      enabled: boolean;
      keyId: string;
      issuerId: string;
      privateKeyFile: string;
    };
    const appStoreConnect =
      config.getSecretObject<AppStoreConnectConfig>('appStoreConnect');
    const googlePlayPackageName = config.get('googlePlayPackageName');
    type GooglePlayConfig = {
      enabled: boolean;
      serviceKeyFile: string;
    };
    const googlePlay = config.getSecretObject<GooglePlayConfig>('googlePlay');

    new gcp.projects.Service(
      'androidpublisher-api',
      {
        service: 'androidpublisher.googleapis.com',
        disableOnDestroy: false,
      },
      {
        parent: this,
      },
    );

    this.database = new DatabaseResources(
      PREFIX,
      {
        instanceId: sqlInstanceName,
        dbName: DB_NAME,
        dbUser: DB_USER,
      },
      {
        parent: this,
      },
    );

    const serviceEnvs: ServiceEnvs = [];

    if (authTenantId) {
      serviceEnvs.push({
        name: 'ADMIN_AUTH_TENANT_ID',
        value: authTenantId,
      });
    }

    if (appStoreAppId) {
      serviceEnvs.push({
        name: 'APP_STORE_APP_ID',
        value: appStoreAppId,
      });
    }

    if (googlePlayPackageName) {
      serviceEnvs.push({
        name: 'GOOGLE_PLAY_PACKAGE_NAME',
        value: googlePlayPackageName,
      });
    }

    const appStoreConnectEnvs = appStoreConnect?.apply<ServiceEnvs>(
      (config) => {
        if (!config.enabled) {
          return [];
        }
        if (
          !appStoreAppId ||
          !config.keyId ||
          !config.issuerId ||
          !config.privateKeyFile
        ) {
          throw new pulumi.ResourceError(
            'appStoreAppId, keyId, issuerId, privateKeyFile are required for AppStore Connect',
            this,
            true,
          );
        }
        const appStoreConnectPrivateKey = fs
          .readFileSync(config.privateKeyFile)
          .toString();
        const envs: ServiceEnvs = [
          {
            name: 'APP_STORE_ENABLED',
            value: 'true',
          },
          {
            name: 'ADMIN_AUTH_PROJECT_ID',
            value: globalConfig.project,
          },
          {
            name: 'APP_STORE_CONNECT_KEY_ID',
            value: appStoreConnect.keyId,
          },
          {
            name: 'APP_STORE_CONNECT_ISSUER_ID',
            value: appStoreConnect.issuerId,
          },
          {
            name: 'APP_STORE_CONNECT_KEY',
            value: appStoreConnectPrivateKey,
          },
        ];

        return envs;
      },
    );

    const googlePlayEnvs = googlePlay?.apply<ServiceEnvs>((config) => {
      if (!config.enabled) {
        return [];
      }
      if (!googlePlayPackageName || !config.serviceKeyFile) {
        throw new pulumi.ResourceError(
          'googlePlayPackageName, serviceKeyFile are required for Google Play integration',
          this,
          true,
        );
      }
      const googlePlayServiceKey = JSON.parse(
        fs.readFileSync(config.serviceKeyFile).toString(),
      );
      const envs: ServiceEnvs = [
        {
          name: 'GOOGLE_PLAY_ENABLED',
          value: 'true',
        },
        {
          name: 'GOOGLE_PLAY_CLIENT_EMAIL',
          value: googlePlayServiceKey.client_email,
        },
        {
          name: 'GOOGLE_PLAY_PRIVATE_KEY',
          value: googlePlayServiceKey.private_key,
        },
      ];
      return envs;
    });

    // Create a Cloud Run service definition.
    this.service = new gcp.cloudrunv2.Service(
      `${PREFIX}-service`,
      {
        location: globalConfig.location,
        template: {
          containers: [
            {
              image: serviceImage,
              envs: pulumi
                .all([appStoreConnectEnvs, googlePlayEnvs])
                .apply(([appStoreConnectEnvs, googlePlayEnvs]) => {
                  return [
                    ...serviceEnvs,
                    ...this.database.serviceEnvs,
                    ...(appStoreConnectEnvs || []),
                    ...(googlePlayEnvs || []),
                    {
                      name: 'LOGGER',
                      value: 'gcloud',
                    },
                    {
                      name: 'LOGGER_NAME',
                      value: 'app-tools',
                    },
                    {
                      name: 'LOGGER_LEVEL',
                      value: 'debug',
                    },
                  ];
                }),
              volumeMounts: [{ name: 'cloudsql', mountPath: '/cloudsql' }],
              resources: {
                cpuIdle: false,
                limits: {
                  memory,
                  cpu,
                },
              },
            },
          ],
          maxInstanceRequestConcurrency: concurrency,
          scaling: {
            minInstanceCount: 1,
            maxInstanceCount: 1,
          },
          volumes: [
            {
              name: 'cloudsql',
              cloudSqlInstance: {
                instances: [this.database.sqlInstance.connectionName],
              },
            },
          ],
        },
      },
      {
        parent: this,
      },
    );

    // Create Cloud Run Job to run migrations
    this.dbJob = new gcp.cloudrunv2.Job(
      `${PREFIX}-db-job`,
      {
        location: globalConfig.location,
        template: {
          parallelism: 1,
          taskCount: 1,
          template: {
            maxRetries: 1,
            containers: [
              {
                image: dbImage,
                envs: [...this.database.jobEnvs],
                volumeMounts: [{ name: 'cloudsql', mountPath: '/cloudsql' }],
              },
            ],
            volumes: [
              {
                name: 'cloudsql',
                cloudSqlInstance: {
                  instances: [this.database.sqlInstance.connectionName],
                },
              },
            ],
          },
        },
      },
      {
        parent: this,
      },
    );

    // Create an IAM member to allow the service to be publicly accessible.
    new gcp.cloudrun.IamMember(
      `${PREFIX}-service-invoker`,
      {
        service: this.service.name,
        role: 'roles/run.invoker',
        member: 'allUsers',
      },
      {
        parent: this,
      },
    );

    const serviceNEG = new gcp.compute.RegionNetworkEndpointGroup(
      `${PREFIX}-neg`,
      {
        region: globalConfig.location,
        cloudRun: {
          service: this.service.name,
        },
      },
      {
        parent: this,
      },
    );

    this.serviceBackend = new gcp.compute.BackendService(
      `${PREFIX}-service-backend`,
      {
        protocol: 'HTTPS',
        loadBalancingScheme: 'EXTERNAL_MANAGED',
        backends: [
          {
            group: serviceNEG.id,
          },
        ],
      },
      {
        parent: this,
      },
    );
  }

  output() {
    return {
      serviceName: this.service.name,
      dbJobName: this.dbJob.name,
    };
  }

  pathRules() {
    return [
      {
        paths: ['/app-tools', '/app-tools/*'],
        service: this.serviceBackend.id,
      },
    ];
  }
}
