# Open Elective Management Portal

A Node.js, Express and EJS web application for managing student registration, profile collection, elective preferences, course allocation and administrator review at Government Polytechnic College, Palakkad.

## Features

### Student portal
- Student registration against an administrator-imported PRN roster
- Administrator approval before student account access
- Student profile completion and correction requests
- Ranked elective course preferences
- Allotment status and result view

### Administrator portal
- Student roster import/export (Excel and CSV)
- Student registration and profile update approvals
- Student profile and roster management
- Elective course and capacity management
- Preference submission window control
- Provisional and manual course allocation
- Allotment review and audit log

## Requirements

- Docker Desktop / Docker Engine
- Docker Compose v2
- Git

Docker is the recommended way to run the project consistently. A local Node.js setup is also available below.

## Quick start with Docker (recommended)

### 1. Clone the repository

```powershell
git clone https://github.com/NITHIN9526/open-elective-allocator.git
cd open-elective-allocator
```

### 2. Create the environment file

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure the required values:

- `SESSION_SECRET`: replace the example with a random secret of at least 32 characters.
- `APP_PORT`: host port for the website (default: `3000`).
- `INITIAL_ADMIN_USERNAME`: username for the first administrator.
- `INITIAL_ADMIN_PASSWORD`: unique password between 12 and 72 characters.
- `INITIAL_ADMIN_NAME`: administrator display name.

Generate a secure session secret in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the generated value into `SESSION_SECRET`. Keep `.env` private; it is excluded from Git and the Docker build context.

### 3. Build and start the portal

Make sure Docker Desktop is running, then execute:

```powershell
docker compose up --build -d
```

Check the container and its health:

```powershell
docker compose ps
docker compose logs -f app
```

Open the portal:

- Website: http://localhost:3000
- Administrator login: http://localhost:3000/admin/login

If you changed `APP_PORT`, use that port instead of `3000`.

### 4. First administrator setup

The first administrator is provisioned from the `INITIAL_ADMIN_*` variables when the persistent application data file is initialized. Sign in and verify the administrator account.

After confirming that login works, remove `INITIAL_ADMIN_PASSWORD` from `.env` and apply the updated environment:

```powershell
docker compose up -d
```

The administrator account remains saved in the data volume. Removing the bootstrap password from `.env` does not remove the account.

## Docker operations

Run these commands from the project directory:

| Task | Command |
|---|---|
| Start | `docker compose up -d` |
| Build and start | `docker compose up --build -d` |
| View status | `docker compose ps` |
| Follow logs | `docker compose logs -f app` |
| Restart | `docker compose restart app` |
| Stop containers | `docker compose down` |

### Data persistence

The application data is stored in the named Docker volume `open_elective_data`. It survives container restarts, rebuilds and `docker compose down`.

To create a backup on Windows PowerShell, stop the app and export the volume:

```powershell
docker compose down
docker run --rm -v open_elective_data:/data -v "${PWD}:/backup" alpine tar -czf /backup/open-elective-data-backup.tar.gz -C /data .
```

The backup contains student information and password hashes. Store it securely and restrict access.

**Do not run `docker compose down -v` unless you intentionally want to permanently delete the saved application data.**

### Change the website port

Edit `.env`:

```dotenv
APP_PORT=8080
```

Apply the change:

```powershell
docker compose up -d
```

Open http://localhost:8080.

### Troubleshooting

- **Docker is unavailable:** start Docker Desktop and wait for the engine to become ready.
- **Port already in use:** choose another `APP_PORT` in `.env`.
- **Container exits on startup:** run `docker compose logs app`. In production mode, `SESSION_SECRET` must be at least 32 characters.
- **Container is unhealthy:** inspect the application logs and check that the data volume is writable.
- **First administrator cannot log in:** verify the initial admin variables. If the volume was initialized earlier without an administrator, set the bootstrap variables and restart the container; do not delete a volume containing real records.

## Run locally without Docker

Requirements: Node.js 20 or newer and npm.

```powershell
npm ci
Copy-Item .env.example .env
```

Set `SESSION_SECRET` and the first administrator variables in `.env`, then run:

```powershell
npm run dev
```

Open http://localhost:3000.

The local JSON data file is created under `data/db.json`. This file is ignored by Git and should be backed up securely.

## Data and database status

A new application data file contains the six college department reference records, but no student records, elective courses, preferences, allotments, or default administrator account. Import the institution-approved student roster and create the official elective course list through the administrator portal.

**Current live storage:** Express routes read and write `data/db.json`. The Docker setup persists this directory in the `open_elective_data` volume.

**PostgreSQL status:** PostgreSQL schema files and the `npm run db:migrate` command are included as a database foundation. The live application routes and session storage have not yet been migrated to PostgreSQL. The Docker Compose setup intentionally does not start PostgreSQL because the current application does not use it. Running migrations alone does not change the live data store.

## Important deployment limitation

The current JSON file store and Express in-memory session store are intended for local development or a controlled, single-instance demonstration. Do not treat this build as production-ready for public access or concurrent institutional use with real student records.

Before production deployment, complete and test:
- A transactional PostgreSQL data layer for all application routes
- Persistent session storage
- HTTPS and reverse-proxy configuration
- Role/authorization and input-validation review
- Backup and restore procedures
- Automated unit, integration and end-to-end tests

Never commit `.env`, passwords, student spreadsheets, database backups or private credentials.
