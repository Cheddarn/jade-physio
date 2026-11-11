"use client";

import { useMemo, useRef, useState } from "react";
import { Copy, FileText, History, Paperclip, Trash2 } from "lucide-react";
import { Button, Field, Sheet, Textarea, cx, errorText, useToast } from "./ui";
import { useUser } from "@/lib/auth";
import { useCollection } from "@/lib/hooks";
import { MAX_REPORT_MB, REPORT_TYPES, daysLate, lateText, removeReportFile, saveReport, uploadReportFile } from "@/lib/reports";
import { dateKey, longDate, shortDate, time } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Booking, ReportFile, TherapyReport } from "@/lib/types";

type Fields = Pick<TherapyReport, "complaint" | "assessment" | "treatment" | "advice" | "nextVisit">;

export const fileSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/* One tap adds the phrase, so a report takes a minute instead of a paragraph of typing. */
const TREATMENTS = ["TENS", "Ultrasound", "Infrared", "Manual terapi", "Mobilisasi sendi", "Stretching", "Exercise terapi", "Penguatan otot", "Dry needling", "Kinesio taping", "Traksi", "Massage"];
const ADVICE = ["Kompres hangat 2x sehari 15 menit", "Kompres es 10 menit bila nyeri", "Latihan peregangan pagi dan sore", "Hindari angkat beban berat", "Perbaiki posisi duduk", "Istirahat cukup"];
const NEXT = ["2 hari lagi", "3 hari lagi", "1 minggu lagi", "2 minggu lagi", "Tidak perlu kontrol"];

/** "TENS, Ultrasound": tapping a phrase that is already there takes it out again. */
function toggleItem(text: string | undefined, item: string) {
  const parts = (text ?? "").split(/,\s*|\n/).map((x) => x.trim()).filter(Boolean);
  const has = parts.some((p) => p.toLowerCase() === item.toLowerCase());
  return (has ? parts.filter((p) => p.toLowerCase() !== item.toLowerCase()) : [...parts, item]).join(", ");
}
const hasItem = (text: string | undefined, item: string) =>
  (text ?? "").split(/,\s*|\n/).some((p) => p.trim().toLowerCase() === item.toLowerCase());

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
  const [f, setF] = useState<Fields>({});
  const [file, setFile] = useState<ReportFile | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showLast, setShowLast] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = booking?.id ?? null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (booking) {
      setF({
        complaint: report?.complaint ?? complaint ?? booking.notes ?? "",
        assessment: report?.assessment ?? "",
        treatment: report?.treatment ?? "",
        advice: report?.advice ?? "",
        nextVisit: report?.nextVisit ?? "",
      });
      setFile(report?.file ?? null);
      setPending(null);
      setError("");
      setShowLast(false);
    }
  }

  // The same patient's last report: what was done then, and a starting point for today's.
  const { rows: history } = useCollection<TherapyReport>(booking ? "reports" : null, [["customerId", "==", booking?.customerId ?? ""]]);
  const last = useMemo(
    () =>
      (history ?? [])
        .filter((r) => r.bookingId !== booking?.id && r.sessionAt < (booking?.startAt ?? 0))
        .sort((a, b) => b.sessionAt - a.sessionAt)[0] ?? null,
    [history, booking],
  );

  const set = (k: keyof Fields, value: string) => setF((x) => ({ ...x, [k]: value }));
  const text = (k: keyof Fields) => ({
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

  function copyLast() {
    if (!last) return;
    setF((x) => ({
      complaint: x.complaint?.trim() ? x.complaint : (last.complaint ?? ""),
      assessment: last.assessment ?? "",
      treatment: last.treatment ?? "",
      advice: last.advice ?? "",
      nextVisit: last.nextVisit ?? "",
    }));
    toast("Isi laporan terakhir disalin. Sesuaikan dengan sesi ini.");
  }

  async function submit() {
    if (!booking) return;
    setError("");
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
      toast(`Laporan ${booking.customerName} tersimpan`);
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
          <Button size="lg" block loading={busy} onClick={submit}>
            Simpan laporan
          </Button>
        </div>
      }
    >
      {booking && (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl bg-canvas px-4 py-3 text-sm">
            <p className="font-bold">{booking.customerName}</p>
            <p className="text-muted">
              {longDate(booking.startAt)}, {time(booking.startAt)}, {booking.serviceName}, {booking.staffName}
            </p>
            {!report && late > 0 && (
              <p className="mt-1 font-semibold text-amber">Sesi {lateText(booking).toLowerCase()}. Laporan seharusnya dibuat di hari yang sama.</p>
            )}
          </div>

          {last && !report && (
            <div className="rounded-xl border border-line">
              <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
                <History className="size-4 shrink-0 text-jade" />
                <button type="button" onClick={() => setShowLast((x) => !x)} aria-expanded={showLast} className="min-w-0 flex-1 text-left text-sm">
                  <span className="font-semibold">Laporan terakhir</span>
                  <span className="block truncate text-[12px] text-muted">
                    {shortDate(last.sessionAt)}, {last.staffName}. {showLast ? "Sembunyikan" : "Lihat"}
                  </span>
                </button>
                <Button size="sm" variant="secondary" icon={<Copy className="size-3.5" />} onClick={copyLast}>
                  Salin isinya
                </Button>
              </div>
              {showLast && (
                <dl className="grid gap-2 border-t border-line-soft px-3.5 py-3 text-[13px]">
                  {(
                    [
                      ["Pemeriksaan", last.assessment],
                      ["Tindakan", last.treatment],
                      ["Saran", last.advice],
                      ["Rencana", last.nextVisit],
                    ] as const
                  )
                    .filter(([, v]) => v?.trim())
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="font-semibold text-ink-2">{k}</dt>
                        <dd className="whitespace-pre-line text-muted">{v}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </div>
          )}

          <Field label="Keluhan" htmlFor="rp-c">
            <Textarea id="rp-c" className="min-h-14" {...text("complaint")} />
          </Field>
          <Field label="Pemeriksaan / temuan" htmlFor="rp-a">
            <Textarea id="rp-a" className="min-h-16" placeholder="mis. ROM bahu kanan terbatas 120°, nyeri tekan m. trapezius" {...text("assessment")} />
          </Field>
          <Field label="Tindakan yang diberikan" htmlFor="rp-t">
            <Chips items={TREATMENTS} value={f.treatment} onPick={(x) => set("treatment", toggleItem(f.treatment, x))} label="Tindakan" />
            <Textarea id="rp-t" className="min-h-16" placeholder="Ketuk pilihan di atas, atau tulis sendiri: dosis, durasi, area" {...text("treatment")} />
          </Field>
          <Field label="Saran & latihan di rumah" htmlFor="rp-s">
            <Chips items={ADVICE} value={f.advice} onPick={(x) => set("advice", toggleItem(f.advice, x))} label="Saran" />
            <Textarea id="rp-s" className="min-h-16" {...text("advice")} />
          </Field>
          <Field label="Rencana kunjungan berikutnya" htmlFor="rp-n">
            <Chips items={NEXT} value={f.nextVisit} onPick={(x) => set("nextVisit", hasItem(f.nextVisit, x) ? "" : x)} label="Kunjungan berikutnya" />
            <Textarea id="rp-n" className="min-h-12" placeholder="mis. 3 hari lagi, evaluasi ROM" {...text("nextVisit")} />
          </Field>

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
