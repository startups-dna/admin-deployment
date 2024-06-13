import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { globalConfig } from '../config';

const config = new pulumi.Config('home');
const homeServiceName = config.require('serviceName');

export const homeServiceNEG = new gcp.compute.RegionNetworkEndpointGroup('home-neg', {
  region: globalConfig.location,
  cloudRun: {
    service: homeServiceName,
  },
});

export const homeServiceBackend = new gcp.compute.BackendService('home-backend', {
  protocol: 'HTTPS',
  loadBalancingScheme: 'EXTERNAL_MANAGED',
  backends: [
    {
      group: homeServiceNEG.id,
    },
  ],
});

