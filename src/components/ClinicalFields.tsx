"use client";

import { useState } from "react";
import { AlertTriangle, BookOpen, Search, TrendingDown, TrendingUp, Minus, X } from "lucide-react";
import { Field, Input, Textarea, cx } from "./ui";
import { conditionByName, conditionIdeas, matchCondition, searchConditions, type Condition } from "@/lib/conditions";
import { caseLabel, caseOf, hasProgress, progressText, trend, type Measure } from "@/lib/progress";
import { shortDate } from "@/lib/format";
import type { TherapyReport } from "@/lib/types";

/* The clinical parts of the report form, shared by both apps' forms (same file in jade-physio and jade-report). */

export type Clinical = Pick<TherapyReport, "complaint" | "condition" | "anamnesis" | "mechanism" | "pain" | "recovery" | "progressNote">;

/** A complaint is written but the mechanism of injury is not: the physio is warned (filling it is one tap away). */
export const noMechanism = (v: Pick<Clinical, "complaint" | "mechanism">) => !!v.complaint?.trim() && !v.mechanism?.trim();

/** The mechanism text is still the library's (or empty): it may be replaced when the condition changes. */
const untouched = (mechanism: string | undefined, c: Condition | null) => !mechanism?.trim() || (!!c && mechanism.trim() === c.mechanism);

/**
 * Keluhan, Anamnesis, Mekanisme cedera. Typing a complaint the library knows ("Cervical pain", "nyeri leher",
 * "tennis elbow") picks the case and fills in its usual mechanism of injury; the physio can pick another case or
 * rewrite the mechanism, and a rewritten mechanism is never overwritten.
 */
