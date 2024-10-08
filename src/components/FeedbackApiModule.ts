import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { globalConfig } from '../config';
import { DatabaseResources } from './DatabaseResources';
import { GoogleApisResources } from './GoogleApisResources';
import { HasOutput } from '../interfaces';
import { MODULE_VERSIONS } from '../constants';

const PREFIX = 'feedback-api';

type FeedbackApiModuleArgs = {
  googleApis: GoogleApisResources;
  database: DatabaseResources;
  storageBucketName: pulumi.Input<string>;
};

export class FeedbackApiModule
  extends pulumi.ComponentResource
  implements HasOutput
{
  readonly service: gcp.cloudrunv2.Service;
  readonly serviceBackend: gcp.compute.BackendService;
  readonly urlMap: gcp.compute.URLMap;
  readonly sslCert: gcp.compute.ManagedSslCertificate;
  readonly httpsProxy: gcp.compute.TargetHttpsProxy;
  readonly globalAddress: Promise<gcp.compute.GetGlobalAddressResult>;
  readonly domain: string;

  constructor(
    args: FeedbackApiModuleArgs,
    opts: pulumi.ComponentResourceOptions = {},
  ) {
    super(`startupsdna:feedback:${FeedbackApiModule.name}`, PREFIX, args, opts);

    // get configuration
    const config = new pulumi.Config('feedbackApi');
    const serviceImage =
      config.get('serviceImage') ||
      `europe-west1-docker.pkg.dev/startupsdna-tools/admin-services/feedback-api:${MODULE_VERSIONS.appTools}`;
    this.domain = config.require('domain');
    const ipName = config.require('ipName');

    // create resources

    new gcp.projects.Service(
      'gmail-api',
      {
        service: 'gmail.googleapis.com',
        disableOnDestroy: false,
      },
      {
        parent: this,
      },
    );

    this.service = new gcp.cloudrunv2.Service(
      `${PREFIX}-service`,
      {
        location: globalConfig.location,
        template: {
          containers: [
            {
              image: serviceImage,
              envs: [
                ...args.database.serviceEnvs,
                {
                  name: 'LOGGER',
                  value: 'gcloud',
                },
                {
                  name: 'LOGGER_NAME',
                  value: 'feedback-api',
                },
                {
                  name: 'LOGGER_LEVEL',
                  value: 'debug',
                },
                {
                  name: 'FIREBASE_BUCKET_NAME',
                  value: args.storageBucketName,
                },
              ],
              volumeMounts: [{ name: 'cloudsql', mountPath: '/cloudsql' }],
            },
          ],
          volumes: [
            {
              name: 'cloudsql',
              cloudSqlInstance: {
                instances: [args.database.sqlInstance.connectionName],
              },
            },
          ],
        },
      },
      {
        dependsOn: [args.googleApis.run],
        parent: this,
      },
    );

    new gcp.cloudrun.IamMember(
      `${PREFIX}-service-invoker`,
      {
        service: this.service.name,
        role: 'roles/run.invoker',
        member: 'allUsers',
      },
      {
        parent: this,
      },
    );

    const serviceNEG = new gcp.compute.RegionNetworkEndpointGroup(
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
            group: serviceNEG.id,
          },
        ],
      },
      {
        parent: this,
      },
    );

    this.urlMap = new gcp.compute.URLMap(
      `${PREFIX}-url-map`,
      {
        hostRules: [
          {
            hosts: [this.domain],
            pathMatcher: 'path-matcher',
          },
        ],
        defaultService: this.serviceBackend.id,
        pathMatchers: [
          {
            name: 'path-matcher',
            defaultService: this.serviceBackend.id,
          },
        ],
      },
      {
        parent: this,
      },
    );

    this.sslCert = new gcp.compute.ManagedSslCertificate(
      `${PREFIX}-ssl`,
      {
        managed: {
          domains: [this.domain],
        },
      },
      {
        parent: this,
      },
    );

    // Define HTTP proxies
    this.httpsProxy = new gcp.compute.TargetHttpsProxy(
      `${PREFIX}-target-https-proxy`,
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
        name: ipName,
      },
      {
        parent: this,
      },
    );

    // Define global forwarding rule
    new gcp.compute.GlobalForwardingRule(
      `${PREFIX}-forwarding-rule`,
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

  output() {
    return {
      domain: this.domain,
      ipAddress: pulumi.Output.create(
        this.globalAddress.then(({ address }) => address),
      ),
      url: pulumi.interpolate`https://${this.domain}`,
      serviceName: this.service.name,
    };
  }
}
