# PostgreSQL database foundation

This branch adds the first PostgreSQL schema and migration foundation. The running Express application still uses the existing JSON adapter; switching it requires a separate service refactor and integration tests.

## Requirements
- PostgreSQL 14 or newer
- Node.js 20 or newer

## Local setup (PowerShell)
1. Create a local PostgreSQL database and user.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Run `npm install`.
4. Run `npm run db:migrate`.

The migrations create tables for academic terms, departments, students, enrollments, student accounts, admins, courses, preferences, allocations, audit logs, import batches/errors, and persistent Express sessions.

## Semester 6
The reference migration creates the confirmed active term Semester 6, academic year 2026-27, and the six department reference records. It deliberately does not seed courses because the uploaded workbook's course sheet is labelled Semester 5 and is not confirmed for Semester 6.

## Important
- Do not commit real student spreadsheets, credentials, passwords, or database backups.
- The app continues using JSON until the PostgreSQL integration milestone is completed and tested.
- Do not expose PostgreSQL to the public internet; keep it on a private network.