export function HistoryFields({ value, onChange }: { value: Clinical; onChange: (patch: Partial<Clinical>) => void }) {
  // Picked by hand (or cleared): typing the complaint no longer changes the case.
  const [picked, setPicked] = useState(() => !!value.condition && matchCondition(value.complaint)?.name !== value.condition);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  // The warning waits until the physio stops typing the complaint, so it does not flash up with the first letter.
  const [typing, setTyping] = useState(false);
  const current = conditionByName(value.condition);
  // From what is typed: the cases it may be. With no case yet, to pick one; with one found by itself, the others it
  // may also be (the physio decides, not the library).
  const ideas = searching ? [] : conditionIdeas(value.complaint ?? "", 6);
  const suggestions = !current ? ideas.slice(0, 5) : [];
  const others = current && !picked ? ideas.filter((c) => c.name !== current.name).slice(0, 4) : [];
  const found = searching ? searchConditions(q, 12) : [];

  function setComplaint(text: string) {
    const patch: Partial<Clinical> = { complaint: text };
    // The case follows the complaint only while it is the complaint's own match (or empty): a case picked by hand,
    // or continued from an earlier report, stays.
    if (!picked && (!value.condition || matchCondition(value.complaint)?.name === value.condition)) {
      const next = matchCondition(text);
      if ((next?.name ?? null) !== (value.condition ?? null)) {
        patch.condition = next?.name ?? null;
        if (untouched(value.mechanism, current)) patch.mechanism = next?.mechanism ?? "";
      }
    }
    onChange(patch);
  }

  function pick(c: Condition) {
    setPicked(true);
    setSearching(false);
    setQ("");
    onChange({
      condition: c.name,
      ...(value.complaint?.trim() ? {} : { complaint: c.name }),
      ...(untouched(value.mechanism, current) ? { mechanism: c.mechanism } : {}),
    });
  }

  function clear() {
    setPicked(true);
    onChange({ condition: null, ...(untouched(value.mechanism, current) ? { mechanism: "" } : {}) });
  }

  const auto = !!current && value.mechanism?.trim() === current.mechanism;

  return (
    <>
      <Field label="Keluhan" htmlFor="rp-c" hint="Ketik keluhan atau diagnosis, mis. Cervical pain, nyeri leher, tennis elbow.">
        <Textarea
          id="rp-c"
          className="min-h-14"
          value={value.complaint ?? ""}
          onChange={(e) => setComplaint(e.target.value)}
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
        />
        {current && !searching && (
          <span className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-jade-mist px-3 py-1 font-semibold text-jade-deep">
              <BookOpen className="size-3.5" />
              {current.name}
            </span>
            <span className="text-muted">{current.region}</span>
            <button type="button" onClick={() => setSearching(true)} className="font-semibold text-jade hover:text-jade-deep">
              Ganti
            </button>
            <button type="button" aria-label="Lepas kondisi" onClick={clear} className="rounded p-0.5 text-muted hover:text-ink">
              <X className="size-3.5" />
            </button>
          </span>
        )}
        {others.length > 0 && (
          <span className="flex flex-col gap-1.5">
            <span className="text-[12px] text-muted">Diagnosis lain yang mungkin dari keluhan ini:</span>
            <span role="group" aria-label="Diagnosis lain yang mungkin" className="flex flex-wrap gap-1.5">
              {others.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => pick(c)}
                  className="h-8 rounded-full border border-dashed border-line px-3 text-[13px] font-semibold text-ink-2 hover:border-jade/50 hover:bg-jade-mist/40"
                >
                  {c.name}
                </button>
              ))}
            </span>
          </span>
        )}
        {suggestions.length > 0 && (
          <span className="flex flex-col gap-1.5">
            <span className="text-[12px] text-muted">Diagnosis yang mungkin dari keluhan, ketuk untuk memilih dan mengisi mekanisme cedera:</span>
            <span role="group" aria-label="Kondisi yang mungkin" className="flex flex-wrap gap-1.5">
              {suggestions.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => pick(c)}
                  className="h-8 rounded-full border border-line px-3 text-[13px] font-semibold text-ink-2 hover:border-jade/50 hover:bg-jade-mist/40"
                >
                  {c.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSearching(true)}
                className="flex h-8 items-center gap-1 rounded-full px-2 text-[13px] font-semibold text-jade hover:text-jade-deep"
              >
                <Search className="size-3.5" />
                Cari lainnya
              </button>
            </span>
          </span>
        )}
        {!current && !suggestions.length && !searching && (
          <button type="button" onClick={() => setSearching(true)} className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-jade hover:text-jade-deep">
            <Search className="size-3.5" />
            Cari kondisi di pustaka
          </button>
        )}
        {searching && (
          <span className="flex flex-col gap-2 rounded-xl border border-line p-3">
            <span className="flex items-center gap-2">
              <Input autoFocus aria-label="Cari kondisi" placeholder="mis. lutut, frozen, saraf" value={q} onChange={(e) => setQ(e.target.value)} />
              <button type="button" onClick={() => setSearching(false)} className="shrink-0 text-[13px] font-semibold text-muted hover:text-ink">
                Batal
              </button>
            </span>
            {found.length > 0 && (
              <span role="group" aria-label="Hasil pustaka" className="flex flex-wrap gap-1.5">
                {found.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => pick(c)}
                    className="h-8 rounded-full border border-line px-3 text-[13px] font-semibold text-ink-2 hover:border-jade/50 hover:bg-jade-mist/40"
                  >
                    {c.name}
                  </button>
                ))}
              </span>
            )}
            {q.trim().length >= 2 && !found.length && <span className="text-[13px] text-muted">Tidak ada di pustaka. Tulis mekanisme cedera sendiri di bawah.</span>}
          </span>
        )}
        {noMechanism(value) && !typing && !searching && (
          <span role="note" className="flex items-start gap-2 rounded-lg bg-amber-mist px-3 py-2 text-[13px] text-amber">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-semibold">Mekanisme cedera belum terisi.</span>{" "}
              {current
                ? `Ketuk "Pakai teks pustaka ${current.name}" di bawah, atau tulis sendiri.`
                : suggestions.length
                  ? "Ketuk kondisi yang sesuai di atas agar terisi otomatis, atau tulis sendiri di bawah."
                  : "Cari kondisi di pustaka agar terisi otomatis, atau tulis sendiri di bawah."}
            </span>
          </span>
        )}
      </Field>

      <Field label="Anamnesis" htmlFor="rp-an">
        <Textarea
          id="rp-an"
          className="min-h-20"
          placeholder="Sejak kapan, awal mula, yang memperberat dan meringankan, pekerjaan dan aktivitas, riwayat penyakit, obat, pemeriksaan sebelumnya"
          value={value.anamnesis ?? ""}
          onChange={(e) => onChange({ anamnesis: e.target.value })}
        />
      </Field>

      <Field
        label="Mekanisme cedera"
        htmlFor="rp-mk"
        hint={
          auto
            ? `Terisi otomatis dari pustaka (${current!.name}). Sesuaikan dengan cerita pasien.`
            : current
              ? undefined
              : "Pilih kondisi di atas untuk mengisi otomatis, atau tulis sendiri."
        }
      >
        <Textarea id="rp-mk" className="min-h-16" value={value.mechanism ?? ""} onChange={(e) => onChange({ mechanism: e.target.value })} />
        {current && !auto && (
          <button type="button" onClick={() => onChange({ mechanism: current.mechanism })} className="self-start text-[13px] font-semibold text-jade hover:text-jade-deep">
            Pakai teks pustaka {current.name}
          </button>
        )}
      </Field>
    </>
  );
}

