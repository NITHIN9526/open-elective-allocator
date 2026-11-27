# Open Elective Management Portal

A Node.js/Express and EJS web application for managing the college open-elective process. It includes student registration and approval, student profile collection, ranked course preferences, merit-based provisional allocation, manual allocation, allotment review, and an admin audit log.

> **Deployment warning:** This repository is still a development/demo application. Do not use it with real student records or expose it to the public internet until the production-readiness items in this README have been completed and independently reviewed.

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Get the project](#get-the-project)
- [Install and run locally](#install-and-run-locally)
- [Environment configuration](#environment-configuration)
- [Connect Google Sheets](#connect-google-sheets)
- [First-time setup and testing](#first-time-setup-and-testing)
- [Host on a college network](#host-on-a-college-network)
  - [Windows server](#windows-server)
  - [Linux server](#linux-server)
- [Data storage and backups](#data-storage-and-backups)
- [Allocation rules and important workflow notes](#allocation-rules-and-important-workflow-notes)
- [Troubleshooting](#troubleshooting)
- [Production-readiness checklist](#production-readiness-checklist)

## Features

### Student portal
- Student registration using a roster PRN; new accounts remain pending until an administrator approves them.
- Student login and profile completion.
- Profile fields: mobile number, email, CGPA, current semester, and academic year.
- First submitted profile is locked. Students can submit a correction request for administrator review.
- Ranked elective preference submission (up to six preferences, subject to the configured limit).
- View preference and allotment status/results.

### Admin portal
- Dashboard and student registration approvals.
- Student roster and profile management, including profile correction requests.
- Course creation, editing, capacity management, and deletion where no records depend on the course.
- Open or close the preference submission window.
- View submitted preferences.
- Run provisional CGPA-priority allocation and approve/reject proposed allotments.
- Manual course allocation and unassignment.
- Audit log.

## Requirements

- Node.js 20 or newer (Node 20 LTS or a currently supported LTS release is recommended).
- npm (included with Node.js).
- Git, if cloning the repository.
- A Google Cloud service account and Google Sheets API access if student profile synchronization is enabled.

Check the installed versions:

```powershell
node --version
npm --version
git --version
```

## Get the project

Clone the UI refresh branch used for the current deployment/testing version:

```powershell
cd C:\
mkdir CollegeApps
cd C:\CollegeApps
git clone -b design/svg-icon-human-centered-refresh https://github.com/NITHIN9526/open-elective-allocator.git
cd C:\CollegeApps\open-elective-allocator
```

If the project has subsequently been merged into the default branch, use the default-branch clone command instead:

```powershell
git clone https://github.com/NITHIN9526/open-elective-allocator.git
```

Install dependencies:

```powershell
npm install
```

Do not commit `.env`, Google service-account JSON files, student data, or other credentials to Git.

## Install and run locally

From the project root:

```powershell
npm install
npm run dev
```

Open:

- Portal: http://localhost:3000
- Student registration: http://localhost:3000/register
- Student login: http://localhost:3000/student/login
- Admin login: http://localhost:3000/admin/login

For a normal start (without Node's watch mode):

```powershell
npm start
```

Stop the server with `Ctrl+C`.

### Demo administrator account

The current demo seed contains:

- Username: `admin`
- Password: `Admin@12345`

This account is for development/testing only. Change or replace the seeded administrator credentials before any shared or real deployment. Do not publish or reuse demo credentials as an operational college administrator account.

Student accounts are registered using PRNs already present in the roster. The student creates their own password during registration; an administrator must approve the account before the student can log in.

## Environment configuration

The application reads `PORT` and `SESSION_SECRET` from the process environment when the server starts. Set these as machine/service environment variables on the host.

### Windows PowerShell

Generate a strong session secret:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Set the port and replace the placeholder with the generated value:

```powershell
[Environment]::SetEnvironmentVariable("PORT", "3000", "User")
[Environment]::SetEnvironmentVariable("SESSION_SECRET", "PASTE_YOUR_GENERATED_SECRET_HERE", "User")
```

Close and reopen PowerShell (or restart the service) after changing environment variables. Never commit the session secret.

The application currently has a development fallback session secret. A strong, unique `SESSION_SECRET` is mandatory for any shared deployment.

## Connect Google Sheets

Google Sheets is used by the current implementation to synchronize a student's completed profile into the spreadsheet's `Students` tab. **It is not a full two-way database sync:** preferences, allotments, course records, registration approvals, and audit logs remain in the application's JSON database.

### 1. Create or select a Google Cloud project

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create the project used for this portal.
3. Enable the **Google Sheets API** for that project.
4. Create a service account and generate a JSON key.
5. Download the JSON key securely.

Treat the JSON key as a password. Do not upload it to GitHub, share it in chat, or place it in the public web folder.

### 2. Share the spreadsheet with the service account

Share the target spreadsheet with the service account's `client_email` address and grant it **Editor** access. The service account used for this project is:

`open-elective-sync@open-elective-integration.iam.gserviceaccount.com`

If you create a different service account, share the sheet with that account instead.

### 3. Prepare the Students worksheet

Create a worksheet/tab named exactly:

`Students`

The first row must contain these exact column headers:

| Required header | Purpose |
|---|---|
| `PRN` | Student PRN; must match the portal roster exactly |
| `Mobile` | Student mobile number |
| `Email` | Student email |
| `CGPA` | Student CGPA |
| `Current_Semester` | Current semester |
| `Academic_Year` | Academic year, for example 2026-27 |
| `Profile_Status` | Set to COMPLETED after successful submission |
| `Profile_Updated_At` | Timestamp written by the application |

The `PRN` column must contain exactly one matching row for each student who completes a profile. Duplicate or missing PRNs cause synchronization to fail. Optional `Name` and `Department` columns are updated only if they exist and are supplied by the application.

### 4. Configure the project

Keep the service-account JSON outside the repository. Example Windows location:

`C:\CollegeApps\open-elective-credentials\google-service-account.json`

Create the folder and copy the downloaded JSON key into it. Then create a file named `.env` in the project root:

```dotenv
GOOGLE_SHEETS_ID=YOUR_SPREADSHEET_ID
GOOGLE_SERVICE_ACCOUNT_KEY=C:/CollegeApps/open-elective-credentials/google-service-account.json
```

The spreadsheet ID is the long value between `/d/` and `/edit` in the spreadsheet URL. Do not put the full URL in `GOOGLE_SHEETS_ID`.

The current Google Sheets module reads this `.env` file itself. Keep the file in the project root and do not commit it. The `.gitignore` already excludes `.env` and the `secrets/` folder.

Restart the application after changing the Google configuration. Test with a designated test student and verify that only the matching row is updated.

## First-time setup and testing

Use fictional/test records until the deployment has been security-reviewed.

1. Start the portal and open the admin login page.
2. Sign in with the development administrator account shown above.
3. Inspect the dashboard, roster, departments, and courses.
4. Open student registration and register a PRN already present in the roster. Use a strong test password (10–72 characters).
5. Return to the admin portal and approve the pending student account.
6. Sign out and log in as that student.
7. Complete the student profile. If Google Sheets is configured, verify the corresponding row in the `Students` tab.
8. Submit ranked course preferences while the preference window is open.
9. As admin, close the preference window and inspect submitted preferences.
10. Run provisional allocation, review the results, and approve or reject proposed allotments.
11. Test manual allocation and confirm that the student result page displays the expected result.
12. Inspect the audit log and test the portal on both desktop and a phone connected to the same network.

## Host on a college network

A college-hosted portal should run on a dedicated, always-on computer or server connected to the college LAN. Ask the college network administrator to reserve a fixed DHCP address for the server. Students should access the portal using the server's LAN IP address, for example `http://192.168.20.5:3000`.

Do not use a staff member's everyday laptop as the permanent server. Keep the machine powered on, prevent sleep while hosting, restrict administrative access, and arrange backups.

### Windows server

#### 1. Install and prepare

Install Node.js 20+ and Git on the college server. Open PowerShell:

```powershell
cd C:\CollegeApps
git clone -b design/svg-icon-human-centered-refresh https://github.com/NITHIN9526/open-elective-allocator.git
cd C:\CollegeApps\open-elective-allocator
npm install
```

If the repository has moved to the default branch, omit `-b design/svg-icon-human-centered-refresh`.

#### 2. Configure secrets and Google Sheets

- Set `PORT` and `SESSION_SECRET` using the [environment configuration](#environment-configuration) instructions.
- Place the service-account JSON outside the repository, for example in `C:\CollegeApps\open-elective-credentials\`.
- Create the project-root `.env` file as described in [Connect Google Sheets](#connect-google-sheets).
- Restrict access to the credentials folder to the Windows account running the application and authorized administrators.

#### 3. Allow college-LAN access

The current server code listens on the default local interface. For access from other devices on the LAN, change the final server listener in `server.js` from:

```js
app.listen(PORT, () => {
```

to:

```js
app.listen(PORT, "0.0.0.0", () => {
```

This makes the app listen on network interfaces; it does not itself secure the application. Do not make this change on an internet-facing server without completing the production security work.

Find the server's IPv4 address:

```powershell
ipconfig
```

Ask the network administrator to reserve that address. For a controlled college LAN, an administrator can add a Windows Firewall rule. The following example allows the port on Domain and Private profiles; restrict the remote address to the college subnet where possible:

```powershell
New-NetFirewallRule -DisplayName "Open Elective Portal" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Domain,Private
```

Run firewall administration commands in an elevated PowerShell window. Students on the same permitted network can then open:

`http://SERVER-IP:3000`

For example: `http://192.168.20.5:3000`.

#### 4. Start and keep it running

Test interactively first:

```powershell
cd C:\CollegeApps\open-elective-allocator
npm start
```

For continuous service, configure Windows Task Scheduler or a reputable Windows service wrapper to:
- Run under a dedicated, least-privilege Windows account.
- Start at system boot and restart after failure.
- Use `C:\CollegeApps\open-elective-allocator` as the working directory.
- Have access to `data\db.json`, the environment variables, and the protected Google key.
- Write application output and error logs to a protected location.

Do not run the service as an administrator unless strictly required.

### Linux server

The following is a general Ubuntu/Debian outline. Have the college system administrator adapt it to the institution's server policy and firewall.

1. Install a supported Node.js LTS release and Git using the institution's approved package source.
2. Create a dedicated non-root service account and an application directory such as `/opt/open-elective`.
3. Clone the repository into that directory, install dependencies with `npm ci` when a lockfile is present (otherwise `npm install`), and set ownership so only the service account can write application data.
4. Store the Google service-account JSON outside the repository with restrictive permissions (for example, readable only by the service account). Create the project-root `.env` with the spreadsheet ID and key path.
5. Set `PORT` and a unique `SESSION_SECRET` in the service manager's protected environment configuration.
6. Change the server listener to `app.listen(PORT, "0.0.0.0", ...)` for LAN access.
7. Create a systemd service with the dedicated account, the correct `WorkingDirectory`, startup at boot, and automatic restart on failure.
8. Configure the firewall to allow the application port only from the college subnet. Reserve a fixed LAN IP and test from another device.
9. Configure log rotation, monitoring, and automated backups.

Do not expose the Node port directly to the public internet. For a production deployment, place the app behind a properly configured HTTPS reverse proxy and complete the production-readiness checklist below.

## Data storage and backups

- Runtime application data is stored in `data/db.json`.
- The JSON database is local to the server and is not synchronized to Google Sheets.
- The repository ignores `data/*.json`; a fresh clone may create or seed its own local data file when the application starts.
- Back up `data/db.json` regularly to a protected location outside the project directory. Keep multiple dated copies and periodically test restoring one.
- Back up the Google Sheet separately using the college's approved process.
- Stop the application before manually copying or restoring `db.json` to avoid copying a file while it is being written.
- Never use `npm run reset-demo` on a server containing records you need. That command resets demo data and can erase local registrations and results.

To reset a disposable local demo only, stop the server and run:

```powershell
npm run reset-demo
```

## Allocation rules and important workflow notes

- Students can currently select any listed course, including a course offered by their own department. Confirm the college's eligibility policy before use.
- Students with CGPA **above 8.00** are processed before students with CGPA 8.00 or below. Within each group, higher CGPA is processed first; equal CGPA is ordered by PRN ascending.
- For each student, the allocator checks preferences in rank order and assigns the first course with remaining capacity.
- Allocation results are provisional until reviewed by an administrator.
- **Running automatic allocation replaces the existing allotment list.** The current route clears `db.allotments` before generating new provisional results. Do not run automatic allocation after making manual allocations unless you intend to replace those allocations.
- Manual allocation is recorded as an approved allocation and is subject to course capacity validation.
- The application currently uses a JSON file store. It is not designed for multiple application instances or concurrent high-volume writes.

## Troubleshooting

| Problem | Checks |
|---|---|
| `node` or `npm` is not recognized | Install Node.js, reopen the terminal, and check `node --version` and `npm --version`. |
| Port 3000 is already in use | Stop the other process or set a different `PORT`, then restart the app. |
| Other devices cannot open the site | Confirm the app listens on `0.0.0.0`, check the server IP with `ipconfig`, confirm both devices are on the permitted LAN, and ask the network administrator to check firewall/VLAN rules. |
| Student profile cannot synchronize | Check the Google Sheets API, spreadsheet ID, service-account JSON path and permissions, sheet sharing, exact `Students` tab name, required headers, and exactly one matching PRN row. |
| Student cannot log in after registration | The account must first be approved by an administrator. |
| Changes disappear after restart | Check that the service account can write to the project `data` folder and that the correct project directory is being used. |
| Session signs out after server restart | The current Express in-memory session store does not persist sessions across restarts. |

## Production-readiness checklist

Before using real student data or making the portal available beyond a controlled test network, the college's IT/security team must address at least the following:

- [ ] Replace the JSON file database with a supported transactional database (for example PostgreSQL), including migrations and concurrency-safe writes.
- [ ] Replace Express's default in-memory session store with a persistent, production-supported session store.
- [ ] Remove the demo administrator account and create named administrator accounts through a secure provisioning process; enforce strong passwords and appropriate access controls.
- [ ] Configure HTTPS with valid certificates, secure cookies, reverse-proxy settings, and appropriate trusted-proxy configuration.
- [ ] Review the app's security headers, content security policy, CSRF protection, input validation, authorization, rate limits, dependency vulnerabilities, and error handling.
- [ ] Restrict server and credential-file permissions; rotate secrets and define a service-account key rotation process.
- [ ] Define and test encrypted backups, retention, disaster recovery, and restore procedures.
- [ ] Conduct privacy, security, load, concurrency, and recovery testing with the college IT team.
- [ ] Obtain formal approval for the allocation policy, eligibility rules, tie-break procedure, and result publication process.
- [ ] Document administrator responsibilities, student support, incident response, and data-retention/deletion policies.

**Until these items are complete, keep the portal on a restricted test network and use fictional/test data only.**

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

## Repository

[GitHub: NITHIN9526/open-elective-allocator](https://github.com/NITHIN9526/open-elective-allocator)
