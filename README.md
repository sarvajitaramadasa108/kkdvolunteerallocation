# HKVT Volunteer Allocation

Standalone Google Sheets-backed live registration and allocation interface.

## Setup

1. Deploy `apps-script/Code.gs` as a Google Apps Script web app and run `setup` once.
2. Add the service names in the `Service Master` sheet, with `Service Name` in column B.
3. Set the Apps Script `/exec` URL as `NEW_ALLOCATIONS_APPS_SCRIPT_URL` in the separate Vercel project.
4. Deploy this repository to Vercel.

Volunteer data is read from the `Volunteer Master` sheet. Assignments are written to `Assignment Map`; source rows remain in `Volunteer Master`.
