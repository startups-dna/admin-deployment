import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import * as inputs from '@pulumi/gcp/types/input';

export type SecretResourcesArgs = {
  data: string;
};

export class SecretResources {
  private suffix: random.RandomString;
  readonly secret: gcp.secretmanager.Secret;
  readonly secretVersion: gcp.secretmanager.SecretVersion;

  constructor(
    name: string,
    args: SecretResourcesArgs,
    opts: pulumi.ComponentResourceOptions = {},
  ) {
    this.suffix = new random.RandomString(
      `${name}-suffix`,
      {
        length: 7,
        special: false,
        upper: false,
      },
      {
        parent: opts.parent,
      },
    );

    this.secret = new gcp.secretmanager.Secret(
      `${name}-secret`,
      {
        secretId: pulumi.interpolate`${name}-${this.suffix.result}`,
        replication: {
          auto: {},
        },
      },
      {
        parent: opts.parent,
      },
    );

    this.secretVersion = new gcp.secretmanager.SecretVersion(
      `${name}-secret-version`,
      {
        secret: this.secret.id,
        secretData: args.data,
      },
      {
        parent: opts.parent,
      },
    );
  }

  envValueSource(): gcp.types.input.cloudrunv2.ServiceTemplateContainerEnvValueSource {
    return {
      secretKeyRef: {
        secret: this.secret.secretId,
        version: this.secretVersion.version,
      },
    };
  }
}
