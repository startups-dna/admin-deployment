import { echo } from './echo.mjs';
import { $ } from 'execa';
import { getGcpProject } from './gcloud.mjs';

export function getStateBucketId() {
  const gcpProject = getGcpProject();
  return `gs://${gcpProject}-pulumi-state`;
}

export async function checkStateBucket() {
  echo.info(`Checking Pulumi state bucket ...`);
  const gcpProject = getGcpProject();
  const stateBucketId = getStateBucketId();
  try {
    await $`gcloud storage buckets describe ${stateBucketId} --project=${gcpProject}`;
    echo.success(`Pulumi state bucket OK: ${stateBucketId}`);
  } catch (e) {
    echo.warn(`Not found. Creating Pulumi state bucket [${stateBucketId}]...`);
    await createStateBucket();
  }
}

async function createStateBucket() {
  const gcpProject = getGcpProject();
  const stateBucketId = getStateBucketId();
  await $({ stdio: 'inherit' })`gcloud storage buckets create ${stateBucketId}
    --location=EUROPE-WEST1
    --default-storage-class=STANDARD
    --public-access-prevention
    --uniform-bucket-level-access
    --project=${gcpProject}`;
}