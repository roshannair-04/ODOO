import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/dashboard" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 font-semibold tracking-tight text-foreground",
        className
      )}
      aria-label="Dayflow home"
    >
      <span className="logo-mark relative flex size-8 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(135deg,#7c87ff_0%,#5e6ad2_48%,#22c55e_100%)] shadow-[0_10px_32px_rgb(94_106_210_/_24%)] transition-transform duration-300 group-hover:-translate-y-0.5">
        <span className="absolute left-2 top-2 size-1.5 rounded-full bg-white/95" />
        <span className="absolute right-2 top-2 h-4 w-1.5 rounded-full bg-white/90" />
        <span className="absolute bottom-2 left-2 h-1.5 w-4 rounded-full bg-white/90" />
        <span className="absolute left-[13px] top-[13px] size-1.5 rounded-full bg-canvas/70 ring-1 ring-white/45" />
      </span>
      <span className="bg-[linear-gradient(120deg,var(--ink),var(--ink-muted)_46%,var(--primary-hover))] bg-clip-text text-transparent">
        Dayflow
      </span>
    </Link>
  );
}
