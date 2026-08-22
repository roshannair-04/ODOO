import Link from "next/link";

const SUPPORT_EMAIL = "support@dayflow.app";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {year} Dayflow. Every workday, perfectly aligned.</p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Footer">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <Link href="/profile" className="hover:text-foreground transition-colors">
            Profile
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-foreground transition-colors">
            {SUPPORT_EMAIL}
          </a>
        </nav>
      </div>
    </footer>
  );
}
