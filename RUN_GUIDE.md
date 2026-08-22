# Dayflow — Run Guide

Short path from clone to a working local app, plus how to smoke-test the
admin Attendance calendar and **Mark all present** flow.

For full architecture and schema notes, see [PROJECT_GUIDE.md](./PROJECT_GUIDE.md).

---

## Prerequisites

- Node.js **20+** (`node -v`)
- npm (`npm -v`)
- A [Supabase](https://supabase.com) project (free tier is fine)
- Git

---

## 1. Install

```bash
git clone https://github.com/roshannair-04/ODOO.git dayflow
cd dayflow
npm install
```

---

## 2. Database migrations

In the Supabase dashboard → **SQL Editor**, run these files **in order**
(paste whole file → Run):

| Order | File |
|------:|------|
| 1 | `supabase/migrations/0001_init.sql` |
| 2 | `supabase/migrations/0002_storage.sql` |
| 3 | `supabase/migrations/0003_grants.sql` |
| 4 | `supabase/migrations/0004_leave_functions.sql` |
| 5 | `supabase/migrations/0005_payroll_functions.sql` |
| 6 | `supabase/migrations/0006_payroll_join_date_fix.sql` |
| 7 | `supabase/migrations/0007_payroll_current_month_fix.sql` |

If you only need a fresh attendance/payroll stack on an already-migrated
project, still confirm `0003`–`0007` have been applied — leave and payroll
depend on those functions.

---

## 3. Environment

```bash
cp .env.example .env.local
```

Fill in from **Project Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Also set under **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: `http://localhost:3000/auth/callback`

---

## 4. Run the app

**Windows:** double-click `start-dayflow.bat` (installs deps if needed,
opens the browser, starts the server).

**Any platform:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Script | What it does |
|--------|----------------|
| `start-dayflow.bat` | Windows launcher → `npm run dev` |
| `npm run dev` | Next.js dev server (hot reload) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | Demo company (~25 employees) |

---

## 5. First login + demo data

1. **Sign up** — the first account on the project becomes **admin**.
2. Verify email (check spam / Auth logs if the link never arrives).
3. **Sign in**, then seed demo people (optional but recommended):

   ```bash
   npm run seed
   ```

   Demo employees use password `Dayflow123!` (emails like
   `aarav.sharma1@dayflow.demo`). Your admin account stays the only admin.

---

## 6. Smoke-test Attendance (admin)

Sign in as admin → sidebar **Attendance** (`/attendance`).

### Calendar (replaces the old date input)

1. Confirm a **month calendar** sits to the right of the employee summary
   (stacked on small screens).
2. Click a day — URL should become `/attendance?date=YYYY-MM-DD` and the
   grid should reload for that date.
3. Use **‹ / ›** to change months; the selected day should stay highlighted.

### Mark all present

1. Pick a working day that still has unmarked (or absent / half-day) rows.
2. Click **Mark all present**.
3. Expect a success toast and rows flipping to **Present**.
4. Rows already **Present** or **Leave** should be left alone.
5. Click again when everyone is covered — button disabled or toast:
   *Everyone is already present or on leave for this day.*

### Manual correction (regression)

1. Use the pencil on a row → change status / times → **Save correction**.
2. Confirm the badge and times update without a full page reload failure.

### Employee view (optional)

Sign in as a seeded employee → **Attendance** should show check-in/out and
history, **not** the admin calendar / mark-all controls.

---

## 7. Quick health checks

With `npm run dev` running:

```bash
# Typecheck
npm run typecheck

# App responds (expect redirect to sign-in when logged out)
curl -s -o NUL -w "%{http_code}" http://localhost:3000/attendance
```

In the browser DevTools (signed in as admin on `/attendance`):

- **Console** — no red errors after load, date change, or mark-all
- **Network** — no 4xx/5xx on document / RSC fetches
- **Visual** — month calendar visible; **Mark all present** beside the date summary

### Manual Visual QA checklist (admin Attendance)

- [ ] Calendar replaces the old native date input
- [ ] Selected day is highlighted; today is visually distinct when not selected
- [ ] Month prev/next keeps a sensible selected day
- [ ] Grid updates when a new day is clicked (`?date=` in the URL)
- [ ] **Mark all present** enabled when unmarked/absent/half-day rows exist
- [ ] Button disabled (or no-op toast) when everyone is present or on leave
- [ ] Leave rows stay **Leave** after bulk mark
- [ ] Layout: summary + button left, calendar right on desktop; stacked on mobile

---

## 8. Common issues

| Symptom | Fix |
|---------|-----|
| Verification link lands on wrong host | Add `http://localhost:3000/auth/callback` to Supabase Redirect URLs |
| `permission denied for table …` | Re-run `0003_grants.sql` |
| Empty employee grid | Run `npm run seed` or create employees under **Employees** |
| Mark all present fails | Confirm you’re signed in as **admin**; check Supabase Auth session |
| Stale attendance after another tab edits | Realtime should refresh; otherwise hard-refresh once |

---

## 9. Where the attendance UI lives

| Piece | Path |
|-------|------|
| Admin / employee page | `src/app/(dashboard)/attendance/page.tsx` |
| Calendar + mark-all UI | `src/components/attendance/admin-attendance-grid.tsx` |
| Month calendar | `src/components/attendance/attendance-calendar.tsx` |
| Server actions | `src/app/actions/attendance.ts` |
| Validation | `src/lib/validations/attendance.ts` |
