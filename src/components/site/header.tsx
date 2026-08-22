import { MobileNav } from "@/components/site/mobile-nav";
import { UserMenu } from "@/components/site/user-menu";
import { Logo } from "@/components/site/logo";
import type { NavItem } from "@/components/site/nav-config";
import type { CurrentEmployee } from "@/lib/auth";

export function Header({ items, employee }: { items: NavItem[]; employee: CurrentEmployee }) {
  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <MobileNav items={items} />
        <Logo className="lg:hidden" />
      </div>
      <UserMenu employee={employee} />
    </header>
  );
}
