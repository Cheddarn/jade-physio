"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Archive, ArrowLeft, Download, FileDown, PenLine, Printer } from "lucide-react";
import { Button, Empty, Sheet, Spinner, useToast } from "@/components/ui";
import { SignatureField } from "@/components/SignatureField";
import { useUser } from "@/lib/auth";
import { useCollection, useDoc } from "@/lib/hooks";
import { RecoveryProgress } from "@/components/RecoveryChart";
import { hasProgress, measuresOf, progressText } from "@/lib/progress";
import { BUSINESS, longDate, shortDate, time } from "@/lib/format";
import type { ReportOptions, TherapyReport } from "@/lib/types";
import { toBlobUrl } from "@/lib/reports";

/** The therapy report: "Unduh PDF" saves it as a PDF file to send or keep, "Cetak" prints it. */
export default function ReportPrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const [making, setMaking] = useState(false);
  const { row: r, loading } = useDoc<TherapyReport>("reports", id);
  // The patient's other sessions, for the recovery progression (a typed name: its reports without a patient on file).
  const { rows: history } = useCollection<TherapyReport>(
    r ? "reports" : null,
    r?.customerId ? [["customerId", "==", r.customerId]] : [["customerName", "==", r?.customerName ?? ""]],
  );
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  // The physio's signature, uploaded once in the report form.
  const { row: opts } = useDoc<ReportOptions>("reportOptions", r?.staffId || null);
  const signature = opts?.signature ?? null;
  const [signing, setSigning] = useState(false);
  useEffect(() => {
    if (!r?.file?.url) return setFileUrl(null);
    const u = toBlobUrl(r.file.url);
    setFileUrl(u);
    return () => {
      if (u.startsWith("blob:")) URL.revokeObjectURL(u);
    };
  }, [r?.file?.url]);
  if (loading) return <Spinner />;
  if (!r)
    return (
      <Empty
        title="Laporan tidak ditemukan"
        action={
          <Link href="/laporan-terapi">
            <Button variant="secondary">Kembali</Button>
          </Link>
        }
      />
    );
  const sections: [string, string | undefined][] = [
    ["Keluhan", r.complaint],
    ["Anamnesis", r.anamnesis],
    ["Mekanisme cedera", r.mechanism],
    ["Pemeriksaan / temuan", r.assessment],
    ["Tindakan yang diberikan", r.treatment],
    ["Saran & latihan di rumah", r.advice],
  ];
  const sessions = (history ?? []).filter((x) => (r.customerId ? true : !x.customerId));
  const isPdf = r.file?.type === "application/pdf";

  // The desk, or the physio themself, can add or change the signature from here.
  const canSign = user.role === "admin" || user.role === "manager" || (!!user.staffId && user.staffId === r.staffId);

  async function makePdf() {
    setMaking(true);
    try {
      // The PDF maker is only loaded when asked for.
      const { downloadReportPdf } = await import("@/lib/report-pdf");
      await downloadReportPdf(r!, sessions, signature);
    } catch (e) {
      console.error(e);
      toast("PDF gagal dibuat. Coba lagi, atau pakai Cetak lalu pilih Simpan sebagai PDF.", "error");
    } finally {
      setMaking(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-16 md:px-8 md:pt-8 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 16mm; } }`}</style>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => router.back()} className="-ml-2 flex h-10 items-center gap-1.5 rounded-[10px] px-2 text-sm font-semibold text-ink-2 hover:bg-line-soft">
          <ArrowLeft className="size-4" />
          Laporan terapi
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          {r.file && (
            <a href={fileUrl ?? r.file.url} download={r.file.name} target="_blank" rel="noreferrer">
              <Button variant="secondary" icon={<Download className="size-4" />}>
                Unduh file asli
              </Button>
            </a>
          )}
          <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
            Cetak
          </Button>
          <Button icon={<FileDown className="size-4" />} loading={making} onClick={makePdf}>
            Unduh PDF
          </Button>
        </div>
      </div>

      {r.archivedAt && (
        <p className="no-print mb-3 flex items-center gap-2 rounded-xl bg-line-soft px-4 py-2.5 text-sm text-ink-2">
          <Archive className="size-4 shrink-0" />
          Diarsipkan {shortDate(r.archivedAt)}. Laporan ini tidak bisa diubah sampai dikembalikan dari Arsip.
        </p>
      )}
      <article className="print-plain rounded-2xl border border-line bg-surface p-6 md:p-10">
        {/* Phones: the title goes under the clinic's details; wider screens and paper: side by side. */}
        <header className="flex flex-col gap-3 border-b-2 border-jade-deep pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 print:flex-row print:items-center print:justify-between print:gap-4">
          {/* The logo is centred on the name and address beside it, however many lines the address wraps to. */}
          <div className="flex min-w-0 items-center gap-3.5">
            {/* The clinic's logo; an <img> so it prints even with "background graphics" off. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" width={56} height={56} alt="Logo Jade Physio" className="size-14 shrink-0 rounded-lg" />
            <div className="min-w-0">
              <p className="text-xl leading-tight font-bold text-jade-deep">{BUSINESS.name}</p>
              {BUSINESS.address && <p className="mt-0.5 text-[13px] leading-snug text-muted">{BUSINESS.address}</p>}
              {BUSINESS.phone && <p className="text-[13px] text-muted">{BUSINESS.phone}</p>}
            </div>
          </div>
          <p className="shrink-0 text-sm font-bold tracking-wide uppercase sm:text-right print:text-right">Laporan fisioterapi</p>
        </header>

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-base sm:grid-cols-[auto_1fr_auto_1fr] md:text-[17px]">
          <dt className="text-muted">Pasien</dt>
          <dd className="font-semibold">{r.customerName}</dd>
          <dt className="text-muted">Tanggal</dt>
          {/* On one line where there is room: the name beside it is shorter. */}
          <dd className="md:whitespace-nowrap print:whitespace-nowrap">
            {longDate(r.sessionAt)}, {time(r.sessionAt)}
          </dd>
          <dt className="text-muted">Fisioterapis</dt>
          <dd>{r.staffName}</dd>
          {r.condition && (
            <>
              <dt className="text-muted">Kondisi</dt>
              <dd className="font-semibold">{r.condition}</dd>
            </>
          )}
        </dl>

        <div className="mt-6 flex flex-col gap-5">
          {sections
            .filter(([, v]) => v?.trim())
            .map(([k, v]) => (
              <section key={k}>
                <h2 className="text-[13px] font-bold tracking-wide text-jade-deep uppercase">{k}</h2>
                <p className="mt-1 text-[15px] whitespace-pre-line">{v}</p>
              </section>
            ))}
          {(hasProgress(r) || r.progressNote?.trim()) && (
            <section className="break-inside-avoid">
              <h2 className="text-[13px] font-bold tracking-wide text-jade-deep uppercase">Progres pemulihan</h2>
              {hasProgress(r) && <p className="mt-1 text-[15px]">{progressText(r).replace(/^./, (x) => x.toUpperCase())}</p>}
              {r.progressNote?.trim() && <p className="mt-1 text-[15px] whitespace-pre-line">{r.progressNote}</p>}
              <RecoveryProgress className="mt-3" reports={sessions} condition={r.condition} upTo={r.sessionAt} current={r.sessionAt} measures={measuresOf(r)} />
            </section>
          )}
          {(r.nextVisit?.trim() || r.nextVisitDate) && (
            <section>
              <h2 className="text-[13px] font-bold tracking-wide text-jade-deep uppercase">Rencana kunjungan berikutnya</h2>
              {r.nextVisitDate && <p className="mt-1 text-[15px] font-semibold">{longDate(r.nextVisitDate)}</p>}
              {r.nextVisit?.trim() && <p className="mt-1 text-[15px] whitespace-pre-line">{r.nextVisit}</p>}
            </section>
          )}
        </div>

        {r.file && (
          <div className="mt-8 border-t border-line-soft pt-4">
            <p className="no-print mb-3 text-[13px] text-muted">Lampiran dari fisioterapis: {r.file.name}</p>
            {isPdf ? (
              <iframe src={fileUrl ?? undefined} title="Lampiran laporan" className="no-print h-[70vh] w-full rounded-xl border border-line" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl ?? r.file.url} alt="Lampiran laporan" className="max-h-[80vh] w-full rounded-xl border border-line object-contain" />
            )}
          </div>
        )}

        <footer className="mt-12 flex justify-end text-center text-sm break-inside-avoid">
          <div className="flex w-56 flex-col items-center">
            <p className="text-muted">Fisioterapis</p>
            {signature ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signature} alt={`Tanda tangan ${r.staffName}`} className="mt-2 h-16 max-w-full object-contain" />
            ) : canSign ? (
              // On screen only: add it here, it shows at once and on every report this physio signs.
              <button
                type="button"
                onClick={() => setSigning(true)}
                className="no-print mt-2 flex h-14 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-jade/60 text-[13px] font-semibold text-jade hover:bg-jade-mist/40"
              >
                <PenLine className="size-4" />
                Tambah tanda tangan
              </button>
            ) : (
              <div className="h-14" />
            )}
            <p className="mt-1 w-full border-t border-ink/40 pt-1 font-semibold">{r.staffName}</p>
            {signature && canSign && (
              <button type="button" onClick={() => setSigning(true)} className="no-print mt-1 text-[12px] font-semibold text-muted hover:text-jade">
                Ganti tanda tangan
              </button>
            )}
          </div>
        </footer>
      </article>
      {canSign && (
        <Sheet open={signing} onClose={() => setSigning(false)} title="Tanda tangan fisioterapis">
          <SignatureField staffId={r.staffId} staffName={r.staffName} editable />
        </Sheet>
      )}
    </div>
  );
}
