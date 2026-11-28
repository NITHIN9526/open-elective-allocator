# Open Elective Management Portal

A Node.js/Express and EJS development portal for the college open-elective process. It supports student registration and approval, profile collection, ranked course preferences, provisional allocation, manual allocation, allotment review, and an admin audit log. Student profiles are synchronized to Google Sheets; other portal records remain in a local JSON database.

> **Development/demo application:** Use fictional data for testing. Do not use real student records or expose the portal to the public internet until the production-readiness items below have been completed and independently reviewed.

## Requirements

- Node.js 20 or newer
- npm
- Docker Desktop or Docker Engine with Docker Compose, if using the container setup
- A Google Cloud service account and Google Sheets API access, if profile synchronization is enabled

## Fresh clone setup

Clone the repository and install its dependencies:

```powershell
git clone https://github.com/NITHIN9526/open-elective-allocator.git
cd open-elective-allocator
npm ci
```

If you do not have a `package-lock.json` or are intentionally installing updated dependency versions, use `npm install` instead of `npm ci`.

Create your local environment file from the example:

```powershell
Copy-Item .env.example .env
```

Open `.env` and set a unique `SESSION_SECRET` and the database settings required by your environment. For Google Sheets profile synchronization, also add `GOOGLE_SHEETS_ID` and `GOOGLE_SERVICE_ACCOUNT_KEY` as described in [Google Sheets integration](#google-sheets-integration). Do not commit `.env` or the real service-account JSON key.

Start the development server:

```powershell
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). See [Run locally](#run-locally), [Environment configuration](#environment-configuration), and [Google Sheets integration](#google-sheets-integration) for the remaining configuration details.

## Available npm scripts

| Command | Purpose |
|---|---|
| `npm start` | Start the portal with Node.js |
| `npm run dev` | Start the portal with Node.js watch mode |
| `npm run reset-demo` | Reset local demo data; destructive to local registrations and results |
| `npm run db:migrate` | Run the database migration script |

There is currently no automated test-suite command in `package.json`. Use the manual verification steps in [First-time setup and testing](#first-time-setup-and-testing) after making changes.

## Run locally

From the project directory:

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Student registration, student login, and admin login are available at `/register`, `/student/login`, and `/admin/login`. Use `npm start` for a normal start without automatic restart. Stop the server with `Ctrl+C`.

### Demo administrator

- Username: `admin`
- Password: `Admin@12345`

This account is for development/testing only. Replace the seeded credentials before any shared test. Student accounts are registered using PRNs in the local roster; the student creates a password and an administrator must approve the account before login.

## Run with Docker

Docker Compose builds the application image, publishes the portal on port `3000`, persists the local JSON database in the `open_elective_data` named volume, and mounts the Google service-account key read-only.

1. Create a project-root `.env` file:

   ```dotenv
   GOOGLE_SHEETS_ID=YOUR_SPREADSHEET_ID
   GOOGLE_SERVICE_ACCOUNT_KEY=/app/credentials/google-service-account.json
   SESSION_SECRET=replace-with-a-long-random-secret
   ```

2. Put the service-account JSON key at `credentials/google-service-account.json`. The compose configuration mounts this directory read-only into the container. Keep `.env` and the key out of Git.
3. Share the spreadsheet with the service account and grant it Editor access. See [Google Sheets integration](#google-sheets-integration) for the required tab and headers.
4. Build and start the portal:

   ```powershell
   docker compose up --build -d
   ```

Open [http://localhost:3000](http://localhost:3000). View logs with `docker compose logs -f open-elective`; stop the service with `docker compose down`.

The local database volume survives container rebuilds and restarts. To permanently delete it and all local portal accounts, preferences, and allotments, run `docker compose down -v`. This does not reset or delete Google Sheets data; do not use `-v` unless you intend to erase the local portal database.

## Environment configuration

The server reads `PORT` and `SESSION_SECRET` from the process environment. The Google Sheets module loads the project-root `.env` file and reads `GOOGLE_SHEETS_ID` and `GOOGLE_SERVICE_ACCOUNT_KEY`.

Generate a strong session secret with:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Set a unique `SESSION_SECRET` for any shared test or deployment, and keep it and the Google service-account key out of version control. The development fallback session secret is for localhost testing only.

## Google Sheets integration

The portal synchronizes completed student profiles to the existing `Students` tab. It updates the row matching the student's PRN; it does not append a row or provide full two-way database synchronization. Accounts, preferences, courses, allotments, and audit records continue to use the local JSON database.

Configure a Google Cloud service account with the Google Sheets API enabled. Share the spreadsheet with the service account's email address and grant Editor access. Store its JSON key outside the repository, then set the spreadsheet ID and key path in `.env`, for example:

```dotenv
GOOGLE_SHEETS_ID=YOUR_SPREADSHEET_ID
GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/google-service-account.json
```

The `Students` tab must have these exact headers in its first row:

| Header | Purpose |
|---|---|
| `PRN` | Student PRN |
| `Mobile` | Student mobile number |
| `Email` | Student email |
| `CGPA` | Student CGPA |
| `Current_Semester` | Current semester |
| `Academic_Year` | Academic year |
| `Profile_Status` | Set to `COMPLETED` after successful submission |
| `Profile_Updated_At` | Update timestamp |

Each student must already have exactly one row with their PRN. If the PRN is missing or duplicated, synchronization stops without changing the sheet. Optional `Name` and `Department` columns are updated when present and supplied. The local profile record is updated only after the Sheets update succeeds. If synchronization fails, the student can retry; check the spreadsheet ID, key path, sharing permission, headers, and unique PRN row.

Never upload the service-account key to GitHub or share its contents in issues or chat. For Docker, use the key path inside the container shown above and store the key in the mounted `credentials` directory.

## First-time setup and testing

Use fictional/test records until deployment has been security-reviewed.

1. Start the portal and sign in as the demo administrator.
2. Inspect the dashboard, roster, departments, and courses.
3. Register a PRN present in the local roster using a strong test password.
4. Approve the pending account in the admin portal.
5. Sign in as the student and complete the profile. If Google Sheets is configured, verify that the matching row was updated.
6. Submit ranked course preferences while preference submission is open.
7. As admin, close preference submission, inspect preferences, run provisional allocation, review results and ties, then approve or reject allotments.
8. Test manual allocation and the student result page, and inspect the audit log.

## Features

### Student portal

- Register with a roster PRN; accounts remain pending until approved by an administrator.
- Complete a profile after approval, with profile updates synchronized to the matching Google Sheets row when configured.
- Request a profile correction for administrator review.
- Submit ranked elective preferences (up to six, subject to the configured limit).
- View preferences and allotment status/results.

### Admin portal

- Approve student registrations and manage student profiles and correction requests.
- Create, edit, and manage course capacities; delete courses only when no records depend on them.
- Open or close preference submission and review submitted preferences.
- Run provisional allocation, review and approve/reject proposed allotments, and make manual allocations.
- Inspect the audit log.

## Data storage, reset, and backups

- Runtime application data is stored in `data/db.json`. It is local to the server and is not synchronized to Google Sheets.
- A fresh clone creates or seeds its own local data file when the application starts. The repository ignores `data/*.json`.
- Back up `data/db.json` to a protected location outside the project directory. Stop the application before manually copying or restoring it, and periodically test a restore.
- Back up the Google Sheet separately using the college's approved process.
- Never run `npm run reset-demo` on a server containing records you need. It replaces local demo data and can erase registrations and results; it does not reset Google Sheets.

To reset a disposable local demo, stop the server and run:

```sh
npm run reset-demo
```

The local seed includes fictional example PRNs such as `DEMO-CE-001`, `DEMO-ME-001`, and `DEMO-EE-001`. Use a PRN present in the local roster and, for profile synchronization, exactly once in the `Students` tab.

## Allocation rules and limitations

- The demo permits students to select any listed course, including one offered by their own department. Confirm the college's eligibility policy before use.
- Students with CGPA above 8.00 are processed before students with CGPA 8.00 or below. Within each group, higher CGPA is processed first; equal CGPA is ordered by PRN ascending for repeatability.
- For each student, the allocator checks preferences in rank order and assigns the first course with remaining capacity.
- Equal CGPA cases are flagged for administrator review. The deterministic processing order is not an official tie-break rule; resolve flagged cases before approving results.
- Allocation results are provisional until reviewed by an administrator. Running automatic allocation replaces the existing allotment list, including any manual allocations.
- Manual allocation is recorded as approved and is subject to course capacity validation.
- The JSON store is intended for a local single-instance demo, not concurrent high-volume use. Express's in-memory session store does not persist sessions across server restarts.

## Hosting on a college network

For a controlled test, use a dedicated, always-on computer or server connected to the college LAN. Ask the network administrator to reserve a fixed address and restrict the firewall to the college subnet. Do not use an everyday staff laptop as a permanent server, and do not expose the Node port directly to the public internet.

On Windows, install Node.js 20+ and Git, clone the repository, run `npm install`, configure the environment and Google key, and start with `npm start`. For continuous service, use Task Scheduler or a reputable service wrapper under a dedicated least-privilege account. Restrict access to the project data and credential files.

On Linux, use the institution's approved Node.js source, a dedicated non-root service account, and a protected application directory. Install with `npm ci` when a lockfile is present, store the Google key outside the repository with restrictive permissions, and configure a systemd service with the correct working directory, startup, and restart behavior. Restrict the firewall to the college subnet and configure log rotation, monitoring, and backups.

For any production deployment, use an HTTPS reverse proxy and complete the production-readiness work below before public exposure.

## Troubleshooting

| Problem | Checks |
|---|---|
| `node` or `npm` is not recognized | Install Node.js 20 or newer, reopen the terminal, and check `node --version` and `npm --version`. |
| Port 3000 is already in use | Stop the other process or set a different `PORT`, then restart the app. |
| Other devices cannot open the site | Confirm both devices are on the permitted LAN, use the server's IP address, and ask the network administrator to check firewall/VLAN rules. |
| Student profile cannot synchronize | Check the Sheets API, spreadsheet ID, key path and permissions, sharing, exact `Students` tab name, required headers, and exactly one matching PRN row. |
| Student cannot log in after registration | An administrator must approve the account first. |
| Changes disappear after restart | Check the project directory and write permissions for `data/db.json`; for Docker, confirm the named volume is mounted. |
| Session signs out after restart | The current Express in-memory session store does not persist sessions across restarts. |

## Production-readiness checklist

Before using real student data or making the portal available beyond a controlled test network, the college's IT/security team should:

- [ ] Replace the JSON file database with a transactional database and concurrency-safe writes.
- [ ] Replace the in-memory session store with a persistent, production-supported session store.
- [ ] Remove demo administrator credentials and provision named administrator accounts securely.
- [ ] Configure HTTPS, secure cookies, reverse-proxy settings, and trusted-proxy configuration.
- [ ] Review security headers, CSRF protection, input validation, authorization, rate limits, dependencies, and error handling.
- [ ] Restrict server and credential-file permissions, rotate secrets, and define a service-account key rotation process.
- [ ] Define and test encrypted backups, retention, disaster recovery, and restore procedures.
- [ ] Conduct privacy, security, load, concurrency, and recovery testing.
- [ ] Obtain formal approval for allocation policy, eligibility rules, tie-break procedure, and result publication.
- [ ] Document administrator responsibilities, student support, incident response, and data-retention/deletion policies.

Until these items are complete, keep the portal on a restricted test network and use fictional/test data only.

## Project structure

```text
open-elective-allocator/
├── data/                 # Runtime JSON database (ignored by Git)
├── public/               # CSS, icons, and static assets
├── scripts/              # Demo reset utility
├── src/                  # Configuration, middleware, storage, Sheets integration
├── views/                # EJS pages and partials
├── server.js             # Express application and routes
├── package.json
└── README.md
```
