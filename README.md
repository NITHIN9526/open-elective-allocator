# Open Elective Management Portal

A Node.js, Express and EJS portal for managing student registration, profile collection, elective preferences, course allocation and administrator review.

> **Data status:** The repository no longer contains seeded student records, sample courses, or a default administrator password. A fresh local data file starts empty. PostgreSQL schema/migrations are included, but the current Express routes still use the legacy JSON store; PostgreSQL is not yet the live application database.

## Requirements
- Node.js 20 or newer
- npm
- Docker Desktop / Docker Engine with Docker Compose (optional)

## Fresh clone setup (PowerShell)

```powershell
git clone https://github.com/NITHIN9526/open-elective-allocator.git
cd open-elective-allocator
npm install
Copy-Item .env.example .env
```

Edit `.env` and set a unique `SESSION_SECRET`. To create the first administrator in a brand-new local data file, set:
- `INITIAL_ADMIN_USERNAME`
- `INITIAL_ADMIN_PASSWORD` (12–72 characters)
- `INITIAL_ADMIN_NAME` (optional)

Start the app:

```powershell
npm run dev
```

Open http://localhost:3000. Remove the initial administrator password from `.env` after the first data file has been created. The first-admin bootstrap only runs when the local data file is first created.

## Available commands

| Command | Purpose |
|---|---|
| `npm start` | Start the portal |
| `npm run dev` | Start with Node.js watch mode |
| `npm run db:migrate` | Apply PostgreSQL schema migrations |

## Initial data

A fresh application data file contains:
- The college's six department reference records
- No student records
- No course records
- No preferences or allotments
- No audit/demo activity
- No default administrator account

Import the institution's approved student roster through the administrator student import page after the first administrator has been provisioned. Add the official elective course list through the course management page. Do not use fabricated student names, PRNs, marks or course records.

## Features
### Student portal
- Student registration using an imported PRN
- Administrator approval before student access
- Student profile completion and correction requests
- Ranked elective preferences
- Allotment status and result view

### Administrator portal
- Student roster import/export and profile management
- Registration and profile update approvals
- Course and capacity management
- Preference window management
- Provisional and manual allocation
- Allotment review and audit log

## PostgreSQL status

The repository includes a PostgreSQL schema and migration command:

```powershell
npm run db:migrate
```

However, the current Express routes still read and write `data/db.json`. The application-wide PostgreSQL repository/service migration and persistent session integration remain to be completed and tested. Do not assume that running the migrations switches the live website to PostgreSQL.

## Data and backups

- The current live application data is stored in `data/db.json` (ignored by Git).
- Back up that file securely while the application is stopped.
- PostgreSQL migration tables are created by the migration command, but they are not yet the live source of application records.
- Never commit `.env`, passwords, student spreadsheets, database backups or private credentials.

## Security and deployment

Before entering real student records or exposing the portal beyond a controlled test network, complete the PostgreSQL application migration, persistent session storage, administrator provisioning review, HTTPS configuration, authorization and input-validation review, backup/restore testing, and end-to-end security testing.
