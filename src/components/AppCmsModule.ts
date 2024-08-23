import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { HasOutput, HasPathRules } from '../interfaces';

const PREFIX = 'admin-app-cms';

export class AppCmsModule
  extends pulumi.ComponentResource
  implements HasOutput, HasPathRules
{
  apiService: pulumi.Output<gcp.cloudrunv2.GetServiceResult>;
  uiService: pulumi.Output<gcp.cloudrunv2.GetServiceResult>;
  apiBackendService: gcp.compute.BackendService;
  uiBackendService: gcp.compute.BackendService;
  serviceNeg: gcp.compute.GlobalNetworkEndpointGroup;
  serviceNe: gcp.compute.GlobalNetworkEndpoint;

  constructor(opts: pulumi.ComponentResourceOptions = {}) {
    super(`startupsdna:admin:${AppCmsModule.name}`, PREFIX, {}, opts);

    // Read configuration
    const config = new pulumi.Config('appCms');
    const project = config.require('project');
    const [apiServiceLocation, apiServiceName] = config
      .require('apiService')
      .split('/');
    const [uiServiceLocation, uiServiceName] = config
      .require('uiService')
      .split('/');

    // get a Cloud Run services
    this.apiService = gcp.cloudrunv2.getServiceOutput({
      project: project,
      location: apiServiceLocation,
      name: apiServiceName,
    });

    this.uiService = gcp.cloudrunv2.getServiceOutput({
      project: project,
      location: uiServiceLocation,
      name: uiServiceName,
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

    const apiHostHeader = this.apiService.uri.apply((uri) => {
      return 'Host: ' + uri.replace('https://', '');
    });

    this.apiBackendService = new gcp.compute.BackendService(
      `${PREFIX}-api-backend-service`,
      {
        protocol: 'HTTPS',
        loadBalancingScheme: 'EXTERNAL_MANAGED',
        backends: [
          {
            group: this.serviceNeg.id,
          },
        ],
        customRequestHeaders: [apiHostHeader],
      },
      {
        parent: this,
      },
    );

    const uiHostHeader = this.uiService.uri.apply((uri) => {
      return 'Host: ' + uri.replace('https://', '');
    });

    this.uiBackendService = new gcp.compute.BackendService(
      `${PREFIX}-ui-backend-service`,
      {
        protocol: 'HTTPS',
        loadBalancingScheme: 'EXTERNAL_MANAGED',
        backends: [
          {
            group: this.serviceNeg.id,
          },
        ],
        customRequestHeaders: [uiHostHeader],
      },
      {
        parent: this,
      },
    );
  }

  pathRules() {
    return [
      {
        paths: ['/app-cms/api', '/app-cms/api/*'],
        service: this.apiBackendService.id,
      },
      {
        paths: ['/app-cms', '/app-cms/*'],
        service: this.uiBackendService.id,
      },
    ];
  }

  output() {
    return {
      apiServiceName: this.apiService.name,
      uiServiceName: this.uiService.name,
    };
  }
}
