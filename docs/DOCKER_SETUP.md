# Docker development setup

## Requirements
- Docker Desktop for Windows, with the Linux container engine running.
- Git.

## First run (PowerShell)
1. Copy `.env.example` to `.env`.
2. Set a strong, private `POSTGRES_PASSWORD` and a random `SESSION_SECRET`. For a fresh local JSON data file, optionally set `INITIAL_ADMIN_USERNAME` and a unique `INITIAL_ADMIN_PASSWORD` (12–72 characters).
3. Run:

```powershell
docker compose up --build
```

The Compose stack provisions PostgreSQL and applies the schema before starting the website. Open http://localhost:3000.

## Useful commands

```powershell
docker compose ps
docker compose logs -f open-elective
docker compose down
docker compose up -d
```

Use `docker compose down -v` only when you intentionally want to permanently delete the PostgreSQL volume and its contents.

## Current application storage limitation
PostgreSQL schema and migrations are present, but the Express application still uses the legacy local JSON store for its live routes and data. The PostgreSQL application adapter and persistent session integration are not complete. Do not enter real student records or use this deployment for production until that migration and its end-to-end tests are completed.
