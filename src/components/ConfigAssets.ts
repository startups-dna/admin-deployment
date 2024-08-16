import * as gcp from '@pulumi/gcp';
import { globalConfig } from '../config';

const PREFIX = 'config-assets';

export class ConfigAssets {
  constructor() {
    const systemConfig = {
      companyName: globalConfig.companyName,
      modules: [
        {
          name: 'Company Management',
          baseUrl: '/company',
          baseApiUrl: '/company/api',
        },
      ],
      navLinks: [],
    };

    if (globalConfig.modules?.appTools) {
      systemConfig.modules.push({
        name: 'App Tools',
        baseUrl: '/app-tools',
        baseApiUrl: '/app-tools/api',
      });
    }

    if (globalConfig.modules?.appCms) {
      systemConfig.modules.push({
        name: 'App CMS',
        baseUrl: '/app-cms',
        baseApiUrl: '/app-cms/api',
      });
    }

    const bucket = new gcp.storage.Bucket(`${PREFIX}-bucket`, {
      name: `${globalConfig.project}-config-assets`,
      location: globalConfig.location,
      storageClass: 'STANDARD',
      uniformBucketLevelAccess: true,
    });

    new gcp.storage.BucketIAMMember(`${PREFIX}-bucket-iam`, {
      bucket: bucket.name,
      role: 'roles/storage.objectViewer',
      member: 'allUsers',
    });

    new gcp.storage.BucketObject(`${PREFIX}-system-json`, {
      bucket: bucket.name,
      content: JSON.stringify(systemConfig),
      contentType: 'application/json',
    });
  }
}
