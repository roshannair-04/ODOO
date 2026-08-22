"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC shift from parseISO). */
function parseLocalISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function AttendanceCalendar({
  date,
  onSelect,
}: {
  date: string;
  onSelect: (next: string) => void;
}) {
  const selected = parseLocalISO(date);
  const monthStart = startOfMonth(selected);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(endOfMonth(monthStart));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function shiftMonth(delta: -1 | 1) {
    const next = delta === 1 ? addMonths(monthStart, 1) : subMonths(monthStart, 1);
    // Keep the same day-of-month when possible so the selection stays visible.
    const day = Math.min(selected.getDate(), endOfMonth(next).getDate());
    onSelect(format(new Date(next.getFullYear(), next.getMonth(), day), "yyyy-MM-dd"));
  }

  return (
    <div className="w-full max-w-xs rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft />
        </Button>
        <p className="text-sm font-medium tabular-nums">{format(monthStart, "MMMM yyyy")}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((label) => (
          <div key={label} className="py-1 text-[11px] font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const iso = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, monthStart);
          const selectedDay = isSameDay(day, selected);
          const today = isToday(day);

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              aria-label={format(day, "PPP")}
              aria-pressed={selectedDay}
              className={cn(
                "flex size-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !inMonth && "text-muted-foreground/50",
                inMonth && !selectedDay && "text-foreground",
                today && !selectedDay && "font-semibold text-primary",
                selectedDay && "bg-primary text-primary-foreground hover:bg-primary-hover"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
