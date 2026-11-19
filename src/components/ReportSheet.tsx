"use client";

import { useMemo, useRef, useState } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { Button, Field, Input, Sheet, Textarea, cx, errorText, useToast } from "./ui";
import { ReportHistory } from "./ReportHistory";
import { SignatureField } from "./SignatureField";
import { NextVisitField } from "./NextVisitField";
import { FindingsPicker } from "./FindingsPicker";
import { PickTabs } from "./PickTabs";
import { ADVICE, ALL_TREATMENTS, TREATMENT_GROUPS, hasPhrase, togglePhrase } from "@/lib/quickpicks";
import { nextVisitDateFor } from "@/lib/next-visit";
import { useUser } from "@/lib/auth";
import { useCollection, useDoc } from "@/lib/hooks";
import { MAX_REPORT_MB, REPORT_TYPES, daysLate, lateText, removeReportFile, saveReport, uploadReportFile } from "@/lib/reports";
import { dateKey, longDate, shortDate, time } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Booking, ReportFile, ReportOptions, TherapyReport } from "@/lib/types";
import { conditionByName, matchCondition } from "@/lib/conditions";
import { caseOf } from "@/lib/progress";
import { HistoryFields, ProgressFields, type Clinical } from "./ClinicalFields";

type Fields = Pick<TherapyReport, "customerName" | "assessment" | "treatment" | "advice" | "nextVisit" | "nextVisitDate"> & Clinical;

export const fileSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/* One tap adds the phrase, so a report takes a minute instead of a paragraph of typing. */

/** "TENS, Ultrasound": tapping a phrase that is already there takes it out again; typed text is kept as it is. */
const toggleItem = togglePhrase;
const hasItem = hasPhrase;

