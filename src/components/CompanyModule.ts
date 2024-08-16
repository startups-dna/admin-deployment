import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import * as random from '@pulumi/random';
import { globalConfig } from '../config';

const PREFIX = 'admin-company';
const DB_USER = 'admin-company';
const DB_NAME = 'admin-company';

export class CompanyModule extends pulumi.ComponentResource {
  readonly service: gcp.cloudrunv2.Service;
  readonly serviceBackend: gcp.compute.BackendService;
  readonly dbJob: gcp.cloudrunv2.Job;
  readonly dbInstance: gcp.sql.DatabaseInstance;
  readonly dbUrlSecret: gcp.secretmanager.Secret;
  readonly dbUrlSecretVersion: gcp.secretmanager.SecretVersion;

  constructor(opts: pulumi.ComponentResourceOptions = {}) {
    super(`startupsdna:admin:${CompanyModule.name}`, PREFIX, {}, opts);

    const authConfig = new pulumi.Config('auth');
    const authTenantId = authConfig.get('tenantId');
    const config = new pulumi.Config('company');
    const sqlInstanceName = config.require('sqlInstance');
    const cpu = config.get('cpu') || '1';
    const memory = config.get('memory') || '512Mi';
    const concurrency = config.getNumber('concurrency') || 80;
    const serviceImage =
      config.get('serviceImage') ||
      'europe-west1-docker.pkg.dev/startupsdna-tools/admin-services/company:0.1.0';
    const dbImage =
      config.get('dbImage') ||
      'europe-west1-docker.pkg.dev/startupsdna-tools/admin-services/company-db:0.1.0';

    this.dbInstance = gcp.sql.DatabaseInstance.get(
      `${PREFIX}-sql-instance`,
      sqlInstanceName,
    );

    const dbPassword = new random.RandomPassword(
      `${PREFIX}-db-password`,
      {
        length: 16,
        special: false,
      },
      {
        parent: this,
      },
    );

    const db = new gcp.sql.Database(
      `${PREFIX}-db`,
      {
        name: DB_NAME,
        instance: this.dbInstance.name,
      },
      {
        retainOnDelete: true,
        parent: this,
      },
    );

    const dbUser = new gcp.sql.User(
      `${PREFIX}-db-user`,
      {
        name: DB_USER,
        instance: this.dbInstance.name,
        type: 'BUILT_IN',
        password: dbPassword.result,
      },
      {
        retainOnDelete: true,
        parent: this,
      },
    );

    this.dbUrlSecret = new gcp.secretmanager.Secret(
      `${PREFIX}-db-url`,
      {
        secretId: `${PREFIX}-database-url`,
        replication: {
          auto: {},
        },
      },
      {
        parent: this,
      },
    );
    const dbUrl = pulumi.interpolate`postgres://${dbUser.name}:${dbPassword.result}@localhost/${db.name}?schema=public&host=/cloudsql/${this.dbInstance.connectionName}`;

    this.dbUrlSecretVersion = new gcp.secretmanager.SecretVersion(
      `${PREFIX}-db-url`,
      {
        secret: this.dbUrlSecret.id,
        secretData: dbUrl,
      },
      {
        parent: this,
      },
    );

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
                      secret: this.dbUrlSecret.secretId,
                      version: this.dbUrlSecretVersion.version,
                    },
                  },
                },
                {
                  name: 'ADMIN_AUTH_TENANT_ID',
                  value: authTenantId,
                },
              ],
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
              cloudSqlInstance: { instances: [this.dbInstance.connectionName] },
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
                envs: [
                  {
                    name: 'DATABASE_URL',
                    valueSource: {
                      secretKeyRef: {
                        secret: this.dbUrlSecret.secretId,
                        version: this.dbUrlSecretVersion.version,
                      },
                    },
                  },
                ],
                volumeMounts: [{ name: 'cloudsql', mountPath: '/cloudsql' }],
              },
            ],
            volumes: [
              {
                name: 'cloudsql',
                cloudSqlInstance: {
                  instances: [this.dbInstance.connectionName],
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
}
