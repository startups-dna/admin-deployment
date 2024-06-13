import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { globalConfig } from '../config';

const config = new pulumi.Config('company');
const sqlInstance = config.require('sqlInstance');
const databaseUrl = config.requireSecret('databaseUrl');
const cpu = config.get('cpu') || '1';
const memory = config.get('memory') || '500Mi';
const concurrency = config.getNumber('concurrency') || 80;
const image = 'europe-west1-docker.pkg.dev/startupsdna-tools/admin-services/company:6f2d870';

const PREFIX = 'admin-company';

const companyDatabaseUrlSecret = new gcp.secretmanager.Secret(`${PREFIX}-secret-database-url`, {
  secretId: 'company-database-url',
  replication: {
    auto: {},
  },
});

const companyDatabaseUrlVersion = new gcp.secretmanager.SecretVersion(`${PREFIX}-secret-version-database-url`, {
  secret: companyDatabaseUrlSecret.id,
  secretData: databaseUrl,
});

// Create a Cloud Run service definition.
export const companyService = new gcp.cloudrun.Service(PREFIX, {
  location: globalConfig.location,
  template: {
    metadata: {
      annotations: {
        'run.googleapis.com/cloudsql-instances': sqlInstance,
      },
    },
    spec: {
      containers: [
        {
          image,
          resources: {
            limits: {
              memory,
              cpu,
            },
          },
          envs: [
            {
              name: 'DATABASE_URL',
              valueFrom: {
                secretKeyRef: {
                  name: companyDatabaseUrlSecret.secretId,
                  key: companyDatabaseUrlVersion.version,
                }
              },
            },
          ],
        },
      ],
      containerConcurrency: concurrency,
    },
  },
});

// Create an IAM member to allow the service to be publicly accessible.
new gcp.cloudrun.IamMember(`${PREFIX}-service-invoker`, {
  service: companyService.name,
  role: 'roles/run.invoker',
  member: 'allUsers',
});

export const companyServiceNEG = new gcp.compute.RegionNetworkEndpointGroup(`${PREFIX}-neg`, {
  region: globalConfig.location,
  cloudRun: {
    service: companyService.name,
  },
});

export const companyServiceBackend = new gcp.compute.BackendService(`${PREFIX}-backend`, {
  protocol: 'HTTPS',
  loadBalancingScheme: 'EXTERNAL_MANAGED',
  backends: [
    {
      group: companyServiceNEG.id,
    },
  ],
});
