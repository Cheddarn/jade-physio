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
