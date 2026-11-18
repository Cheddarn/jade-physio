"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Button, Empty, Spinner } from "@/components/ui";
import { useCollection, useDoc } from "@/lib/hooks";
import { RecoveryProgress } from "@/components/RecoveryChart";
import { hasProgress, progressText } from "@/lib/progress";
import { BUSINESS, longDate, time } from "@/lib/format";
import type { Customer, TherapyReport } from "@/lib/types";
import { ageFrom } from "@/lib/flow";
import { toBlobUrl } from "@/lib/reports";

/** Printable therapy report. "Cetak / simpan PDF" makes the PDF when the physio didn't upload one. */
export default function ReportPrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { row: r, loading } = useDoc<TherapyReport>("reports", id);
  const { row: c } = useDoc<Customer>("customers", r?.customerId);
  // The patient's other sessions, for the recovery progression (a typed name: its reports without a patient on file).
  const { rows: history } = useCollection<TherapyReport>(
    r ? "reports" : null,
    r?.customerId ? [["customerId", "==", r.customerId]] : [["customerName", "==", r?.customerName ?? ""]],
  );
  const [fileUrl, setFileUrl] = useState<string | null>(null);
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
  const age = ageFrom(c?.profile?.birthDate);
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

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-16 md:px-8 md:pt-8 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 16mm; } }`}</style>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => router.back()} className="-ml-2 flex h-10 items-center gap-1.5 rounded-[10px] px-2 text-sm font-semibold text-ink-2 hover:bg-line-soft">
          <ArrowLeft className="size-4" />
          Laporan terapi
        </button>
        <div className="ml-auto flex gap-2">
          {r.file && (
            <a href={fileUrl ?? r.file.url} download={r.file.name} target="_blank" rel="noreferrer">
              <Button variant="secondary" icon={<Download className="size-4" />}>
                Unduh file asli
              </Button>
            </a>
          )}
          <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
            Cetak / simpan PDF
          </Button>
        </div>
      </div>

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

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
          <dt className="text-muted">Pasien</dt>
          <dd className="font-semibold">{r.customerName}</dd>
          <dt className="text-muted">No. RM</dt>
          <dd>{c?.profile?.medicalRecordNo ?? "-"}</dd>
          <dt className="text-muted">Usia</dt>
          <dd>{age != null ? `${age} tahun` : "-"}</dd>
          <dt className="text-muted">Tanggal</dt>
          <dd>
            {longDate(r.sessionAt)}, {time(r.sessionAt)}
          </dd>
          <dt className="text-muted">Layanan</dt>
          <dd>{r.serviceName}</dd>
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
              <RecoveryProgress className="mt-3" reports={sessions} upTo={r.sessionAt} current={r.sessionAt} />
            </section>
          )}
          {r.nextVisit?.trim() && (
            <section>
              <h2 className="text-[13px] font-bold tracking-wide text-jade-deep uppercase">Rencana kunjungan berikutnya</h2>
              <p className="mt-1 text-[15px] whitespace-pre-line">{r.nextVisit}</p>
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

        <footer className="mt-12 flex justify-end text-center text-sm">
          <div>
            <p className="text-muted">Fisioterapis</p>
            <p className="mt-14 border-t border-ink/40 pt-1 font-semibold">{r.staffName}</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