/** The physio's report after a session: a short write-up, with an optional file. */
export function ReportSheet({
  booking,
  report,
  visitId,
  complaint,
  onClose,
}: {
  booking: Row<Booking> | null;
  report?: Row<TherapyReport> | null;
  visitId?: string | null;
  complaint?: string;
  onClose: () => void;
}) {
  const user = useUser();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<Fields>({ customerName: "" });
  // Which group of Tindakan picks is showing.
  const [tGroup, setTGroup] = useState(TREATMENT_GROUPS[0].name);
  const [file, setFile] = useState<ReportFile | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = booking?.id ?? null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (booking) {
      const said = report?.complaint ?? complaint ?? booking.notes ?? "";
      // A new report: the complaint may already name a case in the library, with its mechanism of injury.
      const known = report ? null : matchCondition(said);
      setF({
        customerName: report?.customerName ?? booking.customerName,
        complaint: said,
        condition: report ? (report.condition ?? null) : (known?.name ?? null),
        anamnesis: report?.anamnesis ?? "",
        mechanism: report ? (report.mechanism ?? "") : (known?.mechanism ?? ""),
        pain: report?.pain ?? null,
        recovery: report?.recovery ?? null,
        progressNote: report?.progressNote ?? "",
        assessment: report?.assessment ?? "",
        treatment: report?.treatment ?? "",
        advice: report?.advice ?? "",
        nextVisit: report?.nextVisit ?? "",
        nextVisitDate: report?.nextVisitDate ?? null,
      });
      setFile(report?.file ?? null);
      setPending(null);
      setError("");
    }
  }

  // The patient's earlier reports (this app's and the report app's): read before writing, copy one as a starting point.
  const { rows: history } = useCollection<TherapyReport>(booking ? "reports" : null, [["customerId", "==", booking?.customerId ?? ""]]);
  const earlier = useMemo(
    () => (history ?? []).filter((r) => r.bookingId !== booking?.id && r.sessionAt < (booking?.startAt ?? 0)).sort((a, b) => b.sessionAt - a.sessionAt),
    [history, booking],
  );
  // Progress is compared within one condition: the latest earlier report of the case being written.
  const lastSame = earlier.find((r) => caseOf(r) === caseOf(f)) ?? null;

  // The physio's own quick-pick phrases, added in the report app.
  const { row: own } = useDoc<ReportOptions>("reportOptions", booking?.staffId);
  const extra = (base: string[], more?: string[]) => [...base, ...(more ?? []).filter((x) => !base.some((b) => b.toLowerCase() === x.toLowerCase()))];

  const set = (k: "assessment" | "treatment" | "advice" | "nextVisit" | "customerName", value: string) => setF((x) => ({ ...x, [k]: value }));
  const setClinical = (patch: Partial<Clinical>) => setF((x) => ({ ...x, ...patch }));
  const text = (k: "assessment" | "treatment" | "advice" | "nextVisit") => ({
    value: f[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => set(k, e.target.value),
  });

  function pick(list: FileList | null) {
    const x = list?.[0];
    if (!x) return;
    if (!REPORT_TYPES.split(",").includes(x.type)) return setError("File harus PDF, JPG, atau PNG.");
    if (x.size > MAX_REPORT_MB * 1024 * 1024) return setError(`Ukuran file maksimal ${MAX_REPORT_MB} MB.`);
    setError("");
    setPending(x);
  }

  function copyFrom(last: TherapyReport) {
    setF((x) => ({
      ...x,
      complaint: x.complaint?.trim() ? x.complaint : (last.complaint ?? ""),
      // The history is usually the same story; progress is measured again each session.
      condition: x.condition ?? last.condition ?? null,
      anamnesis: x.anamnesis?.trim() ? x.anamnesis : (last.anamnesis ?? ""),
      mechanism: last.mechanism?.trim() ? last.mechanism : x.mechanism,
      assessment: last.assessment ?? "",
      treatment: last.treatment ?? "",
      advice: last.advice ?? "",
      nextVisit: last.nextVisit ?? "",
      // "3 hari lagi" from this session, not from the one copied.
      nextVisitDate: booking ? (nextVisitDateFor(last.nextVisit, booking.dateKey) ?? null) : null,
    }));
    toast(`Isi laporan ${shortDate(last.sessionAt)} disalin. Sesuaikan dengan sesi ini.`);
  }

  // Continue a condition treated before: its case, and its complaint and mechanism as written last time.
  function continueCase(condition: string) {
    const last = earlier.find((r) => caseOf(r) === condition);
    const lib = conditionByName(condition);
    setF((x) => {
      const ownMechanism = !!x.mechanism?.trim() && x.mechanism.trim() !== conditionByName(x.condition)?.mechanism;
      // A complaint filled in from the booking or an earlier report is replaced; one the physio wrote stays.
      const said = x.complaint?.trim() ?? "";
      const filled = !said || said === (complaint ?? booking?.notes ?? "").trim() || earlier.some((r) => r.complaint?.trim() === said);
      return {
        ...x,
        condition,
        complaint: filled ? (last?.complaint ?? condition) : x.complaint,
        mechanism: ownMechanism ? x.mechanism : last?.mechanism?.trim() || lib?.mechanism || "",
      };
    });
  }

  async function submit() {
    if (!booking) return;
    setError("");
    if (!f.customerName?.trim()) return setError("Isi nama pasien.");
    if (!pending && !file && !f.treatment?.trim() && !f.assessment?.trim())
      return setError("Isi minimal tindakan atau pemeriksaan, atau lampirkan file laporan.");
    setBusy(true);
    try {
      let next = file;
      if (pending) {
        next = await uploadReportFile(booking.id, pending);
        if (report?.file && report.file.path !== next.path) await removeReportFile(report.file);
      } else if (!file && report?.file) await removeReportFile(report.file);
      await saveReport(booking, f, next, user.email, report, visitId);
      toast(`Laporan ${f.customerName?.trim() || booking.customerName} tersimpan`);
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const shown = pending ? { name: pending.name, size: pending.size } : file;
  const late = booking ? daysLate(booking, dateKey()) : 0;

  return (
    <Sheet
      open={!!booking}
      onClose={onClose}
      wide
      title={report ? "Ubah laporan terapi" : "Laporan terapi"}
      footer={
        <div className="flex flex-col gap-3">
          {error && <p className="text-sm text-danger">{error}</p>}
          {report?.archivedAt && (
            <p className="rounded-lg bg-line-soft px-3 py-2 text-[13px] text-ink-2">
              Laporan ini diarsipkan {shortDate(report.archivedAt)}. Kembalikan dari Arsip untuk mengubahnya.
            </p>
          )}
          <Button size="lg" block loading={busy} disabled={!!report?.archivedAt} onClick={submit}>
            Simpan laporan
          </Button>
        </div>
      }
    >
      {booking && (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl bg-canvas px-4 py-3 text-sm">
            <p className="font-semibold">
              Sesi {longDate(booking.startAt)}, {time(booking.startAt)}
            </p>
            <p className="text-muted">
              {booking.serviceName}, {booking.staffName}
            </p>
            {!report && late > 0 && (
              <p className="mt-1 font-semibold text-amber">Sesi {lateText(booking).toLowerCase()}. Laporan seharusnya dibuat di hari yang sama.</p>
            )}
          </div>

          <Field label="Nama pasien" htmlFor="rp-name" hint="Terisi dari booking. Ubah bila ejaannya perlu diperbaiki.">
            <Input id="rp-name" autoComplete="off" value={f.customerName ?? ""} onChange={(e) => set("customerName", e.target.value)} />
          </Field>

          <ReportHistory reports={earlier} condition={f.condition} onCopy={copyFrom} onContinue={continueCase} />

          <HistoryFields key={openedFor ?? ""} value={f} onChange={setClinical} />
          <Field label="Pemeriksaan / temuan" htmlFor="rp-a">
            <FindingsPicker value={f.assessment} onChange={(t) => set("assessment", t)} condition={f.condition} />
            <Textarea id="rp-a" className="min-h-16" placeholder="Ketuk pilihan di atas, atau tulis sendiri, mis. ROM fleksi bahu 120°, nyeri tekan m. trapezius" {...text("assessment")} />
          </Field>
          <Field label="Tindakan yang diberikan" htmlFor="rp-t">
            <PickTabs
              label="Kelompok tindakan"
              active={tGroup}
              onChange={setTGroup}
              tabs={TREATMENT_GROUPS.map((g) => ({ id: g.name, name: g.name, count: g.items.filter((x) => hasItem(f.treatment, x)).length }))}
            />
            <Chips
              items={extra(TREATMENT_GROUPS.find((g) => g.name === tGroup)?.items ?? [], (own?.treatments ?? []).filter((x) => !ALL_TREATMENTS.some((t) => t.toLowerCase() === x.toLowerCase())))}
              value={f.treatment}
              onPick={(x) => set("treatment", toggleItem(f.treatment, x))}
              label="Tindakan"
            />
            <Textarea id="rp-t" className="min-h-16" placeholder="Ketuk pilihan di atas, atau tulis sendiri: dosis, durasi, area" {...text("treatment")} />
          </Field>
          <Field label="Saran & latihan di rumah" htmlFor="rp-s">
            <Chips items={extra(ADVICE, own?.advice)} value={f.advice} onPick={(x) => set("advice", toggleItem(f.advice, x))} label="Saran" />
            <Textarea id="rp-s" className="min-h-16" {...text("advice")} />
          </Field>
          <ProgressFields value={f} onChange={setClinical} last={lastSame} otherCases={earlier.length > 0 && !lastSame} isNew={!report} />
          <NextVisitField value={f} onChange={(p) => setF((x) => ({ ...x, ...p }))} sessionDay={booking.dateKey} />

          <Field label="File laporan (opsional)" hint={`PDF, JPG, atau PNG, maks ${MAX_REPORT_MB} MB. Tanpa file, sistem membuat PDF dari isian di atas.`}>
            <input ref={input} type="file" accept={REPORT_TYPES} className="hidden" onChange={(e) => pick(e.target.files)} />
            {shown ? (
              <div className="flex items-center gap-3 rounded-xl border border-jade/40 bg-jade-mist/40 px-3.5 py-2.5">
                <FileText className="size-5 shrink-0 text-jade" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{shown.name}</span>
                  <span className="text-[12px] text-muted">
                    {fileSize(shown.size)}
                    {pending ? ", siap diunggah" : ""}
                  </span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => input.current?.click()}>
                  Ganti
                </Button>
                <button
                  type="button"
                  aria-label="Hapus file"
                  onClick={() => (pending ? setPending(null) : setFile(null))}
                  className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-danger-mist hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  pick(e.dataTransfer.files);
                }}
                className="flex h-11 items-center gap-2 rounded-xl border border-dashed border-line px-3.5 text-left text-sm font-semibold text-ink-2 transition-colors hover:border-jade/50"
              >
                <Paperclip className="size-4 text-jade" />
                Lampirkan PDF atau foto laporan
              </button>
            )}
          </Field>

          {/* The physio's signature, set once and used on every report they sign. Theirs to change, or the desk's. */}
          <SignatureField
            staffId={booking.staffId}
            staffName={booking.staffName}
            editable={user.staffId === booking.staffId || user.role === "admin" || user.role === "manager"}
          />
        </div>
      )}
    </Sheet>
  );
}

function Chips({ items, value, onPick, label }: { items: string[]; value?: string; onPick: (item: string) => void; label: string }) {
  return (
    <div role="group" aria-label={`Pilihan cepat: ${label}`} className="flex flex-wrap gap-1.5">
      {items.map((x) => {
        const on = hasItem(value, x);
        return (
          <button
            key={x}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(x)}
            className={cx(
              "h-8 rounded-full border px-3 text-[13px] font-semibold transition-colors",
              on ? "border-jade bg-jade-mist text-jade-deep" : "border-line text-ink-2 hover:border-ink-2/40",
            )}
          >
            {x}
          </button>
        );
      })}
    </div>
  );
}
