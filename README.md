# Setup

- Enable Google Cloud Platform APIs:
  - [IAM](https://console.cloud.google.com/apis/library/iam.googleapis.com)
  - [Compute Engine](https://console.cloud.google.com/apis/library/compute.googleapis.com)
  - [Run](https://console.cloud.google.com/apis/library/run.googleapis.com)
  - [Storage](https://console.cloud.google.com/apis/library/storage-component.googleapis.com)
- Create a service account in [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
  and download the JSON key. Save it as `credentials.json` in the root directory of this project.
- Grant the service account the following roles:
  - Editor