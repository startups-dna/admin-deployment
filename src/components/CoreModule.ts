import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { firebaseConfig, globalConfig } from '../config';

const PREFIX = 'admin-core';

export class CoreModule extends pulumi.ComponentResource {
  service: gcp.cloudrunv2.Service;
  serviceBackend: gcp.compute.BackendService;
  serviceNeg: gcp.compute.RegionNetworkEndpointGroup;

  constructor(opts: pulumi.ComponentResourceOptions = {}) {
    super(`startupsdna:index:${CoreModule.name}`, PREFIX, {}, opts);

    // Read configuration
    const config = new pulumi.Config('auth');
    const authTenantId = config.get('tenantId');
    const cpu = config.get('cpu') || '1';
    const memory = config.get('memory') || '300Mi';
    const concurrency = config.getNumber('concurrency') || 80;
    const image = config.get('serviceImage') || 'europe-west1-docker.pkg.dev/startupsdna-tools/admin-services/core:0.1.0';

    // Define resources
    const envs: gcp.types.input.cloudrunv2.ServiceTemplateContainerEnv[] = [
      {
        name: 'COMPANY_NAME',
        value: globalConfig.companyName,
      },
      {
        name: 'FIREBASE_PROJECT_ID',
        value: firebaseConfig.projectId || globalConfig.project,
      },
      {
        name: 'FIREBASE_API_KEY',
        value: firebaseConfig.apiKey,
      },
      {
        name: 'ADMIN_AUTH_TENANT_ID',
        value: authTenantId,
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
    }, {
      parent: this,
    });

    // Create an IAM member to allow the service to be publicly accessible.
    new gcp.cloudrun.IamMember(`${PREFIX}-service-invoker`, {
      location: globalConfig.location,
      service: this.service.name,
      role: 'roles/run.invoker',
      member: 'allUsers',
    }, {
      parent: this,
    });

    this.serviceNeg = new gcp.compute.RegionNetworkEndpointGroup(`${PREFIX}-neg`, {
      region: globalConfig.location,
      cloudRun: {
        service: this.service.name,
      },
    }, {
      parent: this,
    });

    this.serviceBackend = new gcp.compute.BackendService(`${PREFIX}-service-backend`, {
      protocol: 'HTTPS',
      loadBalancingScheme: 'EXTERNAL_MANAGED',
      backends: [
        {
          group: this.serviceNeg.id,
        },
      ],
    }, {
      parent: this,
    });
  }
}