import * as chrono from "chrono-node";
import type { ParsedComponents } from "chrono-node";

// Client-side, no-API-key natural-language parsing for the leave "quick
// apply" input. chrono-node handles the date/range extraction ("next
// Monday", "Aug 25 to 27", "tomorrow"); leave-type and reason extraction are
// simple keyword/pattern matches against whatever leave types this company
// actually has. The result only ever pre-fills the real ApplyLeaveDialog
// form — nothing is submitted without the employee reviewing it there.

export interface NLLeaveTypeOption {
  id: string;
  name: string;
}

export interface ParsedLeaveRequest {
  leaveTypeId: string | null;
  leaveTypeName: string | null;
  startDate: string | null;
  endDate: string | null;
  isHalfDay: boolean;
  reason: string;
  matchedDateText: string | null;
  /** true once a date was found — enough to open the dialog pre-filled */
  understood: boolean;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function componentsToISO(components: ParsedComponents | null | undefined): string | null {
  if (!components) return null;
  const year = components.get("year");
  const month = components.get("month");
  const day = components.get("day");
  if (year == null || month == null || day == null) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const HALF_DAY_PATTERN = /\bhalf[\s-]?day\b/i;
const REASON_PATTERN = /\b(?:because|due to|for)\b\s+(.+)$/i;
const GENERIC_WORDS = new Set(["leave", "type", "request", "day", "days", "next", "this", "on", "off"]);

export function parseNaturalLeaveText(text: string, leaveTypes: NLLeaveTypeOption[]): ParsedLeaveRequest {
  const trimmed = text.trim();
  const results = chrono.parse(trimmed, new Date(), { forwardDate: true });
  const best = results[0] ?? null;

  const startDate = componentsToISO(best?.start ?? null);
  let endDate = best?.end ? componentsToISO(best.end) : startDate;

  const isHalfDay = HALF_DAY_PATTERN.test(trimmed);
  if (isHalfDay) endDate = startDate;

  let leaveTypeId: string | null = null;
  let leaveTypeName: string | null = null;
  const lower = trimmed.toLowerCase();
  for (const type of leaveTypes) {
    const tokens = type.name
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => !GENERIC_WORDS.has(token));
    if (tokens.length > 0 && tokens.some((token) => lower.includes(token))) {
      leaveTypeId = type.id;
      leaveTypeName = type.name;
      break;
    }
  }

  const reasonMatch = trimmed.match(REASON_PATTERN);
  const reason = reasonMatch ? reasonMatch[1].trim().replace(/[.!]+$/, "") : "";

  return {
    leaveTypeId,
    leaveTypeName,
    startDate,
    endDate,
    isHalfDay,
    reason,
    matchedDateText: best?.text ?? null,
    understood: startDate !== null,
  };
}
