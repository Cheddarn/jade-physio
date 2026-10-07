"use client";

import { useRef, useState } from "react";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { Button, Field, Sheet, Textarea, cx, errorText, useToast } from "./ui";
import { useUser } from "@/lib/auth";
import { MAX_REPORT_MB, REPORT_TYPES, removeReportFile, saveReport, uploadReportFile } from "@/lib/reports";
import { longDate, time } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Booking, ReportFile, TherapyReport } from "@/lib/types";

type Fields = Pick<TherapyReport, "complaint" | "assessment" | "treatment" | "advice" | "nextVisit">;

export const fileSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** The physio's report after a session: short write-up plus the PDF they made. */
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
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    }
  }
  const text = (k: keyof Fields) => ({
    value: f[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value })),
  });

  function pick(list: FileList | null) {
    const x = list?.[0];
    if (!x) return;
    if (!REPORT_TYPES.split(",").includes(x.type)) return setError("File harus PDF, JPG, atau PNG.");
    if (x.size > MAX_REPORT_MB * 1024 * 1024) return setError(`Ukuran file maksimal ${MAX_REPORT_MB} MB.`);
    setError("");
    setPending(x);
  }

  async function submit() {
    if (!booking) return;
    setError("");
    if (!pending && !file && !f.treatment?.trim() && !f.assessment?.trim())
      return setError("Lampirkan file laporan, atau isi minimal pemeriksaan / tindakan.");
    setBusy(true);
    try {
      let next = file;
      if (pending) {
        next = await uploadReportFile(booking.id, pending);
        if (report?.file && report.file.path !== next.path) await removeReportFile(report.file);
      } else if (!file && report?.file) await removeReportFile(report.file);
      await saveReport(booking, f, next, user.email, report, visitId);
      toast(`Laporan ${booking.customerName} terkirim ke sistem`);
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const shown = pending ? { name: pending.name, size: pending.size } : file;

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
            {report ? "Simpan laporan" : "Kirim laporan"}
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
          </div>

          <Field label="File laporan (PDF, JPG, PNG)" hint={`Maks ${MAX_REPORT_MB} MB. Tanpa file, sistem membuat PDF dari isian di bawah.`}>
            <input ref={input} type="file" accept={REPORT_TYPES} className="hidden" onChange={(e) => pick(e.target.files)} />
            {shown ? (
              <div className="flex items-center gap-3 rounded-xl border border-jade/40 bg-jade-mist/40 px-3.5 py-3">
                <FileText className="size-5 shrink-0 text-jade" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{shown.name}</span>
                  <span className="text-[12px] text-muted">{fileSize(shown.size)}{pending ? ", siap diunggah" : ""}</span>
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
                onDragOver={(e) => (e.preventDefault(), setDragging(true))}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pick(e.dataTransfer.files);
                }}
                className={cx(
                  "flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
                  dragging ? "border-jade bg-jade-mist/50" : "border-line hover:border-jade/50",
                )}
              >
                <Upload className="size-5 text-jade" />
                <span className="text-sm font-semibold">Pilih atau seret file laporan ke sini</span>
                <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                  <Paperclip className="size-3" />
                  PDF dari aplikasi atau foto laporan tulisan tangan
                </span>
              </button>
            )}
          </Field>

          <Field label="Keluhan" htmlFor="rp-c">
            <Textarea id="rp-c" className="min-h-16" {...text("complaint")} />
          </Field>
          <Field label="Pemeriksaan / temuan" htmlFor="rp-a">
            <Textarea id="rp-a" placeholder="mis. ROM bahu kanan terbatas 120°, nyeri tekan m. trapezius" {...text("assessment")} />
          </Field>
          <Field label="Tindakan yang diberikan" htmlFor="rp-t">
            <Textarea id="rp-t" placeholder="mis. TENS 15 menit, manual terapi, stretching" {...text("treatment")} />
          </Field>
          <Field label="Saran & latihan di rumah" htmlFor="rp-s">
            <Textarea id="rp-s" placeholder="mis. Kompres hangat 2x sehari, latihan pendulum 3x10" {...text("advice")} />
          </Field>
          <Field label="Rencana kunjungan berikutnya" htmlFor="rp-n">
            <Textarea id="rp-n" className="min-h-14" placeholder="mis. 3 hari lagi, evaluasi ROM" {...text("nextVisit")} />
          </Field>
        </div>
      )}
    </Sheet>
  );
}
