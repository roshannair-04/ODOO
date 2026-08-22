import { MobileNav } from "@/components/site/mobile-nav";
import { UserMenu } from "@/components/site/user-menu";
import { Logo } from "@/components/site/logo";
import type { CurrentEmployee } from "@/lib/auth";

export function Header({ employee }: { employee: CurrentEmployee }) {
  return (
    <header className="motion-chrome flex h-14 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2">
        <MobileNav role={employee.role} />
        <Logo className="lg:hidden" />
      </div>
      <UserMenu employee={employee} />
    </header>
  );
}
