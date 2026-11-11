"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cx } from "./ui";
import { num } from "@/lib/format";

/* Figures and small charts for the dashboard and the commission page.
   Marks carry the colour; every label, value and legend stays in the text colours. */

/** Two series that stay apart for colour-blind readers and clear 3:1 on white (checked with the palette validator). */
export const VIZ = {
  returning: "#1f9a73",
  fresh: "#2a78d6",
  good: "var(--color-jade-bead)",
  warn: "#c98500",
  bad: "var(--color-danger)",
  quiet: "#c9d3ce",
};

/** Change against the period before. `goodWhenUp` decides which direction reads as good news. */
export function Delta({ cur, prev, goodWhenUp = true, className }: { cur: number; prev: number | null; goodWhenUp?: boolean; className?: string }) {
  // Nothing to compare against: a jump "from zero" says more about the data than about the clinic.
  if (!prev) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const dir = cur > prev ? 1 : cur < prev ? -1 : 0;
  const good = dir === 0 ? null : dir > 0 === goodWhenUp;
  const Icon = dir > 0 ? ArrowUpRight : dir < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cx(
        "tnum inline-flex items-center gap-0.5 text-[12px] font-bold",
        good == null ? "text-muted" : good ? "text-jade-deep" : "text-danger",
        className,
      )}
      title="Dibanding periode sebelumnya dengan panjang yang sama"
    >
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(pct)}%
      <span className="sr-only">{dir > 0 ? "naik" : dir < 0 ? "turun" : "sama"} dibanding periode sebelumnya</span>
    </span>
  );
}

