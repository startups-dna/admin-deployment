import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import { globalConfig } from '../config';
import { authServiceBackend } from './auth';
import { companyServiceBackend } from './company';

// Define service map
const serviceMap = new Map<string, pulumi.Output<string>>();
serviceMap.set('company', companyServiceBackend.id);

// Define URL map
const urlMap = new gcp.compute.URLMap('admin-lb', {
  hostRules: [{
    hosts: [globalConfig.domain],
    pathMatcher: 'path-matcher',
  }],
  defaultUrlRedirect: {
    stripQuery: false,
    hostRedirect: globalConfig.domain,
    httpsRedirect: true,
  },
  pathMatchers: [{
    name: 'path-matcher',
    defaultUrlRedirect: {
      pathRedirect: `/${globalConfig.defaultService}`,
      stripQuery: true,
    },
    pathRules: [
      {
        paths: ['/auth', '/auth/*'],
        service: authServiceBackend.id,
      },
      ...Array.from(serviceMap.entries()).map(([path, service]) => ({
        paths: [`/${path}`, `/${path}/*`],
        service,
      })),
    ],
  }],
});

const adminSslCert = new gcp.compute.ManagedSslCertificate('admin-ssl', {
  managed: {
    domains: [globalConfig.domain],
  },
});

// Define HTTP proxies
const httpsProxy = new gcp.compute.TargetHttpsProxy('admin-target-https-proxy', {
  urlMap: urlMap.id,
  sslCertificates: [adminSslCert.id],
});

// Define IP address
// export const adminIP = new gcp.compute.GlobalAddress('admin-ip', {
//   addressType: 'EXTERNAL',
// });
export const adminIP = gcp.compute.getGlobalAddress({
  name: globalConfig.ipName,
});

// Define global forwarding rule
new gcp.compute.GlobalForwardingRule('admin-forwarding-rule', {
  target: httpsProxy.id,
  ipAddress: adminIP.then(({ id }) => id),
  portRange: '443',
  loadBalancingScheme: 'EXTERNAL_MANAGED',
});

// Export the URL of the load balancer
export const adminUrl = pulumi.interpolate`https://${globalConfig.domain}`;
