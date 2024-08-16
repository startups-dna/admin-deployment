import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import * as random from '@pulumi/random';

type DatabaseComponentArgs = {
  instanceId: pulumi.Input<string>;
  dbName: pulumi.Input<string>;
  dbUser: pulumi.Input<string>;
};

export class DatabaseResources {
  readonly sqlInstance: gcp.sql.DatabaseInstance;
  readonly dbUrlSecret: gcp.secretmanager.Secret;
  readonly dbUrlSecretVersion: gcp.secretmanager.SecretVersion;

  constructor(
    name: string,
    args: DatabaseComponentArgs,
    opts: pulumi.ComponentResourceOptions = {},
  ) {
    const { parent } = opts;
    this.sqlInstance = gcp.sql.DatabaseInstance.get(
      `${name}-sql-instance`,
      args.instanceId,
      {},
      { parent },
    );

    const dbPassword = new random.RandomPassword(
      `${name}-db-password`,
      {
        length: 16,
        special: false,
      },
      {
        parent,
      },
    );

    const db = new gcp.sql.Database(
      `${name}-db`,
      {
        name: args.dbName,
        instance: this.sqlInstance.name,
      },
      {
        retainOnDelete: true,
        parent,
      },
    );

    const dbUser = new gcp.sql.User(
      `${name}-db-user`,
      {
        name: args.dbUser,
        instance: this.sqlInstance.name,
        type: 'BUILT_IN',
        password: dbPassword.result,
      },
      {
        retainOnDelete: true,
        parent,
      },
    );

    this.dbUrlSecret = new gcp.secretmanager.Secret(
      `${name}-db-url-secret`,
      {
        secretId: `${name}-db-url`,
        replication: {
          auto: {},
        },
      },
      {
        parent,
      },
    );

    const dbUrl = pulumi.interpolate`postgres://${dbUser.name}:${dbPassword.result}@localhost/${db.name}?schema=public&host=/cloudsql/${this.sqlInstance.connectionName}`;

    this.dbUrlSecretVersion = new gcp.secretmanager.SecretVersion(
      `${name}-db-url-secret-version`,
      {
        secret: this.dbUrlSecret.id,
        secretData: dbUrl,
      },
      {
        parent,
      },
    );
  }

  public get serviceEnvs(): gcp.types.input.cloudrunv2.ServiceTemplateContainerEnv[] {
    return [
      {
        name: 'DATABASE_URL',
        valueSource: {
          secretKeyRef: {
            secret: this.dbUrlSecret.secretId,
            version: this.dbUrlSecretVersion.version,
          },
        },
      },
    ];
  }

  public get jobEnvs(): gcp.types.input.cloudrunv2.JobTemplateTemplateContainerEnv[] {
    return [
      {
        name: 'DATABASE_URL',
        valueSource: {
          secretKeyRef: {
            secret: this.dbUrlSecret.secretId,
            version: this.dbUrlSecretVersion.version,
          },
        },
      },
    ];
  }
}
