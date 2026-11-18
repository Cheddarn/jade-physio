"use client";

import { useState } from "react";
import { ChevronDown, Copy, History } from "lucide-react";
import { cx } from "./ui";
import { shortDate, time } from "@/lib/format";
import { caseLabel, caseOf, progressText } from "@/lib/progress";
import type { TherapyReport } from "@/lib/types";

/* The patient's earlier reports inside the report form, to read before writing. Same file in both apps. */

type Report = TherapyReport & { id: string };

const FIRST = 4;

/**
 * Every earlier report of the patient, newest first. Each opens to its full content and can be copied as the
 * starting point of today's report; reports of the condition being written are marked.
 */
export function ReportHistory({
  reports,
  condition,
  onCopy,
  onContinue,
}: {
  reports: Report[];
  condition?: string | null;
  onCopy: (r: Report) => void;
  /** Continue one of the conditions treated before, so today's progress is compared with its sessions. */
  onContinue?: (condition: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  if (!reports.length) return null;
  const k = caseOf({ condition });
  const shown = all ? reports : reports.slice(0, FIRST);
  // The conditions treated before, the most recent first, with how many sessions each.
  const cases: { name: string; n: number; at: number }[] = [];
  for (const r of reports) {
    const c = caseOf(r);
    if (!c) continue;
    const x = cases.find((y) => y.name === c);
    if (x) x.n++;
    else cases.push({ name: c, n: 1, at: r.sessionAt });
  }
  return (
    <section aria-label="Riwayat laporan pasien" className="rounded-xl border border-line">
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
        <History className="size-4 shrink-0 text-jade" />
        <h3 className="text-sm font-semibold">
          Riwayat laporan pasien <span className="tnum font-normal text-muted">({reports.length})</span>
        </h3>
      </div>
      {onContinue && cases.length > 0 && (
        <div className="flex flex-col gap-1.5 px-3.5 pb-3">
          <p className="text-[12px] text-muted">
            {cases.length > 1 ? "Kondisi yang pernah ditangani. " : ""}Ketuk untuk melanjutkan kondisi yang sama, atau isi keluhan baru di bawah untuk kondisi lain.
          </p>
          <div role="group" aria-label="Lanjutkan kondisi" className="flex flex-wrap gap-1.5">
            {cases.map((c) => (
              <button
                key={c.name}
                type="button"
                aria-pressed={k === c.name}
                onClick={() => onContinue(c.name)}
                className={cx(
                  "flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors",
                  k === c.name ? "border-jade bg-jade-mist text-jade-deep" : "border-line text-ink-2 hover:border-jade/50",
                )}
              >
                {c.name}
                <span className="tnum font-normal text-muted">
                  {c.n} sesi, terakhir {shortDate(c.at)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <ul className="divide-y divide-line-soft border-t border-line-soft">
        {shown.map((r) => {
          const same = !!k && caseOf(r) === k;
          const isOpen = open === r.id;
          const progress = progressText(r);
          return (
            <li key={r.id}>
              <div className="flex items-start gap-2 px-3.5 py-2.5">
                <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-start gap-2 text-left">
                  <ChevronDown className={cx("mt-0.5 size-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span className="font-semibold">{shortDate(r.sessionAt)}</span>
                      <span className={cx("font-semibold", same ? "text-jade-deep" : "text-ink-2")}>{caseLabel(caseOf(r))}</span>
                      {same && <span className="rounded bg-jade-mist px-1.5 text-[11px] font-semibold text-jade-deep">Kondisi sama</span>}
                    </span>
                    <span className="block truncate text-[12px] text-muted">
                      {[r.staffName, progress, r.treatment].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onCopy(r)}
                  aria-label={`Salin isi laporan ${shortDate(r.sessionAt)}`}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 text-[12px] font-semibold text-ink-2 hover:border-jade/50 hover:text-jade-deep"
                >
                  <Copy className="size-3.5" />
                  Salin
                </button>
              </div>
              {isOpen && (
                <dl className="grid gap-2 px-3.5 pb-3 pl-9 text-[13px]">
                  {(
                    [
                      ["Waktu", `${shortDate(r.sessionAt)}, ${time(r.sessionAt)}`],
                      ["Keluhan", r.complaint],
                      ["Anamnesis", r.anamnesis],
                      ["Mekanisme", r.mechanism],
                      ["Pemeriksaan", r.assessment],
                      ["Tindakan", r.treatment],
                      ["Saran", r.advice],
                      ["Progres", [progress, r.progressNote].filter(Boolean).join(". ")],
                      ["Rencana", r.nextVisit],
                    ] as const
                  )
                    .filter(([, v]) => v?.trim())
                    .map(([label, v]) => (
                      <div key={label}>
                        <dt className="font-semibold text-ink-2">{label}</dt>
                        <dd className="whitespace-pre-line text-muted">{v}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
      {reports.length > FIRST && (
        <button
          type="button"
          onClick={() => setAll((x) => !x)}
          className="flex w-full items-center justify-center gap-1 border-t border-line-soft px-3.5 py-2 text-[13px] font-semibold text-jade hover:bg-canvas"
        >
          {all ? "Tampilkan lebih sedikit" : `Tampilkan semua ${reports.length}`}
          <ChevronDown className={cx("size-4 transition-transform", all && "rotate-180")} />
        </button>
      )}
    </section>
  );
}
