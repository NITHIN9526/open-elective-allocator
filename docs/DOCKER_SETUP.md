# Docker setup

This guide runs the current Open Elective Portal in one Docker container. The live application currently stores data in `/app/data/db.json`, persisted in a named Docker volume. PostgreSQL migrations are a separate foundation and are not used by the live application.

## Requirements

- Windows 10/11, macOS or Linux
- Docker Desktop (Windows/macOS) or Docker Engine
- Docker Compose v2 (the `docker compose` command)
- Git

On Windows, start Docker Desktop and wait until its engine is running. Use Linux containers.

## 1. Get the project

```powershell
git clone https://github.com/NITHIN9526/open-elective-allocator.git
cd open-elective-allocator
Copy-Item .env.example .env
```

## 2. Configure environment

Open `.env` and set:

- `SESSION_SECRET`: a random secret of at least 32 characters.
- `APP_PORT`: host port (default `3000`).
- `INITIAL_ADMIN_USERNAME`: first administrator username.
- `INITIAL_ADMIN_PASSWORD`: unique password, 12–72 characters.
- `INITIAL_ADMIN_NAME`: administrator display name.

Generate a session secret in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the generated value into `SESSION_SECRET`. Do not use the example placeholder or commit your real `.env` file.

## 3. Build and start

```powershell
docker compose up --build -d
```

Check container status:

```powershell
docker compose ps
docker compose logs -f app
```

Wait until the app reports healthy, then open:

- Portal: http://localhost:3000 (or the port configured in `APP_PORT`)
- Administrator login: http://localhost:3000/admin/login

The first administrator is created when the persistent JSON data file is initialized. Sign in and confirm that the account works. Then remove `INITIAL_ADMIN_PASSWORD` from `.env` and recreate the app container:

```powershell
docker compose up -d
```

The administrator account remains in the persistent data volume; removing the environment variable does not delete it.

## 4. Common Docker commands

```powershell
# Start in background
docker compose up -d

# Rebuild after code or dependency changes
docker compose up --build -d

# Follow application logs
docker compose logs -f app

# Show status and health
docker compose ps

# Stop and remove the container (keeps saved data)
docker compose down

# Restart the application
docker compose restart app
```

## 5. Data persistence and backup

Student and portal records are stored in the Docker named volume `open_elective_data`. They remain available after `docker compose down` and container rebuilds.

To back up the data, stop the application and export the volume:

```powershell
docker compose down
docker run --rm -v open_elective_data:/data -v "${PWD}:/backup" alpine tar -czf /backup/open-elective-data-backup.tar.gz -C /data .
```

Keep the backup in a secure location because it contains student information and password hashes. Protect it with appropriate access controls.

**Warning:** `docker compose down -v` permanently deletes the named data volume and all portal records. Do not run it unless you intentionally want to erase the application data.

## 6. Change the host port

Set `APP_PORT` in `.env`, for example:

```dotenv
APP_PORT=8080
```

Then run:

```powershell
docker compose up -d
```

Open http://localhost:8080.

## 7. Troubleshooting

- **Docker daemon is not running:** start Docker Desktop and wait for the engine to become ready.
- **Port is already in use:** change `APP_PORT` in `.env`, then run `docker compose up -d`.
- **Container exits immediately:** inspect `docker compose logs app`. In production mode, `SESSION_SECRET` must contain at least 32 characters.
- **Cannot log in as the first administrator:** check the initial administrator variables in `.env`. The data volume may already contain an initialized database. Do not delete the volume if it contains records; recover access through a controlled administrator recovery procedure.
- **Application reports unhealthy:** inspect `docker compose logs app` and verify that the container can start and that its data volume is writable.

## Important application/database status

The current Express routes use the JSON file store. The Docker deployment therefore runs only the application container and persists `/app/data` in a named volume. It does not need a PostgreSQL container.

PostgreSQL schema files and `npm run db:migrate` exist as a separate development foundation, but the application routes and session storage have not been migrated to PostgreSQL. Running the migration command does not switch the live website to PostgreSQL.

The current JSON store and Express in-memory session store are intended for local development or a controlled single-instance demonstration. Before using real student records in a public or multi-user production deployment, complete and test a transactional database adapter, persistent session storage, HTTPS/reverse-proxy configuration, backup restoration, and security testing.
