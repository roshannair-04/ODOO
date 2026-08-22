import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { AttendanceTrendDay } from "@/lib/analytics";

// Vertical stacked bars, one per working day, status counts stacked
// bottom-to-top: present → half day → leave → absent. Status colors match
// the Badge variants used everywhere else in the app (present=success,
// absent=destructive); "leave" and "half day" get chart-specific hues
// (--color-primary / --chart-half) tuned for contrast + CVD separation on
// the dark canvas — see PROJECT_GUIDE.md "Analytics" for the validation.
//
// Plain flexbox/CSS rather than SVG: a percentage-viewBox SVG scaled with
// preserveAspectRatio="none" stretches its text non-uniformly (the classic
// squished-axis-label bug) once the container's real aspect ratio departs
// from the viewBox's. Div heights in px avoid the problem entirely.
const SEGMENTS: { key: keyof Pick<AttendanceTrendDay, "present" | "half_day" | "leave" | "absent">; label: string; color: string }[] = [
  { key: "present", label: "Present", color: "var(--color-success)" },
  { key: "half_day", label: "Half day", color: "var(--chart-half)" },
  { key: "leave", label: "Leave", color: "var(--color-primary)" },
  { key: "absent", label: "Absent", color: "var(--color-destructive)" },
];

const CHART_HEIGHT_PX = 140;

export function AttendanceTrendChart({ data }: { data: AttendanceTrendDay[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));

  return (
    <div className="flex flex-col gap-3">
      <div className="pt-2">
        <div className="flex items-end gap-1" style={{ height: CHART_HEIGHT_PX }}>
          {data.map((day) => (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              {day.total > 0 && <span className="text-[10px] leading-none text-muted-foreground">{day.total}</span>}
              <div className="flex w-full max-w-6 flex-col-reverse gap-px" title={day.label}>
                {SEGMENTS.map((seg) => {
                  const value = day[seg.key];
                  if (value === 0) return null;
                  const h = Math.max((value / max) * CHART_HEIGHT_PX, 3);
                  return (
                    <div
                      key={seg.key}
                      className="w-full rounded-[2px]"
                      style={{ height: h, backgroundColor: seg.color }}
                      title={`${day.label}: ${seg.label} ${value}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1 border-t border-border pt-1.5">
          {data.map((day) => (
            <div key={day.date} className="min-w-0 flex-1 text-center text-[10px] text-muted-foreground">
              {day.label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {SEGMENTS.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
            {seg.label}
          </div>
        ))}
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none font-medium text-foreground">View as table</summary>
        <div className="mt-2 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Half day</TableHead>
                <TableHead>Leave</TableHead>
                <TableHead>Absent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((day) => (
                <TableRow key={day.date}>
                  <TableCell className="text-sm">{day.label}</TableCell>
                  <TableCell className="text-sm tabular-nums">{day.present}</TableCell>
                  <TableCell className="text-sm tabular-nums">{day.half_day}</TableCell>
                  <TableCell className="text-sm tabular-nums">{day.leave}</TableCell>
                  <TableCell className="text-sm tabular-nums">{day.absent}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </div>
  );
}
