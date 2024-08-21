## Install

```bash
npm install
```

## Setup

1. Create Google Cloud project (name example: `MyCompany Admin`).

2. Run the following commands to set up the project:

   ```bash
   ./setup
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
./deploy
```

## Admin access

In order to initialize the admin user, run the following command:

```bash
./init-admin
```

## Alter mode

If you want to alter the deployment configuration, you can run the command with special flag:

```bash
./deploy --alter
```
