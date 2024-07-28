import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import { globalConfig } from '../config';

export type LoadBalancerOpts = pulumi.ComponentResourceOptions & {
  defaultService: pulumi.Output<string>;
  serviceMap: Map<string, pulumi.Output<string>>;
};

export class LoadBalancer extends pulumi.ComponentResource {
  readonly urlMap: gcp.compute.URLMap;
  readonly sslCert: gcp.compute.ManagedSslCertificate;
  readonly httpsProxy: gcp.compute.TargetHttpsProxy;
  readonly globalAddress: Promise<gcp.compute.GetGlobalAddressResult>;
  readonly url: pulumi.Output<string>;

  constructor(opts: LoadBalancerOpts) {
    super('startupsdna:index:LoadBalancer', 'admin-lb', {}, opts);

    // Define URL map
    this.urlMap = new gcp.compute.URLMap('admin-lb', {
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
        defaultService: opts.defaultService,
        pathRules: [
          ...Array.from(opts.serviceMap.entries()).map(([path, service]) => ({
            paths: [`/${path}`, `/${path}/*`],
            service,
          })),
        ],
      }],
    });

    this.sslCert = new gcp.compute.ManagedSslCertificate('admin-ssl', {
      managed: {
        domains: [globalConfig.domain],
      },
    });

    // Define HTTP proxies
    this.httpsProxy = new gcp.compute.TargetHttpsProxy('admin-target-https-proxy', {
      urlMap: this.urlMap.id,
      sslCertificates: [this.sslCert.id],
    });

    this.globalAddress = gcp.compute.getGlobalAddress({
      name: globalConfig.ipName,
    });

    // Define global forwarding rule
    new gcp.compute.GlobalForwardingRule('admin-forwarding-rule', {
      target: this.httpsProxy.id,
      ipAddress: this.globalAddress.then(({ id }) => id),
      portRange: '443',
      loadBalancingScheme: 'EXTERNAL_MANAGED',
    });

    // Export the URL of the load balancer
    this.url = pulumi.interpolate`https://${globalConfig.domain}`;
  }
}
