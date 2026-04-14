# Google Auth Setup

This note covers the current plan for Google Sheets and Google Drive auth for the receipt feature.

## Development

For local development, use Application Default Credentials through service account impersonation.

Why this is the preferred local setup:

- no service account JSON key needs to be stored on disk
- the project already blocks new key creation for this service account
- local code can use `google.auth.default()` and still act as the `receipts-api` service account

Current setup:

- active GCP project: `receipts-492820`
- service account: `receipts-api@receipts-492820.iam.gserviceaccount.com`
- required APIs already enabled:
  - Google Drive API
  - Google Sheets API

Local workflow:

1. Make sure your user can impersonate the service account:

```cmd
gcloud iam service-accounts add-iam-policy-binding receipts-api@receipts-492820.iam.gserviceaccount.com --member=user:cameron@mattsappliancesla.net --role=roles/iam.serviceAccountTokenCreator
```

2. Log in for local ADC using impersonation:

```cmd
gcloud auth application-default login --impersonate-service-account=receipts-api@receipts-492820.iam.gserviceaccount.com
```

3. Verify ADC works:

```cmd
gcloud auth application-default print-access-token
```

If that command succeeds, local Python code should be able to use:

```python
import google.auth
from googleapiclient.discovery import build

creds, project = google.auth.default()

sheets = build("sheets", "v4", credentials=creds)
drive = build("drive", "v3", credentials=creds)
```

## Resource Access

The service account must be granted access to the actual Google resources.

Share these with:

`receipts-api@receipts-492820.iam.gserviceaccount.com`

Grant Editor access to:

- the target Google Sheet
- the target Google Drive folder for receipt files
- the target Google Drive folder for generated affidavit files, if that is kept separate

Important:

- domain-wide delegation is not required for this use case if the app only needs access to specifically shared Drive and Sheets resources
- domain-wide delegation is only needed if the app must impersonate Workspace users across the domain

## Deployment

Deployment auth is different from local development.

The deployed app runs on a Linode Ubuntu server, not on Google Cloud. Because of that, the production server will not inherit local `gcloud` login state or Google-managed workload identity automatically.

Production implications:

- local impersonation through `gcloud auth application-default login --impersonate-service-account=...` is for development only
- the Linode server needs its own way to authenticate to Google APIs
- production should never depend on a developer workstation being logged in

Current recommended production plan for Linode:

- authenticate the deployed backend as `receipts-api@receipts-492820.iam.gserviceaccount.com`
- keep credentials outside the repository
- load credential location from environment variables on the Ubuntu server

Because this project currently has an org policy blocking new service account key creation:

- `constraints/iam.disableServiceAccountKeyCreation`

production cannot rely on generating a brand new JSON key unless that policy is changed or an exception is granted.

That means production currently has three possible paths:

1. Use an existing service account key file if the original JSON was already downloaded and is still available.
2. Request a policy exception or admin change so a new key can be created for Linode deployment.
3. Rework deployment auth to use a non-key approach, but that is usually harder on a non-Google host like Linode.

## Preferred Linode Credential Handling

If production ends up using a service account JSON on Linode:

- store the JSON outside the repo, for example in a protected server directory
- restrict filesystem permissions so only the app user can read it
- reference it by environment variable
- never place it in git

Suggested env var name:

```env
GOOGLE_SERVICE_ACCOUNT_FILE=/opt/mattsteamportal/secrets/receipts-api.json
```

Then production code can load that file explicitly.

## Development vs Production Summary

Development:

- use ADC with service account impersonation
- use `google.auth.default()`
- no JSON key file required locally

Production on Linode:

- do not depend on local ADC or a developer `gcloud` session
- most likely use an explicit service account credential file stored on the server outside the repo
- if key creation remains blocked, production setup is blocked until an existing key is found or policy is adjusted

## Repo Safety

This repo now ignores common local credential filenames in `server/`, including:

- `server/google-credentials*.json`
- `server/*service-account*.json`
- `server/*adc*.json`

That is only to protect local secret files if a key-based fallback is ever used.