/* Which measures a physio includes on a new report, remembered on this device: one who never measures recovery
   turns it off once. Only a convenience; the reports themselves say what each one includes. */
const INCLUDE_KEY = "jade-progress-include";
function rememberedInclude(): Record<Measure, boolean> {
  try {
    const v = JSON.parse(localStorage.getItem(INCLUDE_KEY) ?? "null");
    return { pain: v?.pain !== false, recovery: v?.recovery !== false };
  } catch {
    return { pain: true, recovery: true };
  }
}
function rememberInclude(m: Measure, on: boolean) {
  try {
    localStorage.setItem(INCLUDE_KEY, JSON.stringify({ ...rememberedInclude(), [m]: on }));
  } catch {
    // Private mode or storage blocked: the switch still works for this report.
  }
}

/**
 * Progres pemulihan: pain on the VAS and recovery %, plus a note, compared with the previous session of the same
 * condition. Another condition's sessions are not compared: a new condition starts its own line.
 * Each measure can be left out of the report with its switch.
 */
export function ProgressFields({
  value,
  onChange,
  last,
  otherCases,
  isNew = false,
}: {
  value: Clinical;
  onChange: (patch: Partial<Clinical>) => void;
  /** The patient's previous report of the same condition, to compare with. */
  last?: Pick<TherapyReport, "pain" | "recovery" | "sessionAt"> | null;
  /** The patient has earlier reports, but only for other conditions. */
  otherCases?: boolean;
  /** A report being written now, not one being changed: its switches start from the previous session of the case,
   *  or from this device's last choice. */
  isNew?: boolean;
}) {
  const [chosen, setChosen] = useState<Partial<Record<Measure, boolean>>>({});
  const [remembered] = useState(rememberedInclude);
  const on = (m: Measure) => chosen[m] ?? (value[m] != null || (isNew && (last && hasProgress(last) ? last[m] != null : remembered[m])));
  function include(m: Measure, yes: boolean) {
    setChosen((c) => ({ ...c, [m]: yes }));
    // Left out means not on the report: a value picked before goes.
    if (!yes && value[m] != null) onChange({ [m]: null });
    rememberInclude(m, yes);
  }
  const any = on("pain") || on("recovery");
  const t = trend(value, last);
  const before = last ? progressText(last) : "";
  const label = caseLabel(caseOf(value));
  return (
    <Field label="Progres pemulihan">
      <div className="flex flex-col gap-3 rounded-xl border border-line p-3.5">
        <Scale
          label="Skala nyeri (VAS)"
          hint="0 tidak nyeri, 10 nyeri terberat"
          values={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
          value={value.pain}
          format={(v) => String(v)}
          onPick={(v) => onChange({ pain: v })}
          included={on("pain")}
          onInclude={(yes) => include("pain", yes)}
        />
        <Scale
          label="Perkiraan pemulihan"
          hint="dibanding kondisi awal"
          values={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
          value={value.recovery}
          format={(v) => `${v}%`}
          onPick={(v) => onChange({ recovery: v })}
          included={on("recovery")}
          onInclude={(yes) => include("recovery", yes)}
        />
        {any && (before || t) && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            {before && (
              <span className="text-muted">
                Sesi lalu untuk {label}
                {last?.sessionAt ? ` (${shortDate(last.sessionAt)})` : ""}: {before}.
              </span>
            )}
            {t && <TrendBadge t={t} />}
          </p>
        )}
        {!last && otherCases && (
          <p className="text-[13px] text-muted">
            {caseOf(value)
              ? `Sesi pertama untuk ${label}. Progres dihitung per kondisi; sesi kondisi lain tidak dibandingkan.`
              : "Pilih kondisi di Keluhan agar progres dibandingkan dengan sesi kondisi yang sama."}
          </p>
        )}
        <Textarea
          aria-label="Catatan progres"
          className="min-h-12"
          placeholder="Catatan progres (opsional), mis. ROM fleksi bahu 120° → 140°, jalan tanpa pincang"
          value={value.progressNote ?? ""}
          onChange={(e) => onChange({ progressNote: e.target.value })}
        />
      </div>
    </Field>
  );
}

function Scale({
  label,
  hint,
  values,
  value,
  format,
  onPick,
  included,
  onInclude,
}: {
  label: string;
  hint: string;
  values: number[];
  value?: number | null;
  format: (v: number) => string;
  onPick: (v: number | null) => void;
  /** Shown on the report. Off: the scale folds away and the report leaves this measure out. */
  included: boolean;
  onInclude: (on: boolean) => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 pt-0.5 text-[13px]">
          <span className={cx("font-semibold", included ? "text-ink-2" : "text-muted")}>{label}</span>{" "}
          <span className="text-muted">({hint})</span>
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={included}
          aria-label={`Cantumkan ${label} di laporan`}
          onClick={() => onInclude(!included)}
          className="flex shrink-0 items-center gap-2 rounded-lg py-0.5 text-[12.5px] font-semibold text-ink-2"
        >
          Cantumkan
          <span className={cx("relative h-5 w-9 rounded-full transition-colors", included ? "bg-jade" : "bg-line")}>
            <span
              className={cx(
                "absolute top-0.5 left-0 size-4 rounded-full bg-white shadow transition-transform",
                included ? "translate-x-[18px]" : "translate-x-0.5",
              )}
            />
          </span>
        </button>
      </div>
      {!included ? (
        <p className="mt-1 text-[13px] text-muted">Tidak dicantumkan di laporan.</p>
      ) : (
        <div role="group" aria-label={label} className="mt-1.5 flex flex-wrap gap-1">
          {values.map((v) => {
            const on = value === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                // Tapping the chosen value again clears it.
                onClick={() => onPick(on ? null : v)}
                className={cx(
                  "tnum h-8 min-w-9 rounded-lg border px-2 text-[13px] font-semibold transition-colors",
                  on ? "border-jade bg-jade text-white" : "border-line text-ink-2 hover:border-ink-2/40",
                )}
              >
                {format(v)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Membaik / Stabil / Memburuk, always with an icon and the word, never colour alone. */
export function TrendBadge({ t, className }: { t: NonNullable<ReturnType<typeof trend>>; className?: string }) {
  // Arrows say better or worse, not which way a number moved: less pain is "up".
  const Icon = t.tone === "good" ? TrendingUp : t.tone === "bad" ? TrendingDown : Minus;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold",
        t.tone === "good" ? "bg-jade-mist text-jade-deep" : t.tone === "bad" ? "bg-danger-mist text-danger" : "bg-line-soft text-ink-2",
        className,
      )}
      title={t.detail}
    >
      <Icon className="size-3.5" />
      {t.label}
      <span className="font-normal">({t.detail})</span>
    </span>
  );
}
