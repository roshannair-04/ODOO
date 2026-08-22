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
  for backdating or fixing a punch, plus a "Mark all present" dropdown
  (`markAllPresentAction` / `markAllPresentForMonthAction` in
  `actions/attendance.ts`) with two options: the selected day, or every
  working day so far in that month. Both only fill in employees with **no**
  existing row for the day — check-ins, prior manual corrections, and leave
  (written by the leave-approval function) are never overwritten, so it's
  safe to run repeatedly. The monthly option reuses the same
  later-of-month-start-or-join-date → earlier-of-month-end-or-today window
  as payroll's day-walk, so it never marks a day that hasn't happened yet.
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
built from `linear.app`'s DESIGN.md (design-md-library skill), read in
full and installed as tokens rather than eyeballed from screenshots: a
near-black canvas with a faint blue tint (`--canvas`, `#010102`), a
four-step surface ladder for hierarchy instead of drop shadows
(`--surface-1` through `--surface-4`), a three-step hairline ladder for
borders, a single lavender accent (`--primary`, `#5e6ad2` — plus
`--primary-hover`/`--primary-focus`) used only for primary
actions/links/focus rings, and Geist (via the `geist` npm package,
self-hosted — same offline-resilience reasoning as the rest of the stack)
as the Linear Display/Text substitute.

**Everything is a token, including type.** `src/app/globals.css` defines
the full palette as CSS custom properties (surface/hairline/ink ladders,
`--primary`, `--success`, `--warning`, `--destructive`, plus a `-soft`
variant of each semantic color for badge/icon backgrounds) mapped into
Tailwind via `@theme inline`, plus a `--text-*` type scale
(`display-md`/`headline`/`card-title`/`subhead`/`body-lg`/`body`/`body-sm`/
`caption`/`eyebrow`) that bundles font-size with Linear's documented
line-height, letter-spacing and weight per size — so `text-headline
font-semibold` on a page `<h1>` carries the right -0.6px tracking
automatically, no separate `tracking-tight` utility needed. No component
or page hand-rolls a color, a `gray-500`, a literal hex value, or an
ad-hoc `text-xl`. **If you need a new color or text size, add a token in
`globals.css` and reference it by name.** Page titles use `text-headline`,
card section headers use `text-body-lg` (compact cards, not marketing
feature-card scale), stat tile numbers use `text-headline`.

Semantic colors (success/warning/destructive) extend the reference file on
purpose — `linear.app.md` documents Linear's *marketing* site, and its own
"Known Gaps" section notes the real product UI uses a richer status-tag
palette that isn't in scope there. Extending semantic colors for
attendance/leave status badges is filling that gap, not drifting from the
source.

Radius scale (matches the DESIGN.md exactly): `rounded-xs` 4px,
`rounded-sm` 6px, `rounded-md` 8px (buttons, inputs), `rounded-lg` 12px
(cards, dialogs), `rounded-xl` 16px, `rounded-2xl` 24px, `rounded-full`
for badges/avatars — pick from this scale, don't invent a one-off radius.

Cards carry a `.edge-highlight` utility (`box-shadow: inset 0 1px 0 0
rgb(255 255 255 / 4%)`) — the subtle top-edge highlight the DESIGN.md
calls out as giving lifted dark surfaces a "pixel-rendered" feel. Hover
lift on interactive rows/cards goes through `--muted`, which is aliased to
`--surface-2` — so `hover:bg-muted` is already a correct surface-ladder
lift, not a generic gray.

Icons stay on `lucide-react` (already used everywhere from phase 1 — not
worth a library swap mid-hackathon). Don't hand-roll icon SVGs.

When verifying design changes in this sandbox: `middleware.ts` calls
Supabase on every matched request, and this environment's network egress
doesn't reach Supabase, so no route — not even a static one — renders
end-to-end through a live dev server here. Verify visually by temporarily
moving `middleware.ts` aside and pointing `.env.local` at fake values,
screenshotting a throwaway unrouted preview page, then restoring
`middleware.ts` and deleting the scratch files before committing — never
leave that swap in place.

---

## 1d. Payroll

- **The thesis**: payroll is *derived*, not entered. Every number on a
  payslip — payable days, gross, deductions, net — is computed from the
  `attendance` table and the employee's `salary_structure`, the same way
  leave already writes attendance rows in phase 2. Nobody types in "worked
  22 days" — the system already knows, because check-ins and approved
  leave already wrote it there.
- **Salary structure** (`salary_structure`, versioned by `effective_from`):
  admins set/update an employee's basic/HRA/allowances/deductions from
  their profile page (`components/employees/salary-card.tsx` →
  `actions/salary.ts` → `setSalaryAction`). It's an upsert on
  `(employee_id, effective_from)`, so a raise is a new row, not an
  overwrite — past payslips keep reading whatever was effective at the
  time, via a latest-row-on-or-before-month-start lookup.
