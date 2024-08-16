import * as gcp from '@pulumi/gcp';
import { globalConfig } from '../config';

export class StorageResources {
  readonly bucket: gcp.storage.Bucket;

  constructor() {
    this.bucket = new gcp.storage.Bucket(
      'admin-storage-bucket',
      {
        name: `${globalConfig.project}-storage`,
        location: globalConfig.location,
        storageClass: 'STANDARD',
        uniformBucketLevelAccess: true,
      },
      { retainOnDelete: true },
    );
  }
}
