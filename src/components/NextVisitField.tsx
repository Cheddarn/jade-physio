"use client";

import { CalendarDays, X } from "lucide-react";
import { Field, Input, Textarea, cx } from "./ui";
import { addDays, longDate } from "@/lib/format";
import { NEXT_VISIT } from "@/lib/next-visit";

/*
  Rencana kunjungan berikutnya: a quick pick fills in the date, counted from the session day ("3 hari lagi" after a
  session on Monday is Thursday), or any date can be picked; the note says what the visit is for. Same file in both apps.
*/

type Value = { nextVisit?: string; nextVisitDate?: string | null };

export function NextVisitField({ value, onChange, sessionDay }: { value: Value; onChange: (patch: Value) => void; sessionDay: string }) {
  const note = value.nextVisit ?? "";
  const picked = (label: string) => note.trim().toLowerCase() === label.toLowerCase();

  function pick(label: string, days: number | null) {
    // Tapping the chosen one again clears it.
    if (picked(label)) return onChange({ nextVisit: "", nextVisitDate: null });
    onChange({ nextVisit: label, nextVisitDate: days == null ? null : addDays(sessionDay, days) });
  }

  return (
    <Field label="Rencana kunjungan berikutnya" htmlFor="rp-nd">
      <div role="group" aria-label="Pilihan cepat: Kunjungan berikutnya" className="flex flex-wrap gap-1.5">
        {NEXT_VISIT.map(([label, days]) => (
          <button
            key={label}
            type="button"
            aria-pressed={picked(label)}
            onClick={() => pick(label, days)}
            className={cx(
              "h-8 rounded-full border px-3 text-[13px] font-semibold transition-colors",
              picked(label) ? "border-jade bg-jade-mist text-jade-deep" : "border-line text-ink-2 hover:border-ink-2/40",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-ink-2">
          <CalendarDays className="size-4 text-jade" />
          Tanggal
        </span>
        <Input
          id="rp-nd"
          type="date"
          min={addDays(sessionDay, 1)}
          value={value.nextVisitDate ?? ""}
          onChange={(e) => onChange({ nextVisitDate: e.target.value || null })}
          className="min-w-0 flex-1 sm:max-w-52"
        />
        {value.nextVisitDate && (
          <button
            type="button"
            aria-label="Hapus tanggal kunjungan"
            onClick={() => onChange({ nextVisitDate: null })}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-line-soft hover:text-ink"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {value.nextVisitDate && <p className="text-sm font-semibold text-jade-deep">{longDate(value.nextVisitDate)}</p>}
      <Textarea
        id="rp-n"
        aria-label="Catatan kunjungan berikutnya"
        className="min-h-12"
        placeholder="Catatan, mis. evaluasi ROM, lanjut latihan penguatan"
        value={note}
        onChange={(e) => onChange({ nextVisit: e.target.value })}
      />
    </Field>
  );
}
