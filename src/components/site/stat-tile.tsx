import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "warning" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-5">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            tone === "default" && "bg-primary-soft text-primary",
            tone === "warning" && "bg-warning-soft text-warning",
            tone === "destructive" && "bg-destructive-soft text-destructive"
          )}
        >
          <Icon className="size-4.5" />
        </span>
        <div className="flex flex-col">
          <span className="text-xl font-semibold tracking-tight leading-tight tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}
