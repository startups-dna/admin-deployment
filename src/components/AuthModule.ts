import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { firebaseConfig, globalConfig } from '../config';

const PREFIX = 'admin-auth';

export class AuthModule extends pulumi.ComponentResource {
  service: gcp.cloudrunv2.Service;
  serviceBackend: gcp.compute.BackendService;
  serviceNeg: gcp.compute.RegionNetworkEndpointGroup;

  constructor(opts: pulumi.ComponentResourceOptions = {}) {
    super('startupsdna:index:AuthModule', PREFIX, {}, opts);

    // Read configuration
    const config = new pulumi.Config('auth');
    const authTenantId = config.get('tenantId');
    const cpu = config.get('cpu') || '1';
    const memory = config.get('memory') || '300Mi';
    const concurrency = config.getNumber('concurrency') || 80;
    const image = config.get('serviceImage') || 'europe-west1-docker.pkg.dev/startupsdna-tools/admin-services/auth:e61358c';

    // Define resources
    const envs: gcp.types.input.cloudrunv2.ServiceTemplateContainerEnv[] = [
      {
        name: 'FIREBASE_PROJECT_ID',
        value: firebaseConfig.projectId || globalConfig.project,
      },
      {
        name: 'FIREBASE_API_KEY',
        value: firebaseConfig.apiKey,
      },
      {
        name: 'FIREBASE_TENANT_ID',
        value: authTenantId,
      },
      {
        name: 'FIREBASE_CLIENT_EMAIL',
        value: firebaseConfig.credentials.client_email,
      },
      {
        name: 'FIREBASE_PRIVATE_KEY',
        value: firebaseConfig.credentials.private_key,
      },
    ]
      // leave only envs with values
      .filter((env) => env.value);

    // Create a Cloud Run service
    this.service = new gcp.cloudrunv2.Service(`${PREFIX}-service`, {
      location: globalConfig.location,
      template: {
        containers: [
          {
            image,
            resources: {
              cpuIdle: true,
              limits: {
                memory,
                cpu,
              },
            },
            envs,
          },
        ],
        maxInstanceRequestConcurrency: concurrency,
      },
    });

    // Create an IAM member to allow the service to be publicly accessible.
    new gcp.cloudrun.IamMember(`${PREFIX}-service-invoker`, {
      location: globalConfig.location,
      service: this.service.name,
      role: 'roles/run.invoker',
      member: 'allUsers',
    });

    this.serviceNeg = new gcp.compute.RegionNetworkEndpointGroup(`${PREFIX}-neg`, {
      region: globalConfig.location,
      cloudRun: {
        service: this.service.name,
      },
    });

    this.serviceBackend = new gcp.compute.BackendService(`${PREFIX}-service-backend`, {
      protocol: 'HTTPS',
      loadBalancingScheme: 'EXTERNAL_MANAGED',
      backends: [
        {
          group: this.serviceNeg.id,
        },
      ],
    });
  }
}