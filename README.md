# Dayflow

**Every workday, perfectly aligned.**

An HR management system built for the Odoo HackX brief — attendance, leave,
and payroll as one connected record instead of three spreadsheets.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage) ·
Tailwind CSS v4 · TypeScript

---

## What's included

| Area | Highlights |
|------|------------|
| **Auth** | Sign up / sign in / email verify. First account becomes **admin**; later sign-ups are employees (no role picker). |
| **Employees** | Admin directory (search, filter, paginate), profiles, photo upload, salary structure editing. |
| **Attendance** | Employee check-in / check-out (shifts under 4h → half day). Admin month **calendar**, company grid, manual corrections, **Mark all present**, anomaly flags (30-day window). |
| **Leave** | Apply / cancel, balances, admin approval queue. Approvals write `leave` attendance rows in one DB transaction. Natural-language quick apply (e.g. “sick leave next Monday”). |
| **Payroll** | Payslips derived from attendance + salary structures (generate / finalize). Breakdown dialog + PDF download. |
| **Analytics** | Admin charts for attendance, leave, and payroll trends. |
| **Realtime** | Attendance and leave views refresh live on Postgres changes. |

---

## Quick start

### Windows (recommended)

1. Complete **one-time setup** below (Supabase + `.env.local` + migrations).
2. Double-click **`start-dayflow.bat`** (or run it from a terminal).

The script installs dependencies if needed, warns when `.env.local` is
missing, opens [http://localhost:3000](http://localhost:3000), and starts
the Next.js dev server.

```bat
start-dayflow.bat
```

### Any platform (npm)

```bash
git clone https://github.com/roshannair-04/ODOO.git dayflow
cd dayflow
npm install
cp .env.example .env.local   # fill in your Supabase project keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## One-time setup

You need a free [Supabase](https://supabase.com) project. Full walkthrough:
**[PROJECT_GUIDE.md](./PROJECT_GUIDE.md)**. Short checklist:
**[RUN_GUIDE.md](./RUN_GUIDE.md)**.

1. **Migrations** — in Supabase **SQL Editor**, run in order:
   `0001_init.sql` → `0002_storage.sql` → `0003_grants.sql` →
   `0004_leave_functions.sql` → `0005_payroll_functions.sql` →
   `0006_payroll_join_date_fix.sql` → `0007_payroll_current_month_fix.sql`
   (all under `supabase/migrations/`).
2. **Env** — copy `.env.example` → `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
3. **Auth URLs** — Site URL `http://localhost:3000`, redirect
   `http://localhost:3000/auth/callback`.
4. **Sign up** — first user is admin. Then optionally:

   ```bash
   npm run seed
   ```

   Demo employees use password `Dayflow123!`.

`npm install && npm run dev` alone is not enough until migrations and
`.env.local` are in place.

---

## Scripts

| Command | Purpose |
|---------|---------|
| `start-dayflow.bat` | Windows: install if needed + `npm run dev` + open browser |
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run seed` | Seed demo departments / employees |

---

## Docs

| Doc | Use when |
|-----|----------|
| [RUN_GUIDE.md](./RUN_GUIDE.md) | Fast path: run locally, smoke-test Attendance |
| [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) | Architecture, schema, design tokens, deeper setup |

---

## Project layout (high level)

```
src/app/(auth)/          sign-in, sign-up, verify-email
src/app/(dashboard)/     dashboard, employees, attendance, leave,
                         payroll, analytics, profile
src/app/actions/         server actions (auth, employees, attendance, …)
src/components/          UI + feature modules
supabase/migrations/     Postgres schema, RLS, leave & payroll functions
scripts/seed.ts          demo company data
start-dayflow.bat        Windows launcher
```

---

## License / brief

Built for the Odoo HackX brief. Keep `.env.local` and service-role keys out
of git — they are gitignored.
