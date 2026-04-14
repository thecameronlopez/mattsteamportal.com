# Receipt Feature Progress

This file is a handoff note so work can resume quickly.

## Date

`2026-04-10`

## What Was Reviewed

- scanned the current app structure in `mattsteamportal.com`
- scanned the reference prototype in `D:\repos\receipts-form`
- reviewed the current receipt model and receipt API stub
- reviewed current Google Cloud CLI and local auth setup

## Current App State

Receipt-related files already exist:

- `server/app/models/receipts.py`
- `server/app/api/receipts.py`
- `server/app/tools.py`

Current status:

- the `Receipt` model exists
- the receipt blueprint is registered
- the receipt route file is mostly still a stub
- no receipt migration exists yet

## Google Setup Completed

Verified locally:

- active GCP project: `receipts-492820`
- active user account: `cameron@mattsappliancesla.net`
- Google Drive API is enabled
- Google Sheets API is enabled
- service account exists:
  - `receipts-api@receipts-492820.iam.gserviceaccount.com`

Important discovery:

- local ADC originally used `authorized_user`
- no service account JSON key was found on disk
- new key creation is blocked by org policy:
  - `constraints/iam.disableServiceAccountKeyCreation`

What was fixed:

- added `roles/iam.serviceAccountTokenCreator` so `cameron@mattsappliancesla.net` can impersonate the service account
- local ADC impersonation was tested and succeeded

Result:

- local development can use ADC with service account impersonation
- local Python should be able to use `google.auth.default()`

## Shared Google Resources

The service account has now been granted access to:

- the target Google Sheet
- the target Google Drive folder

Configured env values:

```env
GOOGLE_SHEETS_ID="1iu06stEJ2jThb-7cogppETzW2ZHFLDgtA9IzP3bF-Hk"
GOOGLE_SHEETS_RANGE="log!A2:W5000"
GOOGLE_DRIVE_FOLDER_ID="11tIH0jg-w8aHO_AuAkDS1fbgWA5JdTfN"
```

Recommendation discussed:

- prefer `GOOGLE_SHEETS_RANGE="log!A:W"` for append operations
- row 1 being headers is not a problem when using Sheets append

## Affidavit Decision

Affidavits will be digital form submissions only.

That means:

- no affidavit PDF generation is needed
- no affidavit file upload is needed
- affidavit data should live only in the database record

Because of that, the receipt model should be simplified.

Current model still assumes missing-receipt affidavits require file fields:

- `affidavit_uid`
- `affidavit_file_url`
- `affidavit_drive_file_id`

Those should be removed if affidavits are truly data-only.

Missing receipt records should only require:

- `missing_receipt = true`
- `missing_receipt_reason`

Normal receipt records should require:

- uploaded receipt file
- Drive file id/url

## Packages Added

Google backend packages were installed for the server:

- `google-api-python-client`
- `google-auth`
- `google-auth-httplib2`

## Docs Added Today

- `server/GOOGLE_AUTH_SETUP.md`

That file was updated to distinguish:

- local development auth
- Linode Ubuntu deployment auth

## Deployment Reality

The deployed app runs on a Linode Ubuntu server.

Important consequence:

- production cannot rely on local `gcloud` login state
- production auth must be handled separately

Most likely production plan:

- use a service account credential outside the repo on the Linode server
- load it from environment/config

Known blocker:

- new service account key creation is currently blocked by policy
- production setup will need either:
  - the original existing key file
  - a policy exception / admin change
  - or another production auth strategy

## Recommended Next Steps

1. Update `server/app/models/receipts.py` to match the new affidavit-as-data-only plan.
2. Add Google config reads to `server/config.py`.
3. Decide whether to change `GOOGLE_SHEETS_RANGE` from `log!A2:W5000` to `log!A:W`.
4. Create the Alembic migration for the receipts table.
5. Build a Google helper/service layer:
   - auth/client builder
   - Drive upload helper
   - Sheets append helper
6. Implement the receipt submission service.
7. Implement the receipt submission route in `server/app/api/receipts.py`.

## Suggested Receipt Flow

Normal receipt:

- receive form data + uploaded file
- upload receipt to Drive
- create DB row
- append row to Google Sheet

Missing receipt:

- receive form data with `missing_receipt = true`
- do not upload a file
- create DB row with `missing_receipt_reason`
- append row to Google Sheet

## Notes

