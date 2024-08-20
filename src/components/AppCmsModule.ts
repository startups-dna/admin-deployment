import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { firebaseConfig, globalConfig } from '../config';

const PREFIX = 'admin-app-cms';

type GcpRunService = {
  project: string;
  name: string;
};

export class AppCmsModule extends pulumi.ComponentResource {
  service: pulumi.Output<gcp.cloudrunv2.GetServiceResult>;
  backendService: gcp.compute.BackendService;
  serviceNeg: gcp.compute.GlobalNetworkEndpointGroup;
  serviceNe: gcp.compute.GlobalNetworkEndpoint;

  constructor(opts: pulumi.ComponentResourceOptions = {}) {
    super(`startupsdna:admin:${AppCmsModule.name}`, PREFIX, {}, opts);

    // Read configuration
    const config = new pulumi.Config('appCms');
    const project = config.require('project');
    const gcpRunService = config.require('gcpRunService');
    const [serviceLocation, serviceName] = gcpRunService.split('/');

    // get a Cloud Run service
    this.service = gcp.cloudrunv2.getServiceOutput({
      project: project,
      location: serviceLocation,
      name: serviceName,
    });

    this.serviceNeg = new gcp.compute.GlobalNetworkEndpointGroup(
      `${PREFIX}-neg`,
      {
        networkEndpointType: 'INTERNET_FQDN_PORT',
      },
      {
        parent: this,
      },
    );

    this.serviceNe = new gcp.compute.GlobalNetworkEndpoint(
      `${PREFIX}-ne`,
      {
        globalNetworkEndpointGroup: this.serviceNeg.id,
        fqdn: 'run.app',
        port: 443,
      },
      {
        parent: this,
      },
    );

    const hostHeader = this.service.uri.apply((uri) => {
      return 'Host: ' + uri.replace('https://', '');
    });

    this.backendService = new gcp.compute.BackendService(
      `${PREFIX}-backend-service`,
      {
        protocol: 'HTTPS',
        loadBalancingScheme: 'EXTERNAL_MANAGED',
        backends: [
          {
            group: this.serviceNeg.id,
          },
        ],
        customRequestHeaders: [hostHeader],
      },
      {
        parent: this,
      },
    );
  }
}
