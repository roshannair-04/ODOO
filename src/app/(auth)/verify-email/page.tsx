import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Check your inbox for a verification link to activate your Dayflow account.",
};

export default function VerifyEmailPage() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
          <MailCheck className="size-5" />
        </span>
        <h1 className="text-lg font-semibold">Check your inbox</h1>
        <p className="text-sm text-muted-foreground text-balance">
          We sent a verification link to your email. Click it to activate your account, then sign in.
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
