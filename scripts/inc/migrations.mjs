import { execa } from 'execa';
import { oraPromise } from 'ora';
import { getPulumiStackConfig, getPulumiStackOutput } from './pulumi.mjs';

export async function runMigrations() {
  const { config, output } = await oraPromise(
    async () => {
      const config = await getPulumiStackConfig();
      const output = await getPulumiStackOutput();
      return { config, output };
    },
    {
      text: 'Gathering required data from stack...',
    },
  );

  await oraPromise(
    () =>
      execa`gcloud run jobs execute ${output.company?.dbJobName} --wait --args=npx,prisma,migrate,deploy --region=${config['gcp:region']} --project=${config['gcp:project']}`,
    {
      text: 'Running "company-db" migration...',
      successText: '"company-db" migration done.',
    },
  );

  if (output.appTools?.dbJobName) {
    await oraPromise(
      () =>
        execa`gcloud run jobs execute ${output.appTools?.dbJobName} --wait --args=npx,prisma,migrate,deploy --region=${config['gcp:region']} --project=${config['gcp:project']}`,
      {
        text: 'Running "app-tools-db" migration...',
        successText: '"app-tools-db" migration done.',
      },
    );
  }
}
