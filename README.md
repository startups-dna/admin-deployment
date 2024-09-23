## Pre-requisites

Requirements:

- Node.js 18 or above;
- npm 10 or above;
- Google Cloud SDK;
- Pulumi CLI;

## Install

```bash
npm install
```

## Setup

1. Create Google Cloud project (name example: `MyCompany Admin`).

2. Run the following commands to set up the project:

   ```bash
   ./run setup
   ```

3. **This step is optional, if you didn't choose manual creation**. <br>
   Create new SQL instance in Google Cloud (name example: `main`):

   - Engine: PostgreSQL 15 or above;

4. Enable Identity Platform in Google Cloud: https://console.cloud.google.com/marketplace/product/google-cloud-platform/customer-identity<br/>
   Requirements:

   - Add Provider: Email/Password;

5. Create Consent Screen in Google Cloud: https://console.cloud.google.com/apis/credentials/consent;
   - User Type: External;
   - Application Name: `MyCompany Admin`;
   - Click **"Publish app"** after configuration.;

## Deployment

Run the following command to deploy:

```bash
./run deploy
```

## Admin access

In order to initialize the admin user access, run the following command:

```bash
./run init-admin
```

## Change configuration

If you want to change the deployment configuration, you can run the command with no arguments and choose the desired action:

```bash
./run
```
