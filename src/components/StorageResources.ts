import * as gcp from '@pulumi/gcp';
import { globalConfig } from '../config';

export class StorageResources {
  readonly bucket: gcp.storage.Bucket;

  constructor() {
    const bucketName = `${globalConfig.project}-storage`;
    this.bucket = new gcp.storage.Bucket(
      'admin-storage-bucket',
      {
        name: bucketName,
        location: globalConfig.location,
        storageClass: 'STANDARD',
        uniformBucketLevelAccess: true,
      },
      {
        import: globalConfig.importMode ? bucketName : undefined,
        retainOnDelete: true,
      },
    );
  }
}
