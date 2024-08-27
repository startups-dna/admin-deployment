import * as gcp from '@pulumi/gcp';

export class GoogleApisResources {
  readonly run = new gcp.projects.Service('run-api', {
    service: 'run.googleapis.com',
    disableOnDestroy: false,
  });

  readonly secretManager = new gcp.projects.Service('secretmanager-api', {
    service: 'secretmanager.googleapis.com',
    disableOnDestroy: false,
  });

  readonly cloudScheduler = new gcp.projects.Service('cloudscheduler-api', {
    service: 'cloudscheduler.googleapis.com',
    disableOnDestroy: false,
  });
}
