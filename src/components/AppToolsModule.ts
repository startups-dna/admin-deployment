import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { globalConfig } from '../config';
import { DatabaseResources } from './DatabaseResources';
import { HasOutput, HasPathRules } from '../interfaces';
import { GoogleApisResources } from './GoogleApisResources';
import { SecretResources } from './SecretResources';
import { MODULE_VERSIONS } from '../constants';

const PREFIX = 'admin-app-tools';
const DB_USER = 'admin-app-tools';
const DB_NAME = 'admin-app-tools';
const BASE_URL = '/app-tools';
const API_BASE_URL = `${BASE_URL}/api`;

type AppToolsModuleArgs = {
  googleApis: GoogleApisResources;
  storageBucketName: pulumi.Input<string>;
};

type AppStoreConnectConfig = {
  enabled: boolean;
  keyId: string;
  issuerId: string;
  privateKey: string;
};

type GooglePlayConfig = {
  enabled: boolean;
  serviceAccountKey: string;
};

type KeywordsConfig = {
  enabled: boolean;
  appTweakApiKey: string;
};

type ServiceEnvs = gcp.types.input.cloudrunv2.ServiceTemplateContainerEnv[];

export class AppToolsModule
  extends pulumi.ComponentResource
  implements HasOutput, HasPathRules
{
  readonly database: DatabaseResources;
  readonly service: gcp.cloudrunv2.Service;
  readonly serviceBackend: gcp.compute.BackendService;
  readonly dbJob: gcp.cloudrunv2.Job;
  private readonly appStoreConnectConfig:
    | pulumi.Output<AppStoreConnectConfig>
    | undefined;
  private readonly googlePlayConfig:
    | pulumi.Output<GooglePlayConfig>
    | undefined;
  private readonly keywordsConfig: pulumi.Output<KeywordsConfig> | undefined;

  constructor(
    args: AppToolsModuleArgs,
    opts: pulumi.ComponentResourceOptions = {},
  ) {
    super(`startupsdna:admin:${AppToolsModule.name}`, PREFIX, args, opts);

    const authConfig = new pulumi.Config('auth');
    const authTenantId = authConfig.get('tenantId');
    const config = new pulumi.Config('appTools');
    const sqlInstanceName = config.require('sqlInstance');
    const cpu = config.get('cpu') || '1';
    const memory = config.get('memory') || '512Mi';
    const concurrency = config.getNumber('concurrency') || 80;
    const serviceImage =
      config.get('serviceImage') ||
      `europe-west1-docker.pkg.dev/startupsdna-tools/admin-services/app-tools:${MODULE_VERSIONS.appTools}`;
    const dbImage =
      config.get('dbImage') ||
      `europe-west1-docker.pkg.dev/startupsdna-tools/admin-services/app-tools-db:${MODULE_VERSIONS.appTools}`;
    const appStoreAppId = config.get('appStoreAppId');
    this.appStoreConnectConfig =
      config.getSecretObject<AppStoreConnectConfig>('appStoreConnect');
    const googlePlayPackageName = config.get('googlePlayPackageName');
    this.googlePlayConfig =
      config.getSecretObject<GooglePlayConfig>('googlePlay');
    this.keywordsConfig = config.getSecretObject<KeywordsConfig>('appTweak');

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

    const serviceEnvs: ServiceEnvs = [
      {
        name: 'ADMIN_AUTH_PROJECT_ID',
        value: globalConfig.project,
      },
      {
        name: 'FIREBASE_BUCKET_NAME',
        value: args.storageBucketName,
      },
    ];

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

    const appStoreConnectEnvs = this.appStoreConnectConfig?.apply<ServiceEnvs>(
      (config) => {
        if (!config.enabled) {
          return [];
        }
        if (
          !appStoreAppId ||
          !config.keyId ||
          !config.issuerId ||
          !config.privateKey
        ) {
          throw new pulumi.ResourceError(
            'appStoreAppId, keyId, issuerId, privateKey are required for AppStore Connect',
            this,
            true,
          );
        }

        const privateKey = new SecretResources(
          'app-store-connect-private-key',
          {
            data: config.privateKey,
          },
          {
            parent: this,
          },
        );

        const envs: ServiceEnvs = [
          {
            name: 'APP_STORE_ENABLED',
            value: 'true',
          },
          {
            name: 'APP_STORE_CONNECT_KEY_ID',
            value: config.keyId,
          },
          {
            name: 'APP_STORE_CONNECT_ISSUER_ID',
            value: config.issuerId,
          },
          {
            name: 'APP_STORE_CONNECT_KEY',
            valueSource: privateKey.envValueSource(),
          },
        ];

        return envs;
      },
    );

    const googlePlayEnvs = this.googlePlayConfig?.apply<ServiceEnvs>(
      (config) => {
        if (!config.enabled) {
          return [];
        }

        if (!googlePlayPackageName || !config.serviceAccountKey) {
          throw new pulumi.ResourceError(
            'googlePlayPackageName, serviceAccountKey are required for Google Play integration',
            this,
            true,
          );
        }

        const serviceAccountKey = JSON.parse(config.serviceAccountKey);

        const privateKey = new SecretResources(
          'google-play-private-key',
          {
            data: serviceAccountKey.private_key,
          },
          {
            parent: this,
          },
        );

        const envs: ServiceEnvs = [
          {
            name: 'GOOGLE_PLAY_ENABLED',
            value: 'true',
          },
          {
            name: 'GOOGLE_PLAY_CLIENT_EMAIL',
            value: serviceAccountKey.client_email,
          },
          {
            name: 'GOOGLE_PLAY_PRIVATE_KEY',
            valueSource: privateKey.envValueSource(),
          },
        ];

        return envs;
      },
    );

    const keywordsEnvs = this.keywordsConfig?.apply<ServiceEnvs>((config) => {
      if (!config.enabled) {
        return [];
      }
      if (!config.appTweakApiKey) {
        throw new pulumi.ResourceError(
          'appTools:appTweak.apiKey is required for AppTweak integration',
          this,
          true,
        );
      }

      return [
        {
          name: 'APPTWEAK_API_KEY',
          value: config.appTweakApiKey,
        },
      ];
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
                .all([appStoreConnectEnvs, googlePlayEnvs, keywordsEnvs])
                .apply(
                  ([appStoreConnectEnvs, googlePlayEnvs, keywordsEnvs]) => {
                    return [
                      ...serviceEnvs,
                      ...this.database.serviceEnvs,
                      ...(appStoreConnectEnvs || []),
                      ...(googlePlayEnvs || []),
                      ...(keywordsEnvs || []),
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
                  },
                ),
              volumeMounts: [{ name: 'cloudsql', mountPath: '/cloudsql' }],
              resources: {
                limits: {
                  memory,
                  cpu,
                },
              },
            },
          ],
          maxInstanceRequestConcurrency: concurrency,
          scaling: {
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
        dependsOn: [args.googleApis.run],
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
        dependsOn: [args.googleApis.run],
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

    this.createFeedbacksSyncJob(args);
    this.createAppStoreSyncJobs(args);
    this.createGooglePlaySyncJobs(args);
    this.createKeywordsSyncJobs(args);

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

  private createFeedbacksSyncJob(args: AppToolsModuleArgs) {
    new gcp.cloudscheduler.Job(
      `${PREFIX}-feedbacks-sync-job`,
      {
        schedule: '*/30 * * * *',
        timeZone: globalConfig.timeZone,
        httpTarget: {
          uri: `https://${globalConfig.domain}${API_BASE_URL}/feedbacks/sync`,
          httpMethod: 'POST',
        },
      },
      {
        dependsOn: [args.googleApis.cloudScheduler],
        parent: this,
      },
    );
  }

  private createAppStoreSyncJobs(args: AppToolsModuleArgs) {
    this.appStoreConnectConfig?.apply((config) => {
      if (!config.enabled) {
        return;
      }

      new gcp.cloudscheduler.Job(
        `${PREFIX}-ratings-app-store-sync-job`,
        {
          schedule: '5 5 * * *',
          timeZone: globalConfig.timeZone,
          httpTarget: {
            uri: `https://${globalConfig.domain}${API_BASE_URL}/ratings/app-store/sync`,
            httpMethod: 'POST',
          },
        },
        {
          dependsOn: [args.googleApis.cloudScheduler],
          parent: this,
        },
      );

      new gcp.cloudscheduler.Job(
        `${PREFIX}-reviews-app-store-sync-job`,
        {
          schedule: '0 */6 * * *',
          timeZone: globalConfig.timeZone,
          httpTarget: {
            uri: `https://${globalConfig.domain}${API_BASE_URL}/reviews/app-store/sync`,
            httpMethod: 'POST',
          },
        },
        {
          dependsOn: [args.googleApis.cloudScheduler],
          parent: this,
        },
      );
    });
  }

  private createGooglePlaySyncJobs(args: AppToolsModuleArgs) {
    this.googlePlayConfig?.apply((config) => {
      if (!config.enabled) {
        return;
      }

      new gcp.cloudscheduler.Job(
        `${PREFIX}-ratings-google-play-sync-job`,
        {
          schedule: '15 5 * * *',
          timeZone: globalConfig.timeZone,
          httpTarget: {
            uri: `https://${globalConfig.domain}${API_BASE_URL}/ratings/google-play/sync`,
            httpMethod: 'POST',
          },
        },
        {
          dependsOn: [args.googleApis.cloudScheduler],
          parent: this,
        },
      );

      new gcp.cloudscheduler.Job(
        `${PREFIX}-reviews-google-play-sync-job`,
        {
          schedule: '15 */6 * * *',
          timeZone: globalConfig.timeZone,
          httpTarget: {
            uri: `https://${globalConfig.domain}${API_BASE_URL}/reviews/google-play/sync`,
            httpMethod: 'POST',
          },
        },
        {
          dependsOn: [args.googleApis.cloudScheduler],
          parent: this,
        },
      );
    });
  }

  private createKeywordsSyncJobs(args: AppToolsModuleArgs) {
    this.keywordsConfig?.apply((config) => {
      if (!config.enabled) {
        return;
      }

      new gcp.cloudscheduler.Job(
        `${PREFIX}-keywords-ranks-sync-job`,
        {
          schedule: '5 3 * * *',
          timeZone: globalConfig.timeZone,
          httpTarget: {
            uri: `https://${globalConfig.domain}${API_BASE_URL}/keywords/sync/ranks`,
            httpMethod: 'POST',
          },
        },
        {
          dependsOn: [args.googleApis.cloudScheduler],
          parent: this,
        },
      );

      new gcp.cloudscheduler.Job(
        `${PREFIX}-keywords-metrics-sync-job`,
        {
          schedule: '10 3 * * *',
          timeZone: globalConfig.timeZone,
          httpTarget: {
            uri: `https://${globalConfig.domain}${API_BASE_URL}/keywords/sync/metrics`,
            httpMethod: 'POST',
          },
        },
        {
          dependsOn: [args.googleApis.cloudScheduler],
          parent: this,
        },
      );
    });
  }
}