- local dev Google auth is in a good place now
- the main app-side blocker is the receipt model still reflecting the older affidavit-file idea
- once the model is corrected, service and route work should be straightforward

---

## Update

`2026-04-13`

## Current Receipt Status

Receipt backend progress since the original note:

- `server/app/models/receipts.py` now exists and reflects the current receipt shape
- `server/app/api/receipts.py` now has a real submission route
- `server/app/services/receipts_service.py` now exists
- Google Drive upload helper is wired in
- Google Sheets append helper is wired in
- `server/config.py` now reads:
  - `GOOGLE_SHEETS_ID`
  - `GOOGLE_SHEETS_RANGE`
  - `GOOGLE_DRIVE_FOLDER_ID`
- current default sheet range in config is:
  - `log!A:U`

Current receipt route behavior:

- validates required fields
- parses amount safely
- sets `submission_date` on the server
- requires `purchase_date` from the user
- uploads normal receipts to Drive
- saves the DB row
- appends a row to Google Sheets
- updates `sheets_sync_status` / `sheets_sync_error`

## Sheet Column Direction

The log sheet was simplified to better mirror the model.

Important sheet decision:

- `Affidavit UID` should be removed

Reason:

- affidavits are no longer separate uploaded/file-backed records
- keeping `Affidavit UID` only duplicates the receipt record id

Current working direction for the sheet is a 21-column range:

- `log!A:U`

## Alembic Status

Important discovery:

- Alembic had been scaffolded in the repo
- but there were no revision files yet
- and neither local nor production had an `alembic_version` table

That means the existing database schema predates Alembic tracking.

This is now fixed locally.

Current local Alembic state:

- baseline revision created:
  - `3678e07c71d1` - `baseline existing schema`
- receipts migration created:
  - `52cf99c0f2b3` - `add receipts table`
- local DB current revision:
  - `52cf99c0f2b3 (head)`

Local commands that succeeded:

```bash
flask db revision -m "baseline existing schema"
flask db stamp head
flask db migrate -m "add receipts table"
flask db upgrade
```

Current local history:

```text
3678e07c71d1 -> 52cf99c0f2b3 (head), add receipts table
<base> -> 3678e07c71d1, baseline existing schema
```

## Production Migration Plan

Production is still in the old state:

- no `alembic_version` table
- no Alembic current revision recorded
- old schema only

Important rule for production:

- do not run `flask db stamp head`

Reason:

- once the receipts migration exists, stamping to `head` would mark the receipts migration as already applied without actually creating the `receipts` table

Correct production sequence after deploying the updated code and migration files:

1. back up the `portal` database
2. stamp production to the baseline revision only:
   - `flask db stamp 3678e07c71d1`
3. apply migrations:
   - `flask db upgrade`

Expected result after production upgrade:

- `alembic_version` should exist
- production current revision should become:
  - `52cf99c0f2b3 (head)`
- the `receipts` table should exist

Useful production verification commands:

```bash
flask db current
```

```sql
USE portal;
SHOW TABLES LIKE 'receipts';
SELECT * FROM alembic_version;
```

---

## Architecture Pivot

`2026-04-13`

## New Direction

The Google Drive + Google Sheets integration inside the Flask app is being abandoned.

Reason:

- local Google auth for Drive/Sheets proved brittle
- ADC + impersonation + Sheets scopes became a recurring blocker
- the receipt submission flow itself is already working well enough inside the app
- keeping the app as the source of truth is simpler

New plan:

- the app will own the full receipt submission workflow and database record
- the app will no longer upload files directly to Google Drive
- the app will no longer append directly to Google Sheets
- for normal receipts, the app will email the uploaded receipt file to:
  - `receipts@mattsappliancesla.net`
- a Google Apps Script on the Gmail/Drive side will:
  - read receipt emails
  - upload the attachment to the correct Drive folder
  - append a lookup row to a Google Sheet

## Important Consequence

The Google Sheet is no longer the primary ledger.

The app database is the source of truth.

The Google Sheet becomes a lightweight lookup/index for:

- receipt DB id
- receipt UUID
- selected receipt metadata
- Drive file URL / file id

## Planned Email Flow

For a normal receipt:

1. user submits the receipt in the app
2. app validates and saves the receipt row in MySQL
3. app emails the receipt attachment to `receipts@mattsappliancesla.net`
4. email subject/body include the DB row id and UUID
5. Apps Script uploads the attachment to Drive
6. Apps Script appends a lookup row to Google Sheets

For a missing receipt:

