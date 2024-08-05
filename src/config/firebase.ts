import * as pulumi from '@pulumi/pulumi';
// import { readFileSync } from 'node:fs';

const config = new pulumi.Config('firebase');
const projectId = config.get('projectId');
const apiKey = config.require<string>('apiKey');
// const credentialsPath = config.require('credentials');
// const credentials = JSON.parse(readFileSync(credentialsPath).toString());

export const firebaseConfig = {
  projectId,
  apiKey,
  // credentials,
}