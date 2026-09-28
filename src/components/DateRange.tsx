"use client";

import { Input, Segmented } from "./ui";
import { addDays, dateKey } from "@/lib/format";

export type Preset = "today" | "7d" | "month" | "lastmonth" | "custom";
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

export function DateRangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <Segmented
          value={value.preset}
          onChange={(p) => onChange(presetRange(p, value))}
          options={[
            { value: "today", label: "Hari ini" },
            { value: "7d", label: "7 hari" },
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
