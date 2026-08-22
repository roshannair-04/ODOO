# Dayflow — Project Guide

Dayflow is our HRMS build for the Odoo HackX brief. This doc is everything a
teammate needs to go from `git clone` to a running app on their own laptop.
Read it top to bottom once, then keep it open as reference.

Stack: **Next.js 16 (App Router) + Supabase (Postgres, Auth, Storage) +
Tailwind v4 + shadcn-style components**, one repo, no separate backend.

---

## 1. What phase 1 ships

- Full database schema and Row Level Security policies (`supabase/migrations/`)
- Sign up (with email verification), sign in, sign out
- **First person to sign up becomes admin.** Everyone after that signs up as
  a regular employee — there is no role picker on the sign-up form on
  purpose (see "Why no role dropdown" below).
- Role-gated app shell: sidebar + mobile menu, header, footer, 404 page,
  favicon, page metadata
- Employees module: searchable/filterable/paginated directory (admin),
  profile view + edit (self-service fields for employees, full edit for
  admins), profile photo upload
- A seed script that fills the app with a believable 25-person demo company

Attendance, Leave, Payroll and Analytics have nav entries and routes already
scaffolded (`src/app/(dashboard)/attendance`, `/leave`, `/payroll`,
`/analytics`) showing a "coming in the next phase" placeholder. That's
deliberate — the routes exist so nothing 404s, and whoever builds each
module has a file already waiting for them. See section 7.

---

## 2. Prerequisites

