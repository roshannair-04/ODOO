// Hand-maintained types for the Supabase schema (see supabase/migrations/0001_init.sql).
// Swap this file for a generated one anytime with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts

export type Role = "admin" | "employee";
export type EmployeeStatus = "active" | "inactive";
export type AttendanceStatus = "present" | "absent" | "half_day" | "leave";
export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type PayslipStatus = "draft" | "final";

export interface Database {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          user_id: string;
          employee_code: string;
          full_name: string;
          email: string;
          phone: string | null;
          address: string | null;
          photo_url: string | null;
          department_id: string | null;
          designation: string | null;
          date_of_joining: string;
          manager_id: string | null;
          role: Role;
          status: EmployeeStatus;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["employees"]["Row"]> & {
          user_id: string;
          employee_code: string;
          full_name: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["employees"]["Row"]>;
      };
      departments: {
        Row: { id: string; name: string; head_employee_id: string | null };
        Insert: Partial<Database["public"]["Tables"]["departments"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["departments"]["Row"]>;
      };
    };
  };
}
