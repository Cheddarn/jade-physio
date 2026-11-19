"use client";

import { useState } from "react";
import { cx } from "./ui";
import { TrendBadge } from "./ClinicalFields";
import { dayMonth, shortDate } from "@/lib/format";
import { MEASURES, caseLabel, caseOf, caseSessions, casesOf, measuresIn, trend, type Measure } from "@/lib/progress";
import type { TherapyReport } from "@/lib/types";

/*
  Recovery over the sessions: two small charts, pain (VAS 0-10) and recovery (0-100 %). Two charts, not one with two
  axes, because the scales differ. One line each (2px, end dots with a surface ring), quiet gridlines, the latest value
  labelled, a hover crosshair with the values on screen, and the same numbers in a table for print and screen readers.
  Same file in both apps.
*/

const INK = "#1f9a73"; // series colour, checked against the white surface (contrast >= 3:1)
const GRID = "#e6e8eb";
const MUTED = "#6b7280";

type Point = Pick<TherapyReport, "pain" | "recovery" | "sessionAt" | "staffName" | "condition"> & { id?: string };

const MEASURE = {
  pain: { title: "Nyeri (VAS 0–10, makin rendah makin baik)", column: "Nyeri", max: 10, unit: (v: number) => `${v}`, cell: (v: number) => `${v}/10` },
  recovery: { title: "Pemulihan (makin tinggi makin baik)", column: "Pemulihan", max: 100, unit: (v: number) => `${v}%`, cell: (v: number) => `${v}%` },
} as const;

function Chart({
  title,
  points,
  pick,
  max,
  unit,
  current,
}: {
  title: string;
  points: Point[];
  pick: (p: Point) => number | null | undefined;
  max: number;
  unit: (v: number) => string;
  /** The session of the report being viewed, marked in the chart. */
  current?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320,
    H = 132,
    L = 40,
    R = 44,
    T = 10,
    B = 24;
  const n = points.length;
  const x = (i: number) => (n === 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const vals = points.map(pick);
  const drawn = vals.map((v, i) => (v == null ? null : { i, v }));
  const line = drawn.filter(Boolean) as { i: number; v: number }[];
  if (!line.length) return null;
  const path = line.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const lastPt = line[line.length - 1];
  const ticks = [0, max / 2, max];
  const xLabels = n <= 6 ? points.map((_, i) => i) : [0, n - 1];

  function move(e: React.PointerEvent<SVGRectElement>) {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setHover(best);
  }

  const h = hover != null ? points[hover] : null;
  const hv = hover != null ? vals[hover] : null;

  return (
    <figure className="relative min-w-0">
      <figcaption className="text-[13px] font-semibold text-ink-2">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 block h-auto w-full" role="img" aria-label={`${title}: ${line.map((p) => unit(p.v)).join(", ")}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R + 8} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={L - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill={MUTED}>
              {unit(t)}
            </text>
          </g>
        ))}
        {xLabels.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={10} fill={MUTED}>
            {dayMonth(points[i].sessionAt)}
          </text>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke={MUTED} strokeWidth={1} />}
        <path d={path} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {line.map((p) => {
          const isCurrent = current != null && points[p.i].sessionAt === current;
          return <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={isCurrent || hover === p.i ? 5.5 : 4} fill={INK} stroke="#fff" strokeWidth={2} />;
        })}
        {/* The latest value, in ink, beside its point. */}
        <text x={x(lastPt.i) + 9} y={y(lastPt.v) + 4} fontSize={12} fontWeight={700} fill="#1b2430">
          {unit(lastPt.v)}
        </text>
        <rect x={0} y={0} width={W} height={H} fill="transparent" className="no-print" onPointerMove={move} onPointerLeave={() => setHover(null)} />
      </svg>
      {h && (
        <div
          className="no-print pointer-events-none absolute top-6 z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-md"
          style={{ left: `${Math.min(70, Math.max(0, (x(hover!) / W) * 100 - 15))}%` }}
        >
          <p className="font-semibold">
            Sesi {hover! + 1}, {shortDate(h.sessionAt)}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: INK }} />
            {hv != null ? unit(hv) : "tidak diisi"}
          </p>
          <p className="text-muted">{h.staffName}</p>
        </div>
      )}
    </figure>
  );
}

/**
 * The patient's recovery up to a session: the two charts, how this session compares with the one before, and
 * (with `table`) every session's numbers.
 */
