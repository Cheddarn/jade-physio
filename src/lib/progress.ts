import type { TherapyReport } from "./types";

/* Recovery progression: pain on the VAS (0-10, lower is better) and recovery (0-100 %, higher is better), session by session. */

export type Progress = Pick<TherapyReport, "pain" | "recovery">;

export const hasProgress = (r: Progress) => r.pain != null || r.recovery != null;

export interface Trend {
  tone: "good" | "same" | "bad";
  label: "Membaik" | "Stabil" | "Memburuk";
  /** e.g. "nyeri 6 → 4, pemulihan 40% → 60%" */
  detail: string;
}

/** How this session compares with the one before. Pain counts double: it is what the patient feels. */
export function trend(now: Progress, before?: Progress | null): Trend | null {
  if (!before || !hasProgress(now) || !hasProgress(before)) return null;
  const parts: string[] = [];
  let score = 0;
  if (now.pain != null && before.pain != null) {
    score += (before.pain - now.pain) * 2;
    parts.push(`nyeri ${before.pain} → ${now.pain}`);
  }
  if (now.recovery != null && before.recovery != null) {
    score += (now.recovery - before.recovery) / 10;
    parts.push(`pemulihan ${before.recovery}% → ${now.recovery}%`);
  }
  if (!parts.length) return null;
  const tone = score >= 1 ? "good" : score <= -1 ? "bad" : "same";
  return { tone, label: tone === "good" ? "Membaik" : tone === "bad" ? "Memburuk" : "Stabil", detail: parts.join(", ") };
}

/** "Nyeri 4/10, pemulihan 60%" */
export function progressText(r: Progress) {
  return [r.pain != null ? `nyeri ${r.pain}/10` : "", r.recovery != null ? `pemulihan ${r.recovery}%` : ""].filter(Boolean).join(", ");
}

/* ---------------- Per condition ----------------
   Progress only means something within one case: a patient treated for low back pain who later comes with a tennis
   elbow starts a new line. Reports are grouped by their condition; reports without one form their own group. */

/** The case a report belongs to ("" = no condition picked). */
export const caseOf = (r: { condition?: string | null }) => r.condition?.trim() || "";
export const caseLabel = (c: string) => c || "Tanpa kondisi";

/** The patient's earlier reports of the same case, newest first. */
export function earlierOfCase<T extends Pick<TherapyReport, "condition" | "sessionAt">>(reports: T[], condition: string | null | undefined, before: number): T[] {
  const k = caseOf({ condition });
  return reports.filter((r) => caseOf(r) === k && r.sessionAt < before).sort((a, b) => b.sessionAt - a.sessionAt);
}

/** The cases among a patient's reports with progress, the most recently treated first. */
export function casesOf<T extends Pick<TherapyReport, "condition" | "sessionAt" | "pain" | "recovery">>(reports: T[]) {
  const latest = new Map<string, { at: number; n: number }>();
  for (const r of reports) {
    if (!hasProgress(r)) continue;
    const k = caseOf(r);
    const cur = latest.get(k);
    latest.set(k, { at: Math.max(cur?.at ?? 0, r.sessionAt), n: (cur?.n ?? 0) + 1 });
  }
  return [...latest].sort((a, b) => b[1].at - a[1].at).map(([c, v]) => ({ condition: c, sessions: v.n }));
}
