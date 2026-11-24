# Open Elective Local Demo Portal

A local-only prototype of the Government Polytechnic College, Palakkad open-elective portal. It uses fictional data and a JSON file database so it can be run without Google Apps Script, Firebase, or a database server.

## Requirements
- Node.js 20 or newer
- npm

## Run on Windows (PowerShell)
1. Extract this ZIP.
2. Open PowerShell in the extracted `open-elective-local-portal` folder.
3. Install dependencies:
   ```powershell
   npm install
   ```
4. Start the portal:
   ```powershell
   npm start
   ```
5. Open `http://localhost:3000`.

## Demo administrator
- Username: `admin`
- Password: `Admin@12345`

## Demo student PRNs
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

Students create their own password at `/register`. Admin approval is required before student login.

## Included functionality
### Student
- PRN + password registration/login
- Registration status pending until approved by admin
- View roster profile and CGPA
- Select and save ranked elective preferences (up to six)
- View provisional/final allotment status

### Admin
- Dashboard and pending student approvals
- Approve/reject student accounts
- View all demo students and account status
- View courses and edit seat capacity
- Open/close preference submission
- View submitted preferences
- Run provisional CGPA-descending allocation
- Review and approve/reject proposed allotments
- Audit log

## Suggested end-to-end test
1. Sign in as admin and inspect the dashboard.
2. Sign out, open Student registration.
3. Register `DEMO-CE-001` with a password of at least 10 characters.
4. Sign in as admin and approve the pending account.
5. Sign out and sign in as `DEMO-CE-001` using the password you created.
6. Select course preferences and save.
7. Repeat registration/approval/preferences for several demo PRNs.
8. As admin, close preference submission.
9. Run merit allocation and review the provisional allotments.
10. Approve/reject allotments individually.
11. Sign in as a student and inspect My result.

## Reset all demo data
Stop the server, then run:
```powershell
npm run reset-demo
```
This restores the original fictional students, course capacities, admin account and empty preferences/allotments. It deletes all locally-created demo registrations and test results.

## Important demo rules and limitations
- All student names, PRNs, emails and CGPAs are fictional.
- The current demo permits students to select any listed course, including one offered by their own department. Change this if the college's eligibility rule differs.
- Equal CGPA cases are flagged for admin review. The current deterministic processing order uses PRN only to make the prototype repeatable; it is **not** an official tie-break rule. Admins must resolve flagged cases before approving results.
- The local JSON store is intended for a single-user local test, not concurrent public use.
- Session storage uses Express's in-memory store; sessions reset when the server restarts.
- The fallback session secret is for localhost testing only. Set a strong `SESSION_SECRET` before any shared test.
- This is a development prototype, not production-ready. Before public deployment, use a transactional database, persistent session store, stronger operational controls, backups, security review, and an officially approved allocation/tie-break policy.
- The server listens locally. Do not expose it to the public internet as-is.

## Data file
Runtime data is stored in `data/db.json`. Do not put real student personal data in this demo.
