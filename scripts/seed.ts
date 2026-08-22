/**
 * Seeds Dayflow with a believable demo company: 4 departments and ~25
 * employees. Idempotent — safe to run more than once, existing seed accounts
 * are skipped rather than duplicated.
 *
 * Usage:  npm run seed
 * Needs:  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * All seed accounts share one password so the whole team can log in as any
 * of them while demoing — see SEED_PASSWORD below. Their emails all end in
 * @dayflow.demo, so it's obvious at a glance which accounts are seed data.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SEED_PASSWORD = "Dayflow123!";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Copy .env.example to .env.local and fill in your Supabase project's values first."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEPARTMENTS = ["Engineering", "Sales", "People & Culture", "Finance"] as const;

const DESIGNATIONS: Record<(typeof DEPARTMENTS)[number], string[]> = {
  Engineering: ["Software Engineer", "Senior Software Engineer", "QA Engineer", "Engineering Manager", "DevOps Engineer"],
  Sales: ["Sales Executive", "Account Manager", "Sales Lead", "Business Development Associate"],
  "People & Culture": ["HR Executive", "Talent Acquisition Specialist", "HR Manager"],
  Finance: ["Accountant", "Finance Analyst", "Finance Manager"],
};

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditi", "Diya", "Kabir", "Ishaan", "Ananya", "Meera",
  "Rohan", "Sanya", "Arjun", "Priya", "Karan", "Neha", "Aryan", "Riya",
  "Vihaan", "Anika", "Dev", "Tara", "Yash", "Kiara", "Rehan", "Nisha", "Amit",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Iyer", "Nair", "Gupta", "Reddy", "Menon", "Kapoor",
  "Rao", "Das", "Chatterjee", "Pillai", "Bhatt", "Malhotra", "Singh", "Joshi",
];

interface SeedEmployee {
  fullName: string;
  email: string;
  employeeCode: string;
  department: (typeof DEPARTMENTS)[number];
  designation: string;
  phone: string;
  address: string;
  dateOfJoining: string;
  isDeptHead: boolean;
}

function buildRoster(): SeedEmployee[] {
  const roster: SeedEmployee[] = [];
  let codeSeq = 1;

  for (const dept of DEPARTMENTS) {
    const headCount = dept === "Engineering" ? 8 : dept === "Sales" ? 7 : dept === "Finance" ? 5 : 5;
    for (let i = 0; i < headCount; i++) {
      const first = FIRST_NAMES[(codeSeq * 3 + i) % FIRST_NAMES.length];
      const last = LAST_NAMES[(codeSeq * 5 + i) % LAST_NAMES.length];
      const fullName = `${first} ${last}`;
      const code = `EMP-${String(1000 + codeSeq).padStart(4, "0")}`;
      const designations = DESIGNATIONS[dept];
      const designation = i === 0 ? designations[designations.length - 1] : designations[i % (designations.length - 1)];

      // Spread joining dates over the last ~2 years so tenure looks real.
      const daysAgo = 30 + ((codeSeq * 37) % 700);
      const joinDate = new Date();
      joinDate.setDate(joinDate.getDate() - daysAgo);

      roster.push({
        fullName,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${codeSeq}@dayflow.demo`,
        employeeCode: code,
        department: dept,
        designation,
        phone: `9${String(100000000 + codeSeq * 7919).slice(0, 9)}`,
        address: `${100 + codeSeq}, ${["MG Road", "Residency Road", "Indiranagar", "Whitefield", "Koramangala"][codeSeq % 5]}, Bengaluru`,
        dateOfJoining: joinDate.toISOString().slice(0, 10),
        isDeptHead: i === 0,
      });
      codeSeq++;
    }
  }
  return roster;
}

async function main() {
  console.log("Seeding Dayflow demo data…\n");

  // 1. Departments
  const departmentIds = new Map<string, string>();
  for (const name of DEPARTMENTS) {
    const { data: existing } = await supabase.from("departments").select("id").eq("name", name).maybeSingle();
    if (existing) {
      departmentIds.set(name, existing.id);
      continue;
    }
    const { data, error } = await supabase.from("departments").insert({ name }).select("id").single();
    if (error) throw error;
    departmentIds.set(name, data.id);
  }
  console.log(`✓ ${DEPARTMENTS.length} departments ready`);

  // 2. Existing seed users (so re-runs don't duplicate)
  const existingByEmail = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) if (u.email) existingByEmail.set(u.email, u.id);
    if (data.users.length < 200) break;
    page++;
  }

  const roster = buildRoster();
  const employeeIdByEmail = new Map<string, string>();
  const deptHeadEmployeeId = new Map<string, string>();

  let created = 0;
  let skipped = 0;

  for (const person of roster) {
    let userId = existingByEmail.get(person.email);

    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: person.email,
        password: SEED_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: person.fullName, employee_code: person.employeeCode },
      });
      if (error) {
        console.warn(`  ! skipped ${person.email}: ${error.message}`);
        continue;
      }
      userId = data.user.id;
      created++;
    } else {
      skipped++;
    }

    // The on_auth_user_created trigger already inserted the employees row —
    // fill in the rest (department, designation, etc.) with a follow-up update.
    const { data: empRow, error: fetchError } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", userId)
      .single();
    if (fetchError || !empRow) {
      console.warn(`  ! couldn't find employee row for ${person.email}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("employees")
      .update({
        department_id: departmentIds.get(person.department),
        designation: person.designation,
        phone: person.phone,
        address: person.address,
        date_of_joining: person.dateOfJoining,
        status: "active",
        role: "employee",
      })
      .eq("id", empRow.id);
    if (updateError) console.warn(`  ! couldn't update ${person.email}: ${updateError.message}`);

    employeeIdByEmail.set(person.email, empRow.id);
    if (person.isDeptHead) deptHeadEmployeeId.set(person.department, empRow.id);
  }

  console.log(`✓ ${created} employee accounts created, ${skipped} already existed`);

  // 3. Assign managers: department head reports to no one, everyone else in
  // that department reports to their head.
  for (const person of roster) {
    if (person.isDeptHead) continue;
    const headId = deptHeadEmployeeId.get(person.department);
    const empId = employeeIdByEmail.get(person.email);
    if (!headId || !empId) continue;
    await supabase.from("employees").update({ manager_id: headId }).eq("id", empId);
  }

  // 4. Mark department heads on the departments table itself.
  for (const [dept, headId] of deptHeadEmployeeId) {
    await supabase.from("departments").update({ head_employee_id: headId }).eq("name", dept);
  }
  console.log(`✓ Reporting lines set for ${roster.length} employees`);

  console.log("\nDone. Every seed account's password is:", SEED_PASSWORD);
  console.log("Sign in as any of them, e.g.:", roster[0]?.email);
  console.log("\nYour own real sign-up (the first account ever created) stays the workspace admin.");
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
