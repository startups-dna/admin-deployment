import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';
import { globalConfig } from '../config';

const config = new pulumi.Config('auth');
const authTenantId = config.get('tenantId');
const cpu = config.get('cpu') || '1';
const memory = config.get('memory') || '300Mi';
const concurrency = config.getNumber('concurrency') || 80;
const image = 'europe-west1-docker.pkg.dev/startupsdna-tools/admin-services/auth:e61358c';

const PREFIX = 'admin-auth';

const envs: gcp.types.input.cloudrun.ServiceTemplateSpecContainerEnv[] = [
  {
    name: 'FIREBASE_PROJECT_ID',
    value: globalConfig.firebaseProjectId,
  },
  {
    name: 'FIREBASE_API_KEY',
    value: globalConfig.firebaseApiKey,
  },
  {
    name: 'FIREBASE_TENANT_ID',
    value: authTenantId,
  },
  {
    name: 'FIREBASE_CLIENT_EMAIL',
    value: globalConfig.firebaseClientEmail,
  },
  {
    name: 'FIREBASE_PRIVATE_KEY',
    value: globalConfig.firebasePrivateKey,
  },
]
  // leave only envs with values
  .filter((env) => env.value);

// Create a Cloud Run service definition.
export const authService = new gcp.cloudrun.Service(PREFIX, {
  location: globalConfig.location,
  template: {
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
          envs,
        },
      ],
      containerConcurrency: concurrency,
    },
  },
});

// Create an IAM member to allow the service to be publicly accessible.
new gcp.cloudrun.IamMember(`${PREFIX}-invoker`, {
  location: globalConfig.location,
  service: authService.name,
  role: 'roles/run.invoker',
  member: 'allUsers',
});

export const authServiceNEG = new gcp.compute.RegionNetworkEndpointGroup(`${PREFIX}-neg`, {
  region: globalConfig.location,
  cloudRun: {
    service: authService.name,
  },
});

export const authServiceBackend = new gcp.compute.BackendService(`${PREFIX}-backend`, {
  protocol: 'HTTPS',
  loadBalancingScheme: 'EXTERNAL_MANAGED',
  backends: [
    {
      group: authServiceNEG.id,
    },
  ],
});