export function RecoveryProgress({
  reports,
  condition,
  upTo,
  current,
  measures,
  table = true,
  className,
}: {
  reports: (Point & Pick<TherapyReport, "progressNote">)[];
  /** Only this case's sessions: progress of another condition is a different line. */
  condition: string | null | undefined;
  /** Only sessions up to this time (a printed report shows its history, not later sessions). */
  upTo?: number;
  current?: number;
  /** The measures to show: a report shows the ones it records. By default, those recorded in any session. */
  measures?: Measure[];
  table?: boolean;
  className?: string;
}) {
  const k = caseOf({ condition });
  const points = caseSessions(reports, condition, upTo, measures ?? MEASURES);
  const shown = measures ?? measuresIn(points);
  if (!points.length || !shown.length) return null;
  const now = points[points.length - 1];
  const t = trend(now, points[points.length - 2]);
  const first = points[0];
  const span = points.length > 1 ? trend(now, first) : null;
  return (
    <div className={cx("flex flex-col gap-4", className)}>
      {(t || span) && (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {t && (
            <>
              <span className="text-muted">Dibanding sesi lalu:</span>
              <TrendBadge t={t} />
            </>
          )}
          {span && points.length > 2 && (
            <>
              <span className="text-muted">
                Sejak sesi pertama {k ? `${k} ` : ""}({dayMonth(first.sessionAt)}):
              </span>
              <TrendBadge t={span} />
            </>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        {shown.map((m) => (
          <Chart key={m} title={MEASURE[m].title} points={points} pick={(p) => p[m]} max={MEASURE[m].max} unit={MEASURE[m].unit} current={current} />
        ))}
      </div>
      {table && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">Progres pemulihan per sesi</caption>
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-1.5 pr-3 font-semibold">Sesi</th>
                <th className="py-1.5 pr-3 font-semibold">Tanggal</th>
                {shown.map((m) => (
                  <th key={m} className="py-1.5 pr-3 text-right font-semibold">
                    {MEASURE[m].column}
                  </th>
                ))}
                <th className="hidden py-1.5 font-semibold sm:table-cell print:table-cell">Catatan</th>
              </tr>
            </thead>
            {points.map((p, i) => {
              const note = p.progressNote || p.staffName;
              return (
                // One group per session: on a phone the note goes on its own line under the numbers, so the
                // table never needs scrolling sideways.
                <tbody key={p.id ?? p.sessionAt} className={cx("border-b border-line-soft", current === p.sessionAt && "font-semibold")}>
                  <tr className="align-top">
                    <td className="tnum py-1.5 pr-3">{i + 1}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{shortDate(p.sessionAt)}</td>
                    {shown.map((m) => {
                      const v = p[m];
                      return (
                        <td key={m} className="tnum py-1.5 pr-3 text-right">
                          {v != null ? MEASURE[m].cell(v) : "-"}
                        </td>
                      );
                    })}
                    <td className="hidden py-1.5 font-normal text-muted sm:table-cell print:table-cell">{note}</td>
                  </tr>
                  {note && (
                    <tr className="sm:hidden print:hidden">
                      <td colSpan={2 + shown.length} className="pb-1.5 text-[12.5px] leading-snug font-normal text-muted">
                        {note}
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * A patient's recovery, one condition at a time: with more than one condition, chips switch between them
 * (the most recently treated first). Each condition keeps its own line.
 */
export function RecoveryByCase({ reports, table = false }: { reports: (Point & Pick<TherapyReport, "progressNote">)[]; table?: boolean }) {
  const cases = casesOf(reports);
  const [chosen, setChosen] = useState<string | null>(null);
  if (!cases.length) return null;
  const pick = cases.some((c) => c.condition === chosen) ? chosen! : cases[0].condition;
  return (
    <div className="flex flex-col gap-3">
      {cases.length > 1 && (
        <div role="group" aria-label="Kondisi" className="flex flex-wrap gap-1.5">
          {cases.map((c) => (
            <button
              key={c.condition || "none"}
              type="button"
              aria-pressed={pick === c.condition}
              onClick={() => setChosen(c.condition)}
              className={cx(
                "flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors",
                pick === c.condition ? "border-jade bg-jade-mist text-jade-deep" : "border-line text-ink-2 hover:border-ink-2/40",
              )}
            >
              {caseLabel(c.condition)}
              <span className="tnum font-normal text-muted">{c.sessions} sesi</span>
            </button>
          ))}
        </div>
      )}
      {cases.length === 1 && cases[0].condition && <p className="text-[13px] font-semibold text-jade-deep">{cases[0].condition}</p>}
      <RecoveryProgress reports={reports} condition={pick} table={table} />
    </div>
  );
}
