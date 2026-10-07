"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCollection } from "@/lib/hooks";
import { dateKey, fromDateKey, pad } from "@/lib/format";
import { cx } from "./ui";

const WEEK = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/**
 * The date title is a button: it opens a month grid so any day is one tap away.
 * `marks` puts a dot (with count) on days that have something, e.g. bookings.
 */
export function DatePicker({
  value,
  onChange,
  children,
  marks,
  className,
  align = "left",
}: {
  value: string;
  onChange: (key: string) => void;
  children: ReactNode;
  marks?: { col: string; field?: string; skip?: (row: Record<string, unknown>) => boolean };
  className?: string;
  align?: "left" | "center";
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7));
  const box = useRef<HTMLDivElement>(null);
  const today = dateKey();

  useEffect(() => {
    if (open) setMonth(value.slice(0, 7));
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const first = fromDateKey(`${month}-01`);
  const lastKey = dateKey(new Date(first.getFullYear(), first.getMonth() + 1, 0));
  const field = marks?.field ?? "dateKey";
  const { rows } = useCollection<Record<string, unknown>>(open && marks ? marks.col : null, [
    [field, ">=", `${month}-01`],
    [field, "<=", lastKey],
  ]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) {
      if (marks?.skip?.(r)) continue;
      const k = String(r[field]);
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [rows, marks, field]);

  // Monday-first grid with leading blanks.
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
  const step = (n: number) => {
    const d = new Date(first.getFullYear(), first.getMonth() + n, 1);
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };
  const pick = (k: string) => {
    onChange(k);
    setOpen(false);
  };

  return (
    <div ref={box} className={cx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Pilih tanggal"
        className="-mx-2 rounded-xl px-2 py-1 text-left transition-colors hover:bg-line-soft"
      >
        {children}
        <span className="sr-only">, pilih tanggal</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Kalender"
          className={cx(
            "anim-fade absolute top-full z-40 mt-2 w-[300px] rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-sheet)]",
            align === "center" ? "left-1/2 -translate-x-1/2" : "left-0",
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Bulan sebelumnya" onClick={() => step(-1)} className="flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-line-soft">
              <ChevronLeft className="size-5" />
            </button>
            <p className="text-sm font-bold capitalize">{first.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</p>
            <button type="button" aria-label="Bulan berikutnya" onClick={() => step(1)} className="flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-line-soft">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted">
            {WEEK.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((k, i) =>
              k ? (
                <button
                  key={k}
                  type="button"
                  onClick={() => pick(k)}
                  aria-label={fromDateKey(k).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                  aria-current={k === value ? "date" : undefined}
                  className={cx(
                    "relative flex h-10 flex-col items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                    k === value ? "bg-jade text-white" : k === today ? "text-jade ring-1 ring-jade ring-inset hover:bg-jade-mist" : "hover:bg-line-soft",
                    (i % 7 === 6) && k !== value && "text-danger/80",
                  )}
                >
                  <span className="tnum leading-none">{Number(k.slice(8))}</span>
                  {counts[k] ? (
                    <span className={cx("tnum mt-0.5 text-[9px] leading-none font-bold", k === value ? "text-white/85" : "text-jade")}>
                      {counts[k]}
                    </span>
                  ) : null}
                </button>
              ) : (
                <span key={`b${i}`} />
              ),
            )}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line-soft pt-2">
            {marks ? <span className="text-[11px] text-muted">Angka = jumlah booking</span> : <span />}
            <button type="button" onClick={() => pick(today)} className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-jade hover:bg-jade-mist">
              Hari ini
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
