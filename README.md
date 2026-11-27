# Open Elective Portal

A local development prototype of the Government Polytechnic College, Palakkad Open Elective Portal. The application uses Node.js, Express, EJS and a local JSON data store. Student profile submissions are synchronized to the college Google Spreadsheet.

## Requirements

- Node.js 20 or newer (the Google Sheets integration uses the built-in `fetch` API)
- npm

## Run on Windows (PowerShell)

1. Open PowerShell in the project folder.
2. Install dependencies:

   ```powershell
   npm install
   ```

3. Configure the Google Sheets connection as described below.
4. Start the portal:

   ```powershell
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000).

For development with automatic restart:

```powershell
npm run dev
```

## Run with Docker

Docker is the recommended way to run the portal in a container. Docker Compose builds the image, publishes the web app on port `3000`, persists the local JSON database in a named volume, and mounts the Google service-account key as read-only.

### Prerequisites

- Docker Desktop (Windows/macOS) or Docker Engine with the Compose plugin (Linux)
- The Google service-account JSON key, if you want Google Sheets profile synchronization

### Prepare environment and credentials

1. Create a `.env` file in the project root (next to `docker-compose.yml`):

   ```env
   GOOGLE_SHEETS_ID=1f0NeuxSPcS9IqZb0Cczn2cp8y4rv2UGOPPjAK_FDiZo
   GOOGLE_SERVICE_ACCOUNT_KEY=/app/credentials/google-service-account.json
   SESSION_SECRET=replace-with-a-long-random-secret
   ```

2. Put your service-account JSON key at:

   ```text
   credentials/google-service-account.json
   ```

   The `credentials` folder is mounted read-only into the container. The key is not copied into the Docker image. Keep `.env` and the JSON key out of Git.

3. Share the Google spreadsheet with the service-account email and grant **Editor** access. Confirm the `Students` tab has the required column headings listed in the Google Sheets section above.

### Build and start

Run these commands from the project root:

```powershell
docker compose up --build -d
```

Open [http://localhost:3000](http://localhost:3000).

View application logs:

```powershell
docker compose logs -f open-elective
```

Stop the container:

```powershell
docker compose down
```

### Persistent data and reset

The app's local JSON database is stored in the Docker named volume `open_elective_data`, so it survives container rebuilds and restarts. The Google Sheet is not copied into this volume; profile synchronization continues to use the mounted service-account key and spreadsheet ID.

To stop the app but keep data:

```powershell
docker compose down
```

To permanently delete the local database volume and all local portal accounts/preferences/allotments:

```powershell
docker compose down -v
```

The command above does **not** delete or reset Google Sheets data. Do not use `-v` unless you intend to erase the local portal database.

To rebuild after code changes:

```powershell
docker compose up --build -d
```

## Google Sheets integration

The portal synchronizes a student's completed profile to the existing college spreadsheet. It updates the matching student row in the `Students` tab using the student's PRN. It does not append a new row, and it stops without changing the sheet if the PRN is missing or appears more than once.

### Spreadsheet

- Spreadsheet: [Master Open Elective Allocation](https://docs.google.com/spreadsheets/d/1f0NeuxSPcS9IqZb0Cczn2cp8y4rv2UGOPPjAK_FDiZo/edit)
- Spreadsheet ID: `1f0NeuxSPcS9IqZb0Cczn2cp8y4rv2UGOPPjAK_FDiZo`
- Student data tab: `Students`
- Service account: `open-elective-sheets@open-elective-portal.iam.gserviceaccount.com`

Share the spreadsheet with the service-account email above and grant it **Editor** access. The JSON key configured below must belong to that same service account. Do not share the key file or commit it to GitHub.

### Configure credentials

Create a `.env` file in the project root:

```env
GOOGLE_SHEETS_ID=1f0NeuxSPcS9IqZb0Cczn2cp8y4rv2UGOPPjAK_FDiZo
GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/google-service-account.json
SESSION_SECRET=replace-with-a-long-random-secret
```

Place the downloaded service-account JSON key at `credentials/google-service-account.json`. If you store it elsewhere, update `GOOGLE_SERVICE_ACCOUNT_KEY` to that path. Keep both `.env` and the service-account JSON key out of version control. Never paste private keys or credential file contents into issues, chat, or source files.

### Required columns in the Students tab

The first row of the `Students` tab must contain these exact column headings (other columns can remain in place):

- `PRN`
- `Mobile`
- `Email`
- `CGPA`
- `Current_Semester`
- `Academic_Year`
- `Profile_Status`
- `Profile_Updated_At`

Each student must already have exactly one row with their PRN. The integration updates the profile fields above in that row and sets `Profile_Status` to `COMPLETED`.

### Student profile workflow

1. A student registers using their PRN and creates a password.
2. An administrator approves the account.
3. On first approved login, the student completes their profile: mobile number, email, CGPA, current semester and academic year.
4. The server validates the submitted values and finds the existing row by PRN in the `Students` tab.
5. The profile fields are written to Google Sheets. The local JSON record is updated only after the Sheets update succeeds.
6. Students must complete the profile before accessing the student dashboard, preferences or result pages.

If synchronization fails, the student sees an error and can retry. Check the service-account sharing permission, key path, spreadsheet ID, required headings and unique PRN row. The application logs a concise synchronization error in the server terminal.

**Scope note:** Google Sheets synchronization currently covers student profile updates. The portal's other application data (such as accounts, preferences, courses and allotments) continues to use the local JSON store; this README does not imply full two-way synchronization or automatic import of the entire spreadsheet.

## Demo administrator

- Username: `admin`
- Password: `Admin@12345`

Change demo credentials and configure a strong `SESSION_SECRET` before any shared test. Student passwords are created during registration.

## Demo student PRNs

The local demo seed data includes these example PRNs:

- `DEMO-CE-001`
- `DEMO-CE-002`
- `DEMO-ME-001`
- `DEMO-ME-002`
- `DEMO-EL-001`
- `DEMO-EL-002`
- `DEMO-CM-001`
- `DEMO-CM-002`
- `DEMO-IE-001`
- `DEMO-IE-002`
- `DEMO-EE-001`
- `DEMO-EE-002`

Use PRNs that exist in the local roster and in the Google Sheet when testing profile synchronization.

## Included functionality

### Student

- PRN + password registration/login
- Registration remains pending until approved by an administrator
- Complete profile after account approval
- Synchronize profile fields to the matching Google Sheets student row
- View roster profile and CGPA
- Select and save ranked elective preferences (up to six)
- View provisional/final allotment status

### Admin

- Dashboard and pending student approvals
- Approve/reject student accounts
- View students and account status
- View courses and edit seat capacity
- Open/close preference submission
- View submitted preferences
- Run provisional CGPA-descending allocation
- Review and approve/reject proposed allotments
- Audit log

## Suggested end-to-end test

1. Confirm the service account can access the spreadsheet and the required headings exist in `Students`.
2. Start the portal and sign in as admin.
3. Register a PRN that exists exactly once in both the local roster and the spreadsheet.
4. Approve the pending student account.
5. Sign in as that student and complete the profile.
6. Confirm that the matching Google Sheets row was updated and no extra row was created.
7. Confirm the student can access the dashboard and submit course preferences.
8. As admin, close preference submission, run allocation and review the provisional allotments.
9. Approve/reject allotments and inspect the student result page.

## Reset local demo data

Stop the server, then run:

```powershell
npm run reset-demo
```

This restores the original fictional local students, course capacities, admin account and empty preferences/allotments. It does not reset or delete Google Sheets data.

## Important rules and limitations

- The seeded local demo roster contains fictional data. Do not treat it as the college's official student master list.
- A PRN must match exactly one row in the Google Sheets `Students` tab for profile synchronization to succeed.
- The current demo permits students to select any listed course, including one offered by their own department. Change this if the college's eligibility rule differs.
- Equal CGPA cases are flagged for admin review. The current deterministic processing order uses PRN only to make the prototype repeatable; it is **not** an official tie-break rule. Admins must resolve flagged cases before approving results.
- The local JSON store is intended for a single-user local test, not concurrent public use.
- Session storage uses Express's in-memory store; sessions reset when the server restarts.
- The fallback session secret is for localhost testing only. Set a strong `SESSION_SECRET` before any shared test.
- This is a development prototype, not production-ready. Before public deployment, use a transactional database, persistent session store, stronger operational controls, backups, security review, and an officially approved allocation/tie-break policy.
- Do not expose the development server to the public internet as-is.

## Local data file

Runtime application data is stored in `data/db.json`. Google Sheets is used for the student profile synchronization described above; the JSON file remains the local application data store.
