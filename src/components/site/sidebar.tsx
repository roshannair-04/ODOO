import { Logo } from "@/components/site/logo";
import { NavLinks } from "@/components/site/nav-links";
import type { Role } from "@/lib/supabase/types";

export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-border bg-card px-4 py-5 lg:flex">
      <Logo className="px-2" />
      <NavLinks role={role} />
    </aside>
  );
}
