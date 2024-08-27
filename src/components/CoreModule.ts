import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { GoogleApisResources } from './GoogleApisResources';
import { globalConfig } from '../config';
import { HasOutput } from '../interfaces';

const PREFIX = 'admin-core';

type CoreModuleArgs = {
  googleApis: GoogleApisResources;
};

export class CoreModule extends pulumi.ComponentResource implements HasOutput {
  service: gcp.cloudrunv2.Service;
  serviceBackend: gcp.compute.BackendService;
  serviceNeg: gcp.compute.RegionNetworkEndpointGroup;

  constructor(
    args: CoreModuleArgs,
    opts: pulumi.ComponentResourceOptions = {},
  ) {
    super(`startupsdna:admin:${CoreModule.name}`, PREFIX, args, opts);

    // Read configuration
    const authConfig = new pulumi.Config('auth');
    const authTenantId = authConfig.get('tenantId');
    const config = new pulumi.Config('core');
    const cpu = config.get('cpu') || '1';
    const memory = config.get('memory') || '300Mi';
    const concurrency = config.getNumber('concurrency') || 80;
    const image =
      config.get('serviceImage') ||
      'europe-west1-docker.pkg.dev/startupsdna-tools/admin-services/core:0.3.2';

    // Define resources
    const apiKey = new gcp.projects.ApiKey(`${PREFIX}-web-api-key`, {
      displayName: 'Web API Key',
      restrictions: {
        browserKeyRestrictions: {
          allowedReferrers: [`${globalConfig.domain}/*`],
        },
      },
    });

    const envs: gcp.types.input.cloudrunv2.ServiceTemplateContainerEnv[] = [
      {
        name: 'COMPANY_NAME',
        value: globalConfig.companyName,
      },
      {
        name: 'FIREBASE_API_KEY',
        value: apiKey.keyString,
      },
      {
        name: 'ADMIN_AUTH_PROJECT_ID',
        value: globalConfig.project,
      },
    ];

    if (authTenantId) {
      envs.push({
        name: 'ADMIN_AUTH_TENANT_ID',
        value: authTenantId,
      });
    }

    // Create a Cloud Run service
    this.service = new gcp.cloudrunv2.Service(
      `${PREFIX}-service`,
      {
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
          scaling: {
            minInstanceCount: 1,
            maxInstanceCount: 1,
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
        location: globalConfig.location,
        service: this.service.name,
        role: 'roles/run.invoker',
        member: 'allUsers',
      },
      {
        parent: this,
      },
    );

    this.serviceNeg = new gcp.compute.RegionNetworkEndpointGroup(
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
            group: this.serviceNeg.id,
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
    };
  }
}
