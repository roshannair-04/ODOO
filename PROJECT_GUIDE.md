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

Payroll and Analytics have nav entries and routes already scaffolded
(`src/app/(dashboard)/payroll`, `/analytics`) showing a "coming in the next
phase" placeholder. That's deliberate — the routes exist so nothing 404s,
and whoever builds each module has a file already waiting for them. See
section 7.

---

## 1b. What phase 2 adds

- **Attendance**: employees check in/out from their own Attendance page
  (`src/components/attendance/check-in-card.tsx`) — a shift under 4 worked
  hours is automatically logged as a half day on check-out, not just full
  present/absent. Admins get a date-picker grid across every active
  employee with a manual correction dialog (`admin-attendance-grid.tsx`)
  for backdating or fixing a punch.
- **Leave**: employees apply for leave against a live balance
  (`apply-leave-dialog.tsx`), see their own request history with a cancel
  action while still pending, and admins get an approval queue
  (`leave-approval-queue.tsx`). Approving, rejecting, cancelling and
  applying all go through Postgres functions in
  `supabase/migrations/0004_leave_functions.sql` — **not** plain table
  writes — because approval has to atomically move the balance from
  `pending` to `used` *and* write an `attendance` row (status `leave`) for
  every working day in range, in one transaction. That attendance row is
  what a future payroll phase reads to compute payable days — leave is
  never re-entered anywhere else.
- **Realtime**: the leave approval queue and both attendance views
  subscribe to Postgres changes (`components/site/realtime-refresher.tsx`)
  so an approval or a teammate's check-in shows up without a manual
  refresh.
- A grants migration (`0003_grants.sql`) fixing a gotcha from phase 1 — see
  the "Changing the schema" note below if you ever hit `permission denied
  for table X` despite correct-looking RLS.

---

## 1c. Design system

The app runs one locked dark theme — no light mode, no `dark:` toggle —
adapted from Linear's product design language: a near-black canvas, a
single lavender accent (`--primary`, `#5e6ad2`) used only for primary
actions/links/focus rings, hairline borders instead of drop shadows, and
Geist (via the `geist` npm package, self-hosted — same offline-resilience
reasoning as the rest of the stack) as the display and body typeface.

**Everything is a token.** `src/app/globals.css` defines the full palette
as CSS custom properties (`--background`, `--card`, `--primary`,
`--success`, `--warning`, `--destructive`, plus a `-soft` variant of each
semantic color for badge/icon backgrounds) mapped into Tailwind via
`@theme inline`. No component or page hand-rolls a color, a `gray-500`, or
a literal hex value — they all consume `bg-card`, `text-muted-foreground`,
`border-border`, `bg-primary-soft`, etc. **If you need a new color, add a
token in `globals.css` and reference it by name — never inline a hex value
in a component.** That discipline is what let this redesign land as a
CSS-token swap instead of a rewrite, and it's what keeps the next one cheap
too.

Radius scale: `rounded-sm` 6px, `rounded-md` 8px (buttons, inputs),
`rounded-lg` 12px (cards, dialogs), `rounded-xl` 16px, `rounded-full` for
badges/avatars — pick from this scale, don't invent a one-off radius.

Icons stay on `lucide-react` (already used everywhere from phase 1 — not
worth a library swap mid-hackathon). Don't hand-roll icon SVGs.

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
      attendance/          check-in/out (employee) + correction grid (admin)
      leave/               apply/cancel (employee) + approval queue (admin)
      payroll/             ← build here next (placeholder in place)
      analytics/           ← build here next, admin-only
    actions/            Server Actions (auth.ts, employees.ts, attendance.ts,
                        leave.ts) — this is where business logic and writes
                        belong, never in client components
    auth/callback/      handles the email-verification redirect
  components/
    ui/                 base primitives (button, input, table, dialog, …)
    site/               app chrome (header, sidebar, footer, nav config,
                        realtime-refresher.tsx)
    employees/          Employees-module-specific components
    attendance/          check-in-card.tsx, admin-attendance-grid.tsx
    leave/               apply-leave-dialog.tsx, my-leave-requests-table.tsx,
                        leave-approval-queue.tsx
  lib/
    supabase/           client.ts (browser), server.ts (Server Components/
                        Actions), admin.ts (service-role, server-only),
                        middleware.ts (session refresh + route protection)
    validations/        zod schemas, one file per feature
    auth.ts             getCurrentEmployee / requireEmployee / requireAdmin
    utils.ts            cn(), formatDate, formatMoney, todayISO, etc.
supabase/migrations/    the SQL that defines the whole schema — see below
                        before touching the database
scripts/seed.ts         demo data generator
```

### Adding a new module (payroll, analytics, …)

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

If a module needs a column or table, add a new
`supabase/migrations/0005_<name>.sql` (the next free number — `0001` is the
base schema, `0002` storage buckets, `0003` a grants fix, `0004` the leave
functions) rather than editing an already-applied file. Post in the team
chat when you add one so everyone re-runs it on their own Supabase project
(SQL Editor → paste → Run, same as section 4).

**Gotcha, already hit once:** if you apply a migration through an AI tool /
MCP connection instead of the Supabase dashboard's SQL Editor, Supabase's
automatic privilege grants for `anon`/`authenticated`/`service_role` can be
skipped, and you'll see `permission denied for table X` on an otherwise
correct, RLS-compliant query. `0003_grants.sql` fixes this once for the
existing tables and future ones (`alter default privileges`); if you add a
brand-new table the same way, re-run the pattern in that file for it.

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

Phase 1 (shipped): scaffold, schema, auth, employees module.
Phase 2 (shipped): attendance (check-in/out + admin grid), leave (apply +
approve, wired to write attendance on approval), realtime on both.
Next up: payroll (derived from attendance — no re-entering leave or hours,
with the day-by-day breakdown visible), then analytics and polish. Full
context on the "why" behind each of these and the differentiators worth
building lives in the team's war-room doc — ask in chat if you don't have
the link.
