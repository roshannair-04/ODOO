import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { BarDatum } from "@/lib/analytics";

// Single-series magnitude chart — vertical columns (e.g. cost by month) or
// horizontal bars (e.g. headcount by department). One hue, no legend needed
// (a single series names itself via the card title), values direct-labeled
// since these charts only ever plot a handful of categories.
//
// Plain flexbox/CSS, not SVG viewBox math — see attendance-trend-chart.tsx
// for why (non-uniform scaling stretches text once the container's real
// aspect ratio departs from the viewBox's).

const CHART_HEIGHT_PX = 120;

export function BarChart({
  data,
  orientation = "vertical",
  color = "var(--color-primary)",
  valueFormatter = (n: number) => String(n),
  emptyLabel = "No data yet.",
}: {
  data: BarDatum[];
  orientation?: "vertical" | "horizontal";
  color?: string;
  valueFormatter?: (n: number) => string;
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const max = Math.max(1, ...data.map((d) => d.value));

  if (orientation === "horizontal") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2.5">
          {data.map((d) => (
            <div key={d.key} className="flex flex-col gap-1" title={d.detail ?? `${d.label}: ${valueFormatter(d.value)}`}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-foreground">{d.label}</span>
                <span className="font-medium tabular-nums text-foreground">{valueFormatter(d.value)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0)}%`, backgroundColor: color }}
                />
              </div>
            </div>
          ))}
        </div>
        <TableFallback data={data} valueFormatter={valueFormatter} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-end gap-2" style={{ height: CHART_HEIGHT_PX }}>
          {data.map((d) => {
            const h = Math.max((d.value / max) * CHART_HEIGHT_PX, d.value > 0 ? 3 : 0);
            return (
              <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                {d.value > 0 && <span className="text-[10px] leading-none text-muted-foreground">{valueFormatter(d.value)}</span>}
                <div
                  className="w-full max-w-6 rounded-t-[3px]"
                  style={{ height: h, backgroundColor: color }}
                  title={`${d.label}: ${valueFormatter(d.value)}`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-2 border-t border-border pt-1.5">
          {data.map((d) => (
            <div key={d.key} className="min-w-0 flex-1 text-center text-[10px] text-muted-foreground">
              {d.label}
            </div>
          ))}
        </div>
      </div>
      <TableFallback data={data} valueFormatter={valueFormatter} />
    </div>
  );
}

function TableFallback({ data, valueFormatter }: { data: BarDatum[]; valueFormatter: (n: number) => string }) {
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none font-medium text-foreground">View as table</summary>
      <div className="mt-2 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.key}>
                <TableCell className="text-sm">{d.label}</TableCell>
                <TableCell className="text-sm tabular-nums">{valueFormatter(d.value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </details>
  );
}
