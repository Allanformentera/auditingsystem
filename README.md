# Campus Ledger

Student organization collection and audit system for CCS.

## Source notes

- The attached feature document specifies the implementation stack and workflows: Next.js + TypeScript, Express, MySQL + Prisma, Excel import, separate treasurer/auditor roles, payment tracking, receipt evidence, reconciliation, and balanced credits/debits.
- Your direct instructions specify five courses: BSIT, EDUC, BSOA, CRIM, and CAS. BSIT is the only course with a supplied roster; the other four are shown as awaiting import. CAS has two majors: BA COMM and POLSCI. EDUC has two majors: BSED and BEED.
- The supplied `CCS YEAR 4 MASTERLIST.xlsx` has nine tabs (Block 1–Block 9) and 364 student records. The names are prepared in `server/prisma/bsit-year4-students.json` for database seeding. It is not copied into the public web directory.

## Features

- Separate treasurer and auditor dashboard layouts, with role-gated API routes.
- Course and block roster import from Excel. Duplicate records are skipped.
- Assessments create a payment row for each matching active student.
- Marking a payment paid updates its status and creates a credit in the ledger in one database transaction.
- Expenses require a receipt file and create a debit in the ledger.
- Auditor cash counts and representative payment-list uploads, with unmatched names, duplicate matches, amount differences, and payment-status gaps flagged for review.
- Seeded BSIT fourth-year roster; other courses can be populated later through the import endpoint.

## Run locally

Requirements: Node.js, npm, and MySQL.

1. **Create the database.** In MySQL Workbench, open a query tab and run:

   ```sql
   CREATE DATABASE campus_ledger
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;
   ```

   You can also run this from the MySQL command line after signing in: `mysql -u root -p -e "CREATE DATABASE campus_ledger CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`.

2. **Create the API environment file.** From the project root in PowerShell, copy the template:

   ```powershell
   Copy-Item server/.env.example server/.env
   ```

   Open `server/.env` and set the values. For example:

   ```env
   DATABASE_URL="mysql://root:YOUR_MYSQL_PASSWORD@localhost:3306/campus_ledger"
   JWT_SECRET="replace-with-a-long-random-secret"
   WEB_ORIGIN="http://localhost:3000"
   PORT=4000
   BOOTSTRAP_ADMIN_EMAIL="admin@your-school.edu"
   BOOTSTRAP_ADMIN_PASSWORD="choose-a-unique-password-at-least-12-characters"
   BOOTSTRAP_ADMIN_NAME="Campus Ledger Admin"
   BOOTSTRAP_TREASURER_EMAIL="treasurer@your-school.edu"
   BOOTSTRAP_TREASURER_PASSWORD="choose-a-different-password-at-least-12-characters"
   BOOTSTRAP_TREASURER_NAME="Campus Treasurer"
   BOOTSTRAP_AUDITOR_EMAIL="auditor@your-school.edu"
   BOOTSTRAP_AUDITOR_PASSWORD="choose-another-password-at-least-12-characters"
   BOOTSTRAP_AUDITOR_NAME="Campus Auditor"
   ```

   Generate a random JWT secret in PowerShell with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`, then paste the result into `JWT_SECRET`. Replace all example emails and passwords with your own values. Use a different email and unique password for each role; all passwords must be at least 12 characters. If the MySQL password contains URL-reserved characters such as `@`, `:`, `/`, or `#`, URL-encode those characters in `DATABASE_URL`. Keep `server/.env` private; it is excluded from Git.

3. **Install dependencies** from the project root:

   ```powershell
   npm install
   npm --prefix server install
   ```

4. **Create the tables and seed the initial data.** Run these from the project root, in order:

   ```sh
   npm --prefix server run db:generate
   npm --prefix server run db:migrate
   npm --prefix server run db:seed
   ```

   `db:generate` generates the Prisma client. `db:migrate` creates the MySQL tables from `server/prisma/schema.prisma`. `db:seed` creates or updates one account for each role (Admin, Treasurer, Auditor) from the `BOOTSTRAP_*` settings and inserts the 364 BSIT Year 4 roster records. Sign in with the email and password configured for the role you need. Re-running the seed updates those accounts to match the current environment settings; roster duplicates are skipped.

5. **Start the app** from the project root:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:3000`. The root page redirects to `/login`. Sign in with the email and password configured in `server/.env`; Treasurer and Auditor accounts open their matching dashboards. Admin accounts open the Treasurer dashboard with administrator access. Direct dashboard routes are `/treasurer` and `/auditor`, and each checks the signed-in role.

The bootstrap admin can also create additional treasurer and auditor accounts with `POST /api/users` using a bearer token. API routes are under `/api`; health check is `GET /api/health`.

## Preview status

The app opens on a dedicated sign-in page. A valid session is required for either dashboard; expired sessions return to sign-in, and a user who opens the other role dashboard is redirected to the route allowed by their account. Authenticated actions write to MySQL: payment status, assessments, receipt-backed expenses, cash counts, and imported rosters/payment lists.

Receipt files are stored in `server/uploads` for local development and served only through an authenticated API route.

## API roles

- `TREASURER`: roster and payment management, assessment creation, expense recording.
- `AUDITOR`: ledger review, physical cash counts, and representative payment-list reconciliation.
- `ADMIN`: account provisioning and system setup.
