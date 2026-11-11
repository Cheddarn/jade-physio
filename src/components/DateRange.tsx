"use client";

import { Input, Segmented } from "./ui";
import { addDays, dateKey, fromDateKey, shortDate } from "@/lib/format";

export type Preset = "today" | "7d" | "30d" | "month" | "lastmonth" | "custom";
export interface Range {
  preset: Preset;
  from: string;
  to: string;
}

export function presetRange(p: Preset, current?: Range): Range {
  const today = dateKey();
  const d = new Date();
  switch (p) {
    case "today":
      return { preset: p, from: today, to: today };
    case "7d":
      return { preset: p, from: addDays(today, -6), to: today };
    case "30d":
      return { preset: p, from: addDays(today, -29), to: today };
    case "month":
      return { preset: p, from: dateKey(new Date(d.getFullYear(), d.getMonth(), 1)), to: today };
    case "lastmonth":
      return {
        preset: p,
        from: dateKey(new Date(d.getFullYear(), d.getMonth() - 1, 1)),
        to: dateKey(new Date(d.getFullYear(), d.getMonth(), 0)),
      };
    default:
      return { preset: "custom", from: current?.from ?? today, to: current?.to ?? today };
  }
}

/** Days in the range, both ends included. */
export const rangeDays = (r: Pick<Range, "from" | "to">) =>
  Math.round((fromDateKey(r.to).getTime() - fromDateKey(r.from).getTime()) / 86_400_000) + 1;

/** The stretch of the same length just before this one, to compare against. */
export function previousRange(r: Pick<Range, "from" | "to">) {
  const n = rangeDays(r);
  return { from: addDays(r.from, -n), to: addDays(r.from, -1) };
}

export const rangeLabel = (r: Pick<Range, "from" | "to">) => (r.from === r.to ? shortDate(r.from) : `${shortDate(r.from)} – ${shortDate(r.to)}`);

export function DateRangePicker({ value, onChange, long }: { value: Range; onChange: (r: Range) => void; /** Offer "30 hari" too. */ long?: boolean }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <Segmented
          value={value.preset}
          onChange={(p) => onChange(presetRange(p, value))}
          options={[
            { value: "today", label: "Hari ini" },
            { value: "7d", label: "7 hari" },
            ...(long ? [{ value: "30d" as const, label: "30 hari" }] : []),
            { value: "month", label: "Bulan ini" },
            { value: "lastmonth", label: "Bulan lalu" },
            { value: "custom", label: "Pilih tanggal" },
          ]}
        />
      </div>
      {value.preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Dari tanggal"
            value={value.from}
            max={value.to}
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
            className="!h-10 md:w-40"
          />
          <span className="text-sm text-muted">s.d.</span>
          <Input
            type="date"
            aria-label="Sampai tanggal"
            value={value.to}
            min={value.from}
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
            className="!h-10 md:w-40"
          />
        </div>
      )}
    </div>
  );
}