- Node.js 20+ and npm (check with `node -v`)
- A free [Supabase](https://supabase.com) account — takes two minutes, no
  credit card
- Git

---

## 3. Clone and install

```bash
git clone https://github.com/roshannair-04/ODOO.git dayflow
cd dayflow
npm install
```

---

## 4. Create your Supabase project

Each of us runs against our **own** Supabase project during development —
don't share one project's keys around. We'll switch everyone to a single
shared project right before the demo (whoever owns that project posts the
keys in the team chat).

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New
   project**. Pick any name (e.g. `dayflow-dev`), a strong database password
   (save it somewhere), and the region closest to you. Free tier is fine.
2. Wait ~2 minutes for it to provision.

### Run the schema

3. In the Supabase dashboard, open **SQL Editor** → **New query**.
4. Open `supabase/migrations/0001_init.sql` in this repo, copy the whole
   file, paste it into the SQL editor, and click **Run**.
5. Repeat for `supabase/migrations/0002_storage.sql` (run `0001` first —
   `0002` depends on it).

If either one errors partway through, the most common cause is running it
twice on a project that already has these tables — that's expected and
safe to ignore for enums/tables; if you need a clean slate, create a new
Supabase project instead of trying to un-wind a partial run.

### Get your API keys

6. Go to **Project Settings → API**.
7. Copy the **Project URL**, the **`anon` `public`** key, and the
   **`service_role`** key (click "reveal" — keep this one secret, it
   bypasses all security rules).

### Set up email + redirect URLs

8. Go to **Authentication → URL Configuration**.
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: add `http://localhost:3000/auth/callback`

   (Skipping this is the #1 reason "click the verification link" doesn't
   work — Supabase refuses to redirect anywhere not on this list.)
9. Supabase sends verification emails automatically on the free tier —
   nothing else to configure. If your emails aren't arriving, check
   **Authentication → Logs** for the actual send status, and check spam.

### Configure this repo

10. Copy the env template and fill it in:

    ```bash
    cp .env.example .env.local
    ```

    ```env
    NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
    NEXT_PUBLIC_SITE_URL=http://localhost:3000
    ```

    `.env.local` is gitignored — never commit real keys.

---

## 5. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). It redirects to
**Sign up** since there's no account yet.

Create your account — **you become the admin**, since you're the first
person to sign up on this project. Check your email for the verification
link (see step 8/9 above if it doesn't arrive), click it, then sign in.

### Load demo data

Real HRMS screens look broken with 2 employees and no history. Once your
admin account exists, seed a believable company:

```bash
npm run seed
```

This creates 4 departments and ~25 employees (all `role: employee`, so
your own account stays the only admin), each with their own login —
password `Dayflow123!` for all of them, emails like
`aarav.sharma1@dayflow.demo`. Safe to run more than once; it skips people
who already exist. Use these accounts to test the employee-side views
without signing out of your own.

---

## 6. Why no role dropdown at sign-up

The original brief lets anyone self-register and pick **Role: Employee /
HR** — which means anyone could hand themselves admin access, including
payroll. We fixed it: the sign-up form only collects name, employee ID,
email and password. The first account on a project becomes admin
automatically; everyone else joins as an employee, and only an admin can
promote someone afterwards (via **Employees → [person] → Role**, once
that's built out). Worth mentioning explicitly in the demo — it's exactly
the kind of thing judges are told to look for.

---

## 7. Where things live

```
src/
  app/
    (auth)/            sign-in, sign-up, verify-email — public routes
    (dashboard)/        everything behind the sidebar (requires auth)
      dashboard/         role-aware home (admin sees stats, employee sees quick links)
      employees/          admin-only directory + /[id] profile
      profile/            your own profile (works for both roles)
      attendance/          ← build here next (placeholder in place)
      leave/               ← build here next (placeholder in place)
      payroll/             ← build here next (placeholder in place)
      analytics/           ← build here next, admin-only
    actions/            Server Actions (auth.ts, employees.ts) — this is
                        where business logic and writes belong, never in
                        client components
    auth/callback/      handles the email-verification redirect
  components/
    ui/                 base primitives (button, input, table, dialog, …)
    site/               app chrome (header, sidebar, footer, nav config)
    employees/          Employees-module-specific components
  lib/
    supabase/           client.ts (browser), server.ts (Server Components/
                        Actions), admin.ts (service-role, server-only),
                        middleware.ts (session refresh + route protection)
    validations/        zod schemas, one file per feature
    auth.ts             getCurrentEmployee / requireEmployee / requireAdmin
    utils.ts            cn(), formatDate, formatMoney, etc.
supabase/migrations/    the SQL that defines the whole schema — see below
                        before touching the database
scripts/seed.ts         demo data generator
```

### Adding a new module (attendance, leave, payroll, …)

1. The route folder and a `ComingSoon` placeholder already exist under
   `src/app/(dashboard)/<module>/page.tsx` — replace the placeholder, don't
   create a new route.
2. Put reads directly in the Server Component (`await createClient()` from
   `@/lib/supabase/server`, then `.from(...)`). Put writes in a Server
   Action under `src/app/actions/<module>.ts`, validated with a zod schema
   in `src/lib/validations/<module>.ts` — follow the pattern in
   `actions/employees.ts`.
3. Every table already has RLS policies in `0001_init.sql` (employees see
   their own rows, admins see everything) — you shouldn't need to touch
   RLS to build a normal feature. If a query returns nothing unexpectedly,
   check whether an RLS policy is blocking it before assuming it's a bug in
   your code.
4. Reuse `src/components/ui/*` for anything table/form/dialog shaped —
   don't hand-roll a new button or input style.

### Changing the schema

If a module needs a column or table that isn't in `0001_init.sql`, add a
new file `supabase/migrations/0003_<name>.sql` rather than editing
`0001`/`0002` — those have already been run on people's projects. Post in
the team chat when you add one so everyone re-runs it on their own Supabase
project (SQL Editor → paste → Run, same as section 4).

---

## 8. Git workflow

- **Branch per feature**: `git checkout -b feat/attendance`, don't commit
  straight to `main`.
- **Commit often**, small commits — a commit graph with one giant commit
  from one person at hour 23 is a visible red flag to judges (git
  collaboration is an explicit judging criterion).
- Push and open a PR; anyone can review and merge if it builds. Speed over
  ceremony — we don't have time for a slow review process.
- Before pushing, run:
  ```bash
  npm run lint
  npm run typecheck
  npm run build
  ```
  All three must pass. `npm run build` in particular catches things `dev`
  mode silently tolerates.

---

## 9. Troubleshooting

**"Verify your email" link doesn't redirect anywhere / errors out.**
Check Supabase → Authentication → URL Configuration has
`http://localhost:3000/auth/callback` in Redirect URLs (section 4, step 8).

**Signed in but every page redirects back to `/sign-in`.**
Your `employees` row probably wasn't created — check the Supabase table
editor. This should never happen (a database trigger creates it
automatically on sign-up); if it does, check **Database → Logs** for a
trigger error and shout in the team chat.

**"row-level security policy" error on a query.**
You're querying as a role that isn't allowed to see or write that row.
Check `supabase/migrations/0001_init.sql` for the policy on that table —
most tables allow "own row, or admin sees all."

**Seed script fails with "Missing NEXT_PUBLIC_SUPABASE_URL…".**
You skipped step 10 in section 4 — `.env.local` doesn't exist or is
incomplete.

**Port 3000 already in use.**
`npm run dev -- -p 3001` and open that port instead.

---

## 10. Roadmap

Phase 1 (this push): scaffold, schema, auth, employees module.
Next up, roughly in this order: attendance (check-in/out + admin grid),
leave (apply + approve, wired to write attendance on approval), payroll
(derived from attendance, with the day-by-day breakdown visible), then
analytics and polish. Full context on the "why" behind each of these and
the differentiators worth building lives in the team's war-room doc —
ask in chat if you don't have the link.
