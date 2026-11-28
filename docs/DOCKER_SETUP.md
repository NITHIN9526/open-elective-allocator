# Docker development setup

## Requirements
- Docker Desktop for Windows, with the Linux container engine running.
- Git (to clone the repository).

## First run (PowerShell)
1. Copy `.env.example` to `.env`.
2. Edit `.env` and set a strong, private `POSTGRES_PASSWORD` and a random `SESSION_SECRET`. Keep the password in the `.env` file; do not paste it into chat or commit it.
3. Run:

```powershell
docker compose up --build
```

The Compose stack starts PostgreSQL, waits for its health check, runs the SQL migrations, then starts the Express website. Open http://localhost:3000.

## Useful commands

```powershell
# View service status
docker compose ps

# Follow app logs
docker compose logs -f open-elective

# Stop containers (database data remains in its named volume)
docker compose down

# Start again
docker compose up -d

# Stop and DELETE the database volume (destructive: removes database data)
docker compose down -v
```

Change the host website port with `APP_PORT` in `.env`.

## Important current project limitation
This Docker setup provisions PostgreSQL and applies the schema, but the current Express routes still read and write the legacy JSON store. The PostgreSQL adapter has not yet replaced that store, and Express sessions are not yet configured to use the PostgreSQL `session` table. Do not treat PostgreSQL as the live application data store until the separate application migration and tests are complete.

The current student profile route also still calls the legacy Google Sheets integration. The app can start without the service-account file, but that profile-sync action will not work until the Sheets code is removed or credentials are configured. This is not a fully Sheets-free application yet.

Do not import real student records or use this stack for production data until those integration, authentication/session, backup, and end-to-end test milestones are complete.
