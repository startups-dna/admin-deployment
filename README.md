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

3. Create new SQL instance in Google Cloud (name example: `main`):
   - Engine: PostgreSQL 15 or above;

4. Create new IP address in Google Cloud (name example: `admin-ip`).<br/> 
   Requirements:
      - Network Service Tier: Premium;
      - IP version: IPv4;
      - Type: Global;

5. Add DNS record for the IP address in your domain provider.<br/>
   Example:
   ```
   admin.mycompany.com. 3600 IN A
   ```
   
6. Enable Identity Platform in Google Cloud: https://console.cloud.google.com/marketplace/product/google-cloud-platform/customer-identity<br/>
   Requirements:
   - Add Provider: Email/Password;

7. Create API key in Google Cloud: https://console.cloud.google.com/apis/credentials;

8. Create Consent Screen in Google Cloud: https://console.cloud.google.com/apis/credentials/consent;
   - User Type: External;
   - Application Name: `MyCompany Admin`;

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
