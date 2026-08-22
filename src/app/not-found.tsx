import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="px-6 py-5">
        <Logo href="/" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Compass className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-primary">404</p>
          <h1 className="text-2xl font-semibold text-balance">This page took a wrong turn</h1>
          <p className="max-w-sm text-sm text-muted-foreground text-balance">
            The page you&apos;re looking for doesn&apos;t exist, or you may not have access to it.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </main>
    </div>
  );
}
