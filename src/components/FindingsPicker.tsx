"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cx } from "./ui";
import { PickTabs } from "./PickTabs";
import { NEG, POS, SCALES, SIGNS, TESTS, setValue, testAreaOf, valueOf } from "@/lib/quickpicks";

/*
  Pemeriksaan / temuan by tapping: signs ("Spasme: (+)"), movement and function ("ROM: terbatas sedang",
  "Kekuatan otot (MMT): 4/5"), and special tests for the area being treated ("Lasegue (SLR): (+)"). Each tap edits
  the text below it, which the physio can still add to. Same file in both apps.
*/

type Tab = "tanda" | "gerak" | "tes";

/** Off, then (+), then (-), then off again. */
const nextSign = (v: string | null) => (v === POS ? NEG : v === NEG ? null : POS);

function SignChip({ label, value, onTap }: { label: string; value: string | null; onTap: () => void }) {
  const state = value === POS ? "pos" : value === NEG ? "neg" : null;
  return (
    <button
      type="button"
      aria-pressed={!!state}
      aria-label={state === "pos" ? `${label}, positif` : state === "neg" ? `${label}, negatif` : label}
      onClick={onTap}
      className={cx(
        "flex h-8 items-center gap-1.5 rounded-full border pr-3 pl-3 text-[13px] font-semibold transition-colors",
        state === "pos" && "border-jade bg-jade-mist pl-1.5 text-jade-deep",
        state === "neg" && "border-ink-2/30 bg-line-soft pl-1.5 text-ink-2",
        !state && "border-line text-ink-2 hover:border-ink-2/40",
      )}
    >
      {state && (
        <span className={cx("flex size-5 items-center justify-center rounded-full text-white", state === "pos" ? "bg-jade" : "bg-ink-2")}>
          {state === "pos" ? <Plus className="size-3" strokeWidth={3} /> : <Minus className="size-3" strokeWidth={3} />}
        </span>
      )}
      {label}
    </button>
  );
}

export function FindingsPicker({ value, onChange, condition }: { value: string | undefined; onChange: (text: string) => void; condition?: string | null }) {
  const [tab, setTab] = useState<Tab>("tanda");
  const [area, setArea] = useState<string | null>(null);
  const shownArea = area ?? testAreaOf(condition);
  const text = value ?? "";

  const count = (t: Tab) =>
    t === "tanda"
      ? SIGNS.filter((s) => valueOf(text, s)).length
      : t === "gerak"
        ? SCALES.filter((s) => valueOf(text, s.label)).length
        : Object.values(TESTS)
            .flat()
            .filter((s) => valueOf(text, s)).length;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line p-3">
      <PickTabs
        label="Jenis temuan"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "tanda", name: "Tanda", count: count("tanda") },
          { id: "gerak", name: "Gerak & fungsi", count: count("gerak") },
          { id: "tes", name: "Tes khusus", count: count("tes") },
        ]}
      />

      {tab === "tanda" && (
        <>
          <p className="text-[12px] text-muted">Ketuk sekali untuk (+), dua kali untuk (−), tiga kali untuk menghapus.</p>
          <div role="group" aria-label="Tanda" className="flex flex-wrap gap-1.5">
            {SIGNS.map((s) => (
              <SignChip key={s} label={s} value={valueOf(text, s)} onTap={() => onChange(setValue(text, s, nextSign(valueOf(text, s))))} />
            ))}
          </div>
        </>
      )}

      {tab === "gerak" && (
        <div className="flex flex-col gap-2.5">
          {SCALES.map((s) => {
            const cur = valueOf(text, s.label);
            return (
              <div key={s.label} role="group" aria-label={s.label} className="flex flex-col gap-1">
                <span className="text-[12px] font-semibold text-ink-2">{s.label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {s.values.map((v) => {
                    const on = cur?.toLowerCase() === v.toLowerCase();
                    return (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={on}
                        // Tapping the chosen value again clears it.
                        onClick={() => onChange(setValue(text, s.label, on ? null : v))}
                        className={cx(
                          "tnum h-8 rounded-full border px-3 text-[13px] font-semibold transition-colors",
                          on ? "border-jade bg-jade-mist text-jade-deep" : "border-line text-ink-2 hover:border-ink-2/40",
                        )}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "tes" && (
        <>
          <div role="group" aria-label="Area tes" className="flex flex-wrap gap-1">
            {Object.keys(TESTS).map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={shownArea === a}
                onClick={() => setArea(a)}
                className={cx(
                  "h-7 rounded-md px-2.5 text-[12px] font-semibold transition-colors",
                  shownArea === a ? "bg-ink text-white" : "bg-canvas text-ink-2 hover:bg-line-soft",
                )}
              >
                {a}
              </button>
            ))}
          </div>
          {shownArea ? (
            <>
              <p className="text-[12px] text-muted">
                Tes khusus {shownArea.toLowerCase()}
                {!area && testAreaOf(condition) ? ` (sesuai ${condition})` : ""}. Ketuk sekali (+), dua kali (−), tiga kali hapus.
              </p>
              <div role="group" aria-label="Tes khusus" className="flex flex-wrap gap-1.5">
                {TESTS[shownArea].map((s) => (
                  <SignChip key={s} label={s} value={valueOf(text, s)} onTap={() => onChange(setValue(text, s, nextSign(valueOf(text, s))))} />
                ))}
              </div>
            </>
          ) : (
            <p className="text-[12px] text-muted">Pilih area untuk melihat tes khususnya.</p>
          )}
        </>
      )}
    </div>
  );
}