export function StatTile({
  label,
  value,
  sub,
  delta,
  href,
  lead,
  alert,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: ReactNode;
  href?: string;
  /** The one figure the page leads with. */
  lead?: boolean;
  alert?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <p className={cx("flex items-center justify-between gap-2 text-[13px] font-semibold", lead ? "text-white/75" : "text-ink-2")}>
        <span className="truncate">{label}</span>
        {delta && <span className={cx("shrink-0", lead && "rounded-full bg-white px-1.5 py-0.5")}>{delta}</span>}
      </p>
      <p className={cx("mt-1.5 truncate font-bold tracking-[-0.02em]", lead ? "text-[30px] leading-9" : "text-2xl")}>{value}</p>
      {sub && <p className={cx("mt-0.5 text-[12px] leading-snug", lead ? "text-white/75" : "text-muted")}>{sub}</p>}
    </>
  );
  const cls = cx(
    "block rounded-xl border p-4 shadow-[var(--shadow-card)]",
    lead ? "border-jade-deep bg-jade-deep text-white" : alert ? "border-amber/40 bg-surface" : "border-line bg-surface",
    href && "transition-shadow hover:shadow-[var(--shadow-lift)]",
    className,
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Legend({ items, className }: { items: { name: string; color: string }[]; className?: string }) {
  return (
    <ul className={cx("flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold text-ink-2", className)}>
      {items.map((s) => (
        <li key={s.name} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

const niceMax = (n: number) => {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= n / 4)! * pow;
  return Math.ceil(n / step) * step;
};

/**
 * Stacked columns over time. Each column is a hover and focus target that lists every series,
 * and the same numbers sit in a table for screen readers.
 */
export function StackedColumns({
  data,
  series,
  height = 208,
  format = num,
  unit,
}: {
  data: { key: string; label: string; full: string; values: number[] }[];
  series: { name: string; color: string }[];
  height?: number;
  format?: (n: number) => string;
  unit?: string;
}) {
  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0));
  const max = niceMax(Math.max(1, ...totals));
  const ticks = [max, max / 2, 0];
  // Label only as many columns as fit comfortably.
  const every = Math.max(1, Math.ceil(data.length / 12));
  return (
    <figure>
      {series.length > 1 && <Legend items={series} className="mb-3" />}
      <div className="flex gap-2">
        <div className="tnum relative w-9 shrink-0 text-right text-[11px] text-muted" style={{ height }} aria-hidden>
          {ticks.map((t, i) => (
            <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height }} aria-hidden>
            {ticks.map((_, i) => (
              <span key={i} className="absolute inset-x-0 border-t border-line-soft" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
            ))}
          </div>
          <div className="relative flex items-end" style={{ height }}>
            {data.map((d, i) => {
              const total = totals[i];
              const top = d.values.reduce((last, v, k) => (v > 0 ? k : last), -1);
              return (
                <div
                  key={d.key}
                  tabIndex={0}
                  aria-label={`${d.full}: ${series.map((s, k) => `${s.name} ${format(d.values[k])}`).join(", ")}`}
                  className="group relative flex h-full min-w-0 flex-1 cursor-default flex-col items-center justify-end outline-none"
                >
                  <div className="pointer-events-none absolute inset-y-0 w-full rounded-md group-hover:bg-ink/[0.04] group-focus-visible:bg-ink/[0.06]" />
                  <div className="relative flex w-full max-w-[24px] flex-col-reverse gap-[2px] px-[1px]" style={{ height: `${(total / max) * 100}%` }}>
                    {d.values.map((v, k) =>
                      v > 0 ? (
                        <span
                          key={k}
                          className={cx("block w-full", k === top && "rounded-t-[4px]")}
                          style={{ background: series[k].color, flexGrow: v, flexBasis: 0, minHeight: 2 }}
                        />
                      ) : null,
                    )}
                  </div>
                  <div
                    role="tooltip"
                    className={cx(
                      "pointer-events-none absolute bottom-full z-10 mb-1 hidden min-w-36 rounded-lg bg-ink px-3 py-2 text-left text-[12px] text-white shadow-lg group-hover:block group-focus-visible:block",
                      i < data.length / 2 ? "left-0" : "right-0",
                    )}
                  >
                    <p className="mb-1 font-semibold text-white/70">{d.full}</p>
                    {series.map((s, k) => (
                      <p key={s.name} className="flex items-center gap-2 whitespace-nowrap">
                        <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                        <span className="tnum font-bold">{format(d.values[k])}</span>
                        <span className="text-white/70">{s.name}</span>
                      </p>
                    ))}
                    {series.length > 1 && (
                      <p className="tnum mt-1 border-t border-white/15 pt-1 font-bold">
                        {format(total)} <span className="font-normal text-white/70">{unit ?? "total"}</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="tnum mt-1.5 flex text-[11px] text-muted" aria-hidden>
            {data.map((d, i) => (
              <span key={d.key} className="min-w-0 flex-1 text-center whitespace-nowrap">
                {i % every === 0 ? d.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>Data grafik</caption>
        <thead>
          <tr>
            <th>Periode</th>
            {series.map((s) => (
              <th key={s.name}>{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th>{d.full}</th>
              {d.values.map((v, k) => (
                <td key={k}>{format(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Ranked horizontal bars, one hue: for "which is biggest" (services, sources, hours). */
export function RankBars({
  rows,
  color = VIZ.returning,
  empty = "Belum ada data di rentang ini.",
}: {
  rows: { label: string; value: number; text?: string; sub?: string }[];
  color?: string;
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-semibold">{r.label}</span>
            <span className="tnum shrink-0">
              <span className="font-bold">{r.text ?? num(r.value)}</span>
              {r.sub && <span className="ml-2 text-[12px] text-muted">{r.sub}</span>}
            </span>
          </div>
          <div className="mt-1.5 h-2">
            <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One whole split into parts, thin: the figures beside it carry the numbers. */
export function SplitBar({ parts, className }: { parts: { name: string; value: number; color: string }[]; className?: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <div
      className={cx("flex h-2 gap-[2px] overflow-hidden rounded-full", !total && "bg-line-soft", className)}
      role="img"
      aria-label={parts.map((p) => `${p.name} ${p.value}`).join(", ")}
    >
      {parts.map((p) => (p.value > 0 ? <span key={p.name} title={`${p.name}: ${p.value}`} style={{ flexGrow: p.value, flexBasis: 0, background: p.color }} /> : null))}
    </div>
  );
}
