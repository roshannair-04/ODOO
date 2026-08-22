"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { signOutAction } from "@/app/actions/auth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { initials, titleCase } from "@/lib/utils";
import type { CurrentEmployee } from "@/lib/auth";

export function UserMenu({ employee }: { employee: CurrentEmployee }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOutAction();
    toast.success("Signed out");
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar>
          {employee.photo_url && <AvatarImage src={employee.photo_url} alt={employee.full_name} />}
          <AvatarFallback>{initials(employee.full_name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex flex-col gap-1 py-2">
          <span className="text-sm font-medium text-foreground">{employee.full_name}</span>
          <span className="text-xs text-muted-foreground">{employee.email}</span>
          <Badge variant={employee.role === "admin" ? "default" : "secondary"} className="mt-1 w-fit">
            {titleCase(employee.role)}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/profile")}>
          <UserIcon className="size-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleSignOut}
          disabled={signingOut}
          className="text-destructive focus:bg-destructive-soft"
        >
          <LogOut className="size-4" /> {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
