import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { globalConfig } from '../config';
import { HasOutput } from '../interfaces';

export type LoadBalancerArgs = {
  defaultService: pulumi.Output<string>;
};

export class LoadBalancer
  extends pulumi.ComponentResource
  implements HasOutput
{
  readonly urlMap: gcp.compute.URLMap;
  readonly sslCert: gcp.compute.ManagedSslCertificate;
  readonly httpsProxy: gcp.compute.TargetHttpsProxy;
  readonly globalAddress: Promise<gcp.compute.GetGlobalAddressResult>;
  private pathRules: gcp.types.input.compute.URLMapPathMatcherPathRule[] = [];

  constructor(args: LoadBalancerArgs, opts?: pulumi.ComponentResourceOptions) {
    super(`startupsdna:admin:${LoadBalancer.name}`, 'admin-lb', args, opts);

    // Define URL map
    this.urlMap = new gcp.compute.URLMap(
      'admin-url-map',
      {
        hostRules: [
          {
            hosts: [globalConfig.domain],
            pathMatcher: 'path-matcher',
          },
        ],
        defaultUrlRedirect: {
          stripQuery: false,
          hostRedirect: globalConfig.domain,
          httpsRedirect: true,
        },
        pathMatchers: [
          {
            name: 'path-matcher',
            defaultService: args.defaultService,
            pathRules: this.pathRules,
          },
        ],
      },
      {
        parent: this,
      },
    );

    this.sslCert = new gcp.compute.ManagedSslCertificate(
      'admin-ssl',
      {
        managed: {
          domains: [globalConfig.domain],
        },
      },
      {
        parent: this,
      },
    );

    // Define HTTP proxies
    this.httpsProxy = new gcp.compute.TargetHttpsProxy(
      'admin-target-https-proxy',
      {
        urlMap: this.urlMap.id,
        sslCertificates: [this.sslCert.id],
      },
      {
        parent: this,
      },
    );

    this.globalAddress = gcp.compute.getGlobalAddress(
      {
        name: globalConfig.ipName,
      },
      {
        parent: this,
      },
    );

    // Define global forwarding rule
    new gcp.compute.GlobalForwardingRule(
      'admin-forwarding-rule',
      {
        target: this.httpsProxy.id,
        ipAddress: this.globalAddress.then(({ id }) => id),
        portRange: '443',
        loadBalancingScheme: 'EXTERNAL_MANAGED',
      },
      {
        parent: this,
      },
    );
  }

  addPathRules(pathRules: gcp.types.input.compute.URLMapPathMatcherPathRule[]) {
    this.pathRules.push(...pathRules);
  }

  output() {
    return {
      domain: globalConfig.domain,
      ipAddress: pulumi.Output.create(
        this.globalAddress.then(({ address }) => address),
      ),
      url: pulumi.interpolate`https://${globalConfig.domain}`,
    };
  }
}
