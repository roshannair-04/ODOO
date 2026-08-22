import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, User, CalendarCheck, CalendarClock, Wallet, Users, BarChart3 } from "lucide-react";
import type { Role } from "@/lib/supabase/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const employeeNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/leave", label: "Leave", icon: CalendarClock },
  { href: "/payroll", label: "Payroll", icon: Wallet },
];

export const adminNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/leave", label: "Leave approvals", icon: CalendarClock },
  { href: "/payroll", label: "Payroll", icon: Wallet },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function navFor(role: Role): NavItem[] {
  return role === "admin" ? adminNav : employeeNav;
}