- **Generation and finalization are Postgres functions**, matching the
  `0004_leave_functions.sql` pattern — not plain table writes —
  because the derivation is a real day-by-day loop over attendance that
  has to run atomically and stay consistent if re-run:
  - `generate_payroll_for_month(p_month, p_year)`
    (`supabase/migrations/0005_payroll_functions.sql`, join-date-aware fix
    in `0006_payroll_join_date_fix.sql`, current-month fix in
    `0007_payroll_current_month_fix.sql` — the one that's live) — for every
    active employee with a salary set, counts working days (Mon–Fri minus
    `holidays`) from whichever is later of the month start or their
    `date_of_joining`, **through whichever is earlier of month-end or
    today** (`least(v_month_end, current_date)`), tallies present/half/
    paid-leave against that range, and upserts a **draft** payslip. Safe to
    re-run any time — an `ON CONFLICT ... DO UPDATE ... WHERE status =
    'draft'` guard means finalized payslips are never touched by a
    regeneration. Net pay is floored at 0.
    **Bug fixed in 0007 (caught by the user in the UI, Aug 22):** before
    this, the day-walk always ran through month-end regardless of whether
    the month had happened yet — generating a draft for the *current*,
    in-progress month counted every remaining day (no attendance row
    exists for a day that hasn't occurred) as an unmarked absence. That
    inflated LOP for every employee's current-month draft, and for anyone
    who joined very recently — all of whose working days this month were
    still in the future — produced payable_days = 0 and a *negative* net
    pay, since fixed deductions were still subtracted from zero earnings.
    An employee with 0 elapsed working days this month now gets no payslip
    at all, rather than one built out of days that haven't happened.
    **Follow-up UX fix (same day):** the 0007 cutoff also means a *fully
    future* month (e.g. generating September while August is still in
    progress) makes every employee's date range invert
    (`effective_start` after `v_cutoff`), so `count_working_days` correctly
    returns 0 for everyone and the function returns zero rows — that part
    was always right, you can't derive payroll from attendance that hasn't
    happened. What was wrong was the message: `generatePayrollAction`
    (`src/app/actions/payroll.ts`) showed the generic "everyone eligible is
    already finalized, or no one has a salary set yet" toast, which is
    misleading for this case (nobody's finalized, salaries are set — the
    month just hasn't started). Fixed by checking the requested
    `{month, year}` against today's before calling the RPC at all, and
    returning "That month hasn't started yet — payroll is derived from
    attendance, so there's nothing to generate until it's under way."
    instead. `payroll-controls.tsx`'s month `<Input type="month">` also
    got a `max` bound (the current month) so the picker itself steers
    admins away from future months in the first place, matching how real
    payroll tools scope their period picker.
  - `finalize_payroll_for_month(p_month, p_year)` — flips that month's
    draft payslips to `final`, locking them in.
  - Both are `SECURITY DEFINER`, admin-only (checked inside the function,
    same as the leave functions), called from
    `src/app/actions/payroll.ts` via `supabase.rpc(...)`.
- **The breakdown dialog** (`components/payroll/payslip-breakdown-dialog.tsx`,
  fed by `getPayslipBreakdownAction` in `actions/payroll.ts`) re-derives the
  same day-by-day picture in TypeScript, for display only — it exists so
  anyone can see *why* a payslip has the numbers it has (present vs. half
  day vs. paid/unpaid leave vs. absent), not as a second source of truth.
  The stored payslip row is always what's authoritative.
- **The page** (`src/app/(dashboard)/payroll/page.tsx`) branches the same
  way `attendance/page.tsx` and `leave/page.tsx` do: admins get a month
  picker (`payroll-controls.tsx`) plus Generate/Finalize buttons and a
  table of everyone's payslip for that month
  (`admin-payslip-table.tsx`); employees get their own payslip history
  across all months (`my-payslips-table.tsx`). Both tables share the same
  breakdown dialog.

---

## 1e. Analytics, payslip PDFs, natural-language leave, attendance flags

Four smaller additions on top of the core Employees/Attendance/Leave/Payroll
spine, built in one pass after payroll shipped.

**Analytics** (`/analytics`, admin-only) reads the same tables everything
else already writes to — no new schema. `src/lib/analytics.ts` holds the
pure aggregation functions (attendance trend, attendance rate, leave
utilisation, payroll cost trend, department headcount); the page just
fetches rows and calls them. Charts are hand-rolled flexbox/CSS, not SVG —
an SVG `viewBox` scaled with `preserveAspectRatio="none"` stretches its text
non-uniformly once the container's real aspect ratio departs from the
viewBox's (a genuine bug hit and fixed while building this — see the
comment at the top of `attendance-trend-chart.tsx`). Chart status colors
reuse the Badge semantics already established (present=success,
absent=destructive) plus two chart-specific tokens (`--color-primary` for
leave, `--chart-half` for half-day — a darker amber than the app-wide
`--warning` token, needed because `--warning` blows out at the larger fill
area a chart bar covers). That four-color set was run through the dataviz
skill's `validate_palette.js` on the dark canvas; the green/amber pair
lands in the "legal only with secondary encoding" CVD band, which is why
every status chart always ships a legend, direct value labels, and a "View
as table" fallback — never color alone.

**Payslip PDF export** (`/api/payslips/[id]/pdf`, a Route Handler, not a
Server Action — binary responses need a real HTTP response) renders with
`pdfkit` server-side, no headless browser. Self-or-admin auth check, same
pattern as `getPayslipBreakdownAction`. It lays out the stored payslip
numbers plus a pro-rated Basic/HRA/Allowances breakdown pulled from
whichever `salary_structure` row was effective that month — it does not
recompute anything, only presents what's already there. "Download PDF"
buttons sit next to the breakdown-dialog trigger in both payslip tables.

**Natural-language leave apply** (`leave-apply-section.tsx`, above "My
requests" on `/leave`) parses free text like *"sick leave next Monday and
Tuesday"* into leave type + dates + half-day + reason, using `chrono-node`
for date extraction and simple keyword matching against the company's real
`leave_types`. No LLM call, no API key — deliberately, so the demo never
depends on external network. The parse only ever pre-fills the real
`ApplyLeaveDialog` (now a `forwardRef` exposing `openWithValues()`) for the
employee to review and submit — nothing is created from the parse alone. If
nothing readable comes out, it says so and points at the normal Apply
button, which still works exactly as before.

**Attendance anomaly flags** (`anomaly-panel.tsx`, bottom of the Attendance
admin page) also adds no schema — `src/lib/attendance-anomalies.ts` walks
each active employee's last 30 days of attendance (the same UTC-safe,
holiday-aware day-by-day pattern `getPayslipBreakdownAction` uses) and
flags absence streaks ≥3 days, ≥4 unexplained absences, an attendance rate
under 70%, or ≥5 half days. "Leave" status is never counted as an anomaly —
it's already approved. Each flagged row links to the employee's profile.

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
      payroll/             salary-derived payslips (admin generate/finalize,
                        everyone sees their own history)
      analytics/           attendance/leave/payroll charts, admin-only
    actions/            Server Actions (auth.ts, employees.ts, attendance.ts,
                        leave.ts, salary.ts, payroll.ts) — this is where
                        business logic and writes belong, never in client
                        components
    api/payslips/[id]/pdf/route.ts   the one Route Handler — a binary PDF
                        response can't come back from a Server Action
    auth/callback/      handles the email-verification redirect
  components/
    ui/                 base primitives (button, input, table, dialog, …)
    site/               app chrome (header, sidebar, footer, nav config,
                        realtime-refresher.tsx)
    employees/          Employees-module-specific components
    attendance/          check-in-card.tsx, admin-attendance-grid.tsx,
                        anomaly-panel.tsx
    leave/               apply-leave-dialog.tsx (forwardRef, openWithValues),
                        leave-apply-section.tsx (NL quick-apply),
                        my-leave-requests-table.tsx, leave-approval-queue.tsx
    payroll/             payroll-controls.tsx, admin-payslip-table.tsx,
                        my-payslips-table.tsx, payslip-breakdown-dialog.tsx
    analytics/           attendance-trend-chart.tsx, bar-chart.tsx — plain
                        flexbox/CSS charts, not SVG (see 1e for why)
  lib/
    supabase/           client.ts (browser), server.ts (Server Components/
                        Actions), admin.ts (service-role, server-only),
                        middleware.ts (session refresh + route protection)
    validations/        zod schemas, one file per feature
    auth.ts             getCurrentEmployee / requireEmployee / requireAdmin
    utils.ts            cn(), formatDate, formatMoney, todayISO, etc.
    analytics.ts         pure aggregation functions for the analytics charts
    attendance-anomalies.ts   pure anomaly-flagging over attendance rows
    nl-leave-parser.ts   chrono-node + keyword parsing for quick-apply leave
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
`supabase/migrations/0008_<name>.sql` (the next free number — `0001` is the
base schema, `0002` storage buckets, `0003` a grants fix, `0004` the leave
functions, `0005`/`0006`/`0007` the payroll functions) rather than editing
an already-applied file. Post in the team
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
Phase 3 (shipped): payroll — salary structure management, SQL-derived
generate/finalize, admin + employee payslip views with a day-by-day
breakdown dialog. See 1d above.
Phase 4 (shipped): analytics dashboard, payslip PDF export, natural-language
leave apply, attendance anomaly flags. See 1e above.
Next up: polish and demo rehearsal — no more planned feature phases. Full
context on the "why" behind each of these and the differentiators worth
building lives in the team's war-room doc — ask in chat if you don't have
the link.
