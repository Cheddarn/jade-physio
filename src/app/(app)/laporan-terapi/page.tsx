"use client";

import { Pager, usePager } from "@/components/Pager";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardCopy, Download, FileText, MessageCircle, Pencil, Printer, Send } from "lucide-react";
import { Badge, Button, Card, Empty, IconButton, Segmented, Spinner, Switch, errorText, useToast } from "@/components/ui";
import { ReportSheet, fileSize } from "@/components/ReportSheet";
import { DatePicker } from "@/components/DatePicker";
import { waLink } from "@/components/CustomerPicker";
import { useCan, useUser } from "@/lib/auth";
import { useCollection } from "@/lib/hooks";
import { STATUS_LABEL, addDays, dateKey, fromDateKey, shortDate, staffColor, time } from "@/lib/format";
import { useStaff } from "@/lib/hooks";
import { dayListText, markReportSent, reportMessage, reportOwed, reportWritable, toBlobUrl } from "@/lib/reports";
import { useSettings } from "@/lib/settings";
import type { Row } from "@/lib/store";
import type { Booking, TherapyReport, Visit } from "@/lib/types";

type Show = "semua" | "belum" | "sudah" | "kirim";

export default function LaporanTerapiPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Reports />
    </Suspense>
  );
}

function Reports() {
  const params = useSearchParams();
  const user = useUser();
  const can = useCan();
  const toast = useToast();
  const { staff } = useStaff(true);
  const { settings } = useSettings();
  const [day, setDay] = useState(params.get("date") ?? dateKey());
  const [show, setShow] = useState<Show>("semua");
  const [withPhone, setWithPhone] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const today = dateKey();
  const therapist = user.role === "therapist";
  const desk = can("bookings.manage");
  const { rows: bookingRows, loading } = useCollection<Booking>("bookings", [["dateKey", "==", day]]);
  const { rows: reportRows } = useCollection<TherapyReport>("reports", [["dateKey", "==", day]]);
  const { rows: visitRows } = useCollection<Visit>("visits", [["dateKey", "==", day]]);

  // Opened from a "Buat laporan" button elsewhere.
  const wanted = params.get("booking");
  useEffect(() => {
    if (wanted) setEditing(wanted);
  }, [wanted]);

  const reports = useMemo(() => new Map((reportRows ?? []).map((r) => [r.bookingId, r])), [reportRows]);
  const visitOf = useMemo(() => new Map((visitRows ?? []).filter((v) => v.bookingId).map((v) => [v.bookingId!, v])), [visitRows]);
  const all = useMemo(
    () =>
      (bookingRows ?? [])
        .filter((b) => b.status !== "cancelled")
        .filter((b) => !therapist || !user.staffId || b.staffId === user.staffId)
        .sort((a, b) => a.startAt - b.startAt),
    [bookingRows, therapist, user.staffId],
  );
  const finished = useMemo(() => new Set((visitRows ?? []).filter((v) => v.stage === "finished" && v.bookingId).map((v) => v.bookingId!)), [visitRows]);
  const due = (b: Row<Booking>) => reportOwed(b, finished, b.id);
  const writable = (b: Row<Booking>) => reportWritable(b, finished, b.id);
  const list = all.filter((b) => {
    const r = reports.get(b.id);
    if (show === "belum") return due(b) && !r;
    if (show === "sudah") return !!r;
    if (show === "kirim") return !!r && !r.sentAt;
    return true;
  });
  const pager = usePager(list, "laporan-terapi", 25);
  const dueCount = all.filter(due).length;
  const doneCount = all.filter((b) => reports.has(b.id)).length;
  const editingBooking = all.find((b) => b.id === editing) ?? (bookingRows ?? []).find((b) => b.id === editing) ?? null;

  async function copyList() {
    const text = dayListText(
      day,
      all.map((b) => ({ b, report: reports.get(b.id) })),
      { phone: withPhone, status: STATUS_LABEL },
    );
    try {
      await navigator.clipboard.writeText(text);
      toast(`Daftar ${all.length} pasien disalin`);
    } catch {
      // Older browsers: show it so it can be copied by hand.
      window.prompt("Salin daftar pasien:", text);
    }
  }

  async function send(r: Row<TherapyReport>) {
    const url = waLink(r.customerPhone, reportMessage(r, settings));
    if (!url) return toast("Nomor WhatsApp pasien tidak ada", "error");
    window.open(url, "_blank", "noopener");
    try {
      await markReportSent(r.id, user.email);
    } catch (e) {
      toast(errorText(e), "error");
    }
  }

  const dateLabel = fromDateKey(day).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const shortLabel = fromDateKey(day).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="mx-auto max-w-5xl px-4 pt-5 pb-16 md:px-8 md:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] leading-tight font-bold tracking-[-0.01em] md:text-[26px]">Laporan terapi</h1>
          <p className="mt-1 text-sm text-muted">
            {therapist ? "Wajib dibuat untuk setiap pasien setelah sesi selesai." : "Laporan fisioterapis untuk dikirim ke pasien."}
          </p>
        </div>
        {desk && (
          <div className="flex flex-wrap items-center gap-3">
            <Switch checked={withPhone} onChange={setWithPhone} label="Dengan no. HP" />
            <Button icon={<ClipboardCopy className="size-4" />} onClick={copyList} disabled={all.length === 0}>
              Salin daftar pasien
            </Button>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <IconButton label="Hari sebelumnya" onClick={() => setDay(addDays(day, -1))}>
          <ChevronLeft className="size-5" />
        </IconButton>
        <DatePicker value={day} onChange={setDay}>
          <span className="flex items-center gap-1.5 font-bold">
            <span className="md:hidden">{day === today ? `Hari ini, ${shortLabel}` : shortLabel}</span>
            <span className="hidden md:inline">{day === today ? `Hari ini, ${dateLabel}` : dateLabel}</span>
            <CalendarDays className="size-4 text-jade" />
          </span>
        </DatePicker>
        <IconButton label="Hari berikutnya" onClick={() => setDay(addDays(day, 1))}>
          <ChevronRight className="size-5" />
        </IconButton>
        <span className="ml-auto flex gap-2 text-[13px]">
          <Badge tone={doneCount >= dueCount ? "jade" : "amber"}>
            {doneCount}/{dueCount} laporan
          </Badge>
        </span>
      </div>

      <Segmented
        className="mt-4 w-full md:w-auto"
        value={show}
        onChange={setShow}
        options={[
          {
            value: "semua",
            label: (
              <>
                Semua<span className="hidden sm:inline"> ({all.length})</span>
              </>
            ),
          },
          { value: "belum", label: `Belum ada (${all.filter((b) => due(b) && !reports.has(b.id)).length})` },
          { value: "sudah", label: "Sudah ada" },
          ...(desk ? [{ value: "kirim" as const, label: "Belum kirim" }] : []),
        ]}
      />

      <div className="mt-4">
        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Card>
            <Empty icon={<FileText className="size-5" />} title={all.length ? "Tidak ada di filter ini" : "Belum ada sesi di hari ini"} />
          </Card>
        ) : (
          <Card className="divide-y divide-line-soft">
            {pager.shown.map((b) => {
              const r = reports.get(b.id);
              const c = staffColor(staff.find((s) => s.id === b.staffId)?.color);
              const mine = therapist ? b.staffId === user.staffId : can("reports.write");
              const late = due(b) && !r;
              return (
                <div key={b.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="tnum w-12 shrink-0 text-sm font-bold">{time(b.startAt)}</div>
                    <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: c.dot }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{b.customerName}</p>
                      <p className="truncate text-[13px] text-muted">
                        {b.serviceName}, {b.staffName}
                        {b.status === "in_session" && !due(b) ? ", sedang sesi" : !writable(b) ? ", belum sesi" : ""}
                      </p>
                      {r && (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px]">
                          <span className="font-semibold text-jade-deep">
                            <Check className="mr-0.5 inline size-3" />
                            Laporan {time(r.updatedAt)}
                          </span>
                          {r.file && <span className="text-muted">{r.file.name.slice(0, 32)} ({fileSize(r.file.size)})</span>}
                          {r.sentAt && <span className="text-muted">dikirim {time(r.sentAt)}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pl-[4.75rem] empty:hidden md:pl-0">
                    {late && <Badge tone="amber">Belum ada laporan</Badge>}
                    {mine && writable(b) && (
                      <Button size="sm" variant={r || !due(b) ? "ghost" : "primary"} icon={r ? <Pencil className="size-3.5" /> : <FileText className="size-3.5" />} onClick={() => setEditing(b.id)}>
                        {r ? "Ubah" : "Buat laporan"}
                      </Button>
                    )}
                    {r?.file && (
                      <a
                        href={r.file.url.startsWith("data:") ? undefined : r.file.url}
                        onClick={(e) => {
                          // Demo files are data: URLs; hand the browser a blob so it downloads.
                          if (!r.file!.url.startsWith("data:")) return;
                          e.preventDefault();
                          const a = document.createElement("a");
                          a.href = toBlobUrl(r.file!.url);
                          a.download = r.file!.name;
                          a.click();
                        }}
                        download={r.file.name}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button size="sm" variant="secondary" icon={<Download className="size-3.5" />}>
                          Unduh
                        </Button>
                      </a>
                    )}
                    {r && (
                      <Link href={`/laporan-terapi/${r.id}`}>
                        <Button size="sm" variant="secondary" icon={<Printer className="size-3.5" />}>
                          {r.file ? "Lihat" : "PDF"}
                        </Button>
                      </Link>
                    )}
                    {r && desk && (
                      <Button
                        size="sm"
                        variant={r.sentAt ? "ghost" : "primary"}
                        icon={r.sentAt ? <Send className="size-3.5" /> : <MessageCircle className="size-3.5" />}
                        onClick={() => send(r as Row<TherapyReport>)}
                      >
                        {r.sentAt ? "Kirim lagi" : "Kirim WA"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
        {list.length > 0 && <Pager pager={pager} label="sesi" className="mt-3" />}
        {desk && (
          <p className="mt-3 text-[13px] text-muted">
            Kirim WA membuka WhatsApp dengan ringkasan dan tautan PDF laporan. Laporan tanpa file: buka PDF, simpan, lalu lampirkan di WhatsApp.
            {day !== today && ` Menampilkan ${shortDate(day)}.`}
          </p>
        )}
      </div>

      <ReportSheet
        booking={editingBooking as Row<Booking> | null}
        report={editing ? (reports.get(editing) as Row<TherapyReport> | undefined) : null}
        visitId={editing ? visitOf.get(editing)?.id : null}
        complaint={editing ? visitOf.get(editing)?.complaint : undefined}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
