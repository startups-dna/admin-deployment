import { configDotenv } from 'dotenv';
import { handleError } from '../inc/common.mjs';
import {
  checkGCloudCli,
  gcloudAuth,
  getGcpDefaultProject,
  getGcpDefaultRegion,
  initKmsKey,
} from '../inc/gcloud.mjs';
import {
  checkPulumiCli,
  checkPulumiStack,
  pulumiLogin,
} from '../inc/pulumi.mjs';
import { echo } from '../inc/echo.mjs';
import { execa } from 'execa';

configDotenv({ override: true });

export async function migrateSecretsProviderAction() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();
  await pulumiLogin();
  await checkPulumiStack();
  const stackName = await execa`pulumi stack --show-name`.then(
    ({ stdout }) => stdout,
  );
  const kmsKey = await initKmsKey({
    project: getGcpDefaultProject(),
    location: getGcpDefaultRegion(),
    keyRing: 'pulumi',
    key: stackName,
  });
  const secretsProvider = `gcpkms://${kmsKey}`;
  await execa`pulumi stack change-secrets-provider ${secretsProvider}`;
  echo.success(`Secrets provider changed successfully.`);
}