1. user submits the receipt in the app
2. app validates and saves the receipt row in MySQL
3. no file upload is attempted
4. optionally a metadata-only email can be added later if desired

## Sheet Lookup Direction

The Google Sheet should be simplified into a lookup table instead of mirroring the whole receipt model.

Suggested columns:

1. Receipt DB ID
2. Receipt UUID
3. Employee
4. Amount
5. Purchase Date
6. Vendor
7. Missing Receipt?
8. Drive File URL
9. Drive File ID
10. Processed At
11. Gmail Message ID

## Backend Rebuild Direction

Backend work should now move toward:

- removing Google Drive upload from the Flask request path
- removing Google Sheets append from the Flask request path
- replacing that work with outbound email handling for normal receipts
- keeping the `Receipt` table and app submission flow as the core system

## Notes For Resume

- frontend receipt form now exists in the React app
- current backend still reflects the older direct Google integration
- next backend pass should simplify the route around:
  - DB save
  - email send
  - optional email status tracking

---

## End Of Day Update

`2026-04-13`

## Current App State

The app-side receipt workflow is now in a much better place and is likely good enough to move forward.

### Backend

- the receipt model has been reshaped around the new email-based flow
- the receipts migration was rewritten and re-run locally to match the current model
- the receipt submission route now:
  - validates required fields
  - requires `purchase_date`
  - sets `submission_date` from the business timezone
  - saves missing-receipt submissions without requiring a file
  - saves normal receipt submissions before attempting email send
  - tracks `email_delivery_status`
  - tracks `email_delivery_error`
- current backend behavior was smoke tested locally against the real Flask app

Smoke test results:

- normal receipt submission passed
- missing receipt submission passed
- malformed amount returns `400`
- unsupported file type returns `400`
- missing receipt with no reason now returns `400`
- simulated email failure still saves the DB row and marks the receipt as failed email delivery

### Current Receipt Model Direction

Important model split going forward:

- `receipt_status` is for business workflow state
  - examples: `submitted`, `reviewed`, `matched`
- `email_delivery_status` is for transport/integration state
  - examples: `not_required`, `pending`, `sent`, `failed`

Current important receipt fields now include:

- `external_file_url`
- `external_file_id`
- `email_delivery_status`
- `email_delivery_error`

Those external file fields are intentionally blank for now until Google processing is added.

### Frontend

The React receipt submission page is now wired to the finalized backend response shape.

Frontend status:

- receipt form route exists and is reachable from the app
- form styling has been updated to match the rest of the portal
- the large gray header boxes were removed by avoiding global `header` styling collisions
- missing receipt UX was simplified so only the missing-reason statement appears when that box is checked
- client-side validation was tightened for required fields
- the form now handles backend warning responses
- inline success / warning status messaging was added after submit
- production build succeeded after the latest frontend changes

## Google Direction

The next major phase is no longer Flask-side Google API integration.

The next phase is a standalone Google Apps Script workflow that:

- checks the `receipts@mattsappliancesla.net` inbox on a time-driven trigger
- finds receipt submission emails
- saves attachments into the target Drive folder
- appends a lightweight lookup row into the Google Sheet

Reason for this direction:

- direct Google auth inside the Flask app became too brittle
- the app database is now the source of truth
- the Google side should act as a downstream automation layer

## Pickup Point For Next Thread

When resuming, start here:

1. Assume the app-side receipt flow is in a workable state.
2. Do **not** reopen direct Flask-to-Drive or Flask-to-Sheets integration unless a new reason appears.
3. Focus on designing and building the Google Apps Script side.

First tasks for the next thread:

1. define the Apps Script constants/config block:
   - Gmail labels
   - target Drive folder id
   - target Sheet id and tab name
2. write the Gmail polling function using an installable time-driven trigger
3. parse receipt DB id / UUID from the email subject or body
4. save the attachment to Drive
5. append the lookup row to Sheets
6. mark processed vs error emails with labels

Suggested lookup sheet columns for the Google side:

1. Receipt DB ID
2. Receipt UUID
3. Employee
4. Amount
5. Purchase Date
6. Vendor
7. Missing Receipt?
8. Drive File URL
9. Drive File ID
10. Processed At
11. Gmail Message ID

## Reminder For Resume

If this file is being read at the start of the next thread, the most useful next move is:

- review the current email subject/body format in `server/app/services/receipts_service.py`
- then begin drafting the standalone Google Apps Script that consumes those emails
