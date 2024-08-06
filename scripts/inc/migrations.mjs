import { execa } from 'execa';
import { echo } from './echo.mjs';
import { getPulumiStackConfig, getPulumiStackOutput } from './pulumi.mjs';

export async function runMigrations() {
  echo.log('Gathering required data from stack...');
  const config = await getPulumiStackConfig();
  const output = await getPulumiStackOutput();

  echo.log('Running company db migration...');
  await execa({ stdio: 'inherit' })`gcloud run jobs execute ${output.company?.dbJobName} --wait --args=npx,prisma,migrate,deploy --region=${config['gcp:region']} --project=${config['gcp:project']}`;

  if (output.appTools?.dbJobName) {
    echo.log('Running app-tools db migration...');
    await execa({ stdio: 'inherit' })`gcloud run jobs execute ${output.appTools?.dbJobName} --wait --args=npx,prisma,migrate,deploy --region=${config['gcp:region']} --project=${config['gcp:project']}`;
  }
}
