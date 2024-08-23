import { configDotenv } from 'dotenv';
import { handleError } from './inc/common.mjs';
import { checkGCloudCli, gcloudAuth } from './inc/gcloud.mjs';
import {
  checkPulumiCli,
  checkPulumiStack,
  getPulumiStackOutput,
  pulumiLogin,
  pulumiUp,
} from './inc/pulumi.mjs';
import { initStackConfig } from './inc/stackConfig.mjs';
import { runMigrations } from './inc/migrations.mjs';
import { echo } from './inc/echo.mjs';
import chalk from 'chalk';

configDotenv({ override: true });

async function main() {
  await checkGCloudCli();
  await checkPulumiCli();
  await gcloudAuth();
  await pulumiLogin();
  await checkPulumiStack();
  await initStackConfig();
  await pulumiUp();
  await runMigrations();
  await dnsInfo();
}

async function dnsInfo() {
  const output = await getPulumiStackOutput();
  const records = [
    `${output.loadBalancer?.domain} -> ${output.loadBalancer?.ipAddress}`,
  ];

  if (output.feedbackApi?.domain && output.feedbackApi?.ipAddress) {
    records.push(
      `${output.feedbackApi?.domain} -> ${output.feedbackApi?.ipAddress}`,
    );
  }

  echo.infoBox(
    chalk.cyan`Make sure to update your DNS records with the following values:\n` +
      records.join('\n'),
  );
}

main().catch(handleError);
