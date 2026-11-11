"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, HandCoins, Settings2 } from "lucide-react";
import { Button, Card, Empty, Field, Input, MoneyInput, PageHeader, Sheet, Spinner, cx, errorText, useToast } from "@/components/ui";
import { DateRangePicker, presetRange, rangeLabel, type Range } from "@/components/DateRange";
import { CommissionSettingsSheet, PayDays, RulesSummary, serviceRateText } from "@/components/Commission";
import { StatTile } from "@/components/Stats";
import { useCan, useUser } from "@/lib/auth";
import { payroll, payrollCsv, setPayDay, useCommission, workdays } from "@/lib/commission";
import { dateKey, num, rupiah, staffColor } from "@/lib/format";
import { useCollection, useNow, useServices, useStaff } from "@/lib/hooks";
import { useTeam } from "@/lib/settings";
import type { Filter } from "@/lib/store";
import type { Attendance, Booking, PayDay, TherapyReport, Visit } from "@/lib/types";

export default function KomisiPage() {
  const user = useUser();
  const can = useCan();
  const toast = useToast();
  const manage = can("commission.manage");
  const today = dateKey(useNow(60_000));
  const [range, setRange] = useState<Range>(() => presetRange("month"));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openStaff, setOpenStaff] = useState<string | null>(null);

  const span = useMemo<Filter[]>(
    () => [
      ["dateKey", ">=", range.from],
      ["dateKey", "<=", range.to],
    ],
    [range.from, range.to],
  );
  const { settings, loading: settingsLoading } = useCommission();
  const { staff } = useStaff(true);
  const { services } = useServices(true);
  const { team } = useTeam(true);
  const bookings = useCollection<Booking>("bookings", span).rows;
  const visits = useCollection<Visit>("visits", span).rows;
  const reports = useCollection<TherapyReport>("reports", span).rows;
  // A physio may only read their own clock-ins and their own hand-set days.
  const attendance = useCollection<Attendance>("attendance", manage ? span : [["email", "==", user.email]]).rows;
  const overrides = useCollection<PayDay>(manage || user.staffId ? "payDays" : null, manage ? span : [["staffId", "==", user.staffId ?? ""]]).rows;

  const loading = settingsLoading || !bookings || !visits || !reports || !attendance;
  const rows = useMemo(() => {
    if (!bookings || !visits || !reports || !attendance) return [];
    const finished = new Set(visits.filter((v) => v.stage === "finished" && v.bookingId).map((v) => v.bookingId!));
    const reported = new Set(reports.map((r) => r.bookingId));
    const who = manage ? staff : staff.filter((s) => s.id === user.staffId);
    return payroll({
      settings,
      staff: who,
      bookings,
      isDone: (b) => b.status === "paid" || !!b.endedAt || finished.has(b.id),
      hasReport: (b) => !!b.reportAt || reported.has(b.id),
      workdays: workdays(settings.compensation.basis, { attendance, team, from: range.from, to: range.to }),
      overrides: (overrides ?? []).filter((o) => o.dateKey >= range.from && o.dateKey <= range.to),
      from: range.from,
      to: range.to,
      today,
    }).filter((r) => r.staff.active || r.sessions > 0 || r.compensation > 0);
  }, [bookings, visits, reports, attendance, overrides, settings, staff, team, manage, user.staffId, range.from, range.to, today]);

  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((n, r) => n + f(r), 0);
  const total = sum((r) => r.total);
  const commission = sum((r) => r.commission);
  const compensation = sum((r) => r.compensation);
  const sessions = sum((r) => r.sessions);
  const held = sum((r) => r.held);
  const heldSessions = sum((r) => r.heldSessions);
  const compDays = sum((r) => r.compDays);
  // Switched off and nothing earned in this range. Earlier, frozen commission still shows after switching off.
  const off = !settings.enabled && !settings.compensation.enabled && total === 0 && held === 0;
  const mine = manage ? null : (rows[0] ?? null);
  const detail = rows.find((r) => r.staff.id === openStaff) ?? null;

  function download() {
    const blob = new Blob([payrollCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `komisi-jade-physio-${range.from}_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("File komisi diunduh");
  }

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <PageHeader
        title={manage ? "Komisi" : "Komisi saya"}
        subtitle={manage ? "Komisi per sesi dan kompensasi harian setiap fisioterapis" : "Komisi dari sesi yang Anda selesaikan, dan kompensasi hari tanpa pasien"}
        actions={
          manage && (
            <>
              <Button variant="secondary" icon={<Download className="size-4" />} onClick={download} disabled={!rows.some((r) => r.total > 0 || r.held > 0)}>
                <span className="hidden sm:inline">Unduh CSV</span>
              </Button>
              <Button icon={<Settings2 className="size-4" />} onClick={() => setSettingsOpen(true)}>
                Atur komisi
              </Button>
            </>
          )
        }
      />

      <div className="flex flex-col gap-5 px-4 md:px-8">
        <DateRangePicker long value={range} onChange={setRange} />

        {loading ? (
          <Spinner />
        ) : off ? (
          <Card>
            <Empty
              icon={<HandCoins className="size-5" />}
              title="Komisi belum diaktifkan"
              body={
                manage
                  ? "Atur persen atau nominal komisi untuk tiap layanan, dan kompensasi untuk hari kerja tanpa pasien. Keduanya bisa dinyalakan dan dimatikan kapan saja."
                  : "Manajer belum mengaktifkan komisi. Setelah aktif, komisi setiap sesi Anda muncul di sini."
              }
              action={manage && <Button onClick={() => setSettingsOpen(true)}>Atur komisi</Button>}
            />
          </Card>
        ) : !manage && !mine ? (
          <Card>
            <Empty icon={<HandCoins className="size-5" />} title="Akun Anda belum dihubungkan ke kolom fisioterapis" body="Minta admin mengaturnya di Terapis & akses, lalu komisi Anda muncul di sini." />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile lead className="col-span-2 lg:col-span-1" label={manage ? "Total untuk dibayarkan" : "Total Anda"} value={rupiah(total)} sub={rangeLabel(range)} />
              <StatTile label="Komisi sesi" value={rupiah(commission)} sub={`${num(sessions)} sesi selesai`} />
              <StatTile label="Kompensasi harian" value={rupiah(compensation)} sub={`Untuk ${num(compDays)} hari`} />
              {held > 0 || settings.holdUntilReport ? (
                <StatTile
                  className="col-span-2 lg:col-span-1"
                  label="Ditahan"
                  value={rupiah(held)}
                  sub={held > 0 ? `${num(heldSessions)} sesi menunggu laporan terapi` : "Semua laporan sudah dibuat"}
                  alert={held > 0}
                  href={held > 0 ? "/laporan-terapi" : undefined}
                />
              ) : (
                <StatTile className="col-span-2 lg:col-span-1" label="Rata-rata per sesi" value={rupiah(sessions ? commission / sessions : 0)} sub="Komisi dibagi jumlah sesi" />
              )}
            </div>

            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-bold">Cara hitung</h2>
                  <RulesSummary settings={settings} className="mt-2" />
                </div>
                {!manage && settings.enabled && (
                  <details className="w-full text-[13px] md:w-80">
                    <summary className="cursor-pointer font-semibold text-jade">Tarif per layanan</summary>
                    <ul className="mt-2 divide-y divide-line-soft rounded-lg border border-line">
                      {services
                        .filter((sv) => sv.active)
                        .map((sv) => (
                          <li key={sv.id} className="flex items-baseline justify-between gap-3 px-3 py-2">
                            <span className="truncate">{sv.name}</span>
                            <span className="tnum shrink-0 font-semibold">{serviceRateText(settings, sv)}</span>
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </div>
            </Card>

            {manage ? (
              <Card className="overflow-hidden">
                <h2 className="px-4 pt-4 font-bold">Per fisioterapis</h2>
                <p className="px-4 text-[13px] text-muted">Ketuk nama untuk rincian per hari, dan untuk mengubah kompensasi tanggal tertentu.</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-y border-line-soft text-left text-[12px] text-muted">
                        <th className="px-4 py-2 font-semibold">Fisioterapis</th>
                        <th className="px-3 py-2 text-right font-semibold">Sesi</th>
                        <th className="px-3 py-2 text-right font-semibold">Komisi</th>
                        <th className="px-3 py-2 text-right font-semibold">Hari kompensasi</th>
                        <th className="px-3 py-2 text-right font-semibold">Kompensasi</th>
                        {(held > 0 || settings.holdUntilReport) && <th className="px-3 py-2 text-right font-semibold">Ditahan</th>}
                        <th className="px-4 py-2 text-right font-semibold">Total</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.staff.id} onClick={() => setOpenStaff(r.staff.id)} className="cursor-pointer border-b border-line-soft last:border-0 hover:bg-canvas">
                          <td className="px-4 py-3">
                            <button type="button" className="inline-flex items-center gap-2 text-left font-semibold">
                              <span className="size-2.5 shrink-0 rounded-full" style={{ background: staffColor(r.staff.color).dot }} />
                              {r.staff.name}
                              {r.excluded && <span className="text-[12px] font-medium text-muted">(tidak ikut)</span>}
                            </button>
                          </td>
                          <td className="tnum px-3 py-3 text-right">{num(r.sessions)}</td>
                          <td className="tnum px-3 py-3 text-right">{rupiah(r.commission)}</td>
                          <td className="tnum px-3 py-3 text-right">{num(r.compDays)}</td>
                          <td className="tnum px-3 py-3 text-right">{rupiah(r.compensation)}</td>
                          {(held > 0 || settings.holdUntilReport) && (
                            <td className={cx("tnum px-3 py-3 text-right", r.held > 0 ? "font-semibold text-amber" : "text-muted")}>{r.held ? rupiah(r.held) : "–"}</td>
                          )}
                          <td className="tnum px-4 py-3 text-right font-bold">{rupiah(r.total)}</td>
                          <td className="pr-3 text-muted">
                            <ChevronRight className="size-4" />
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-muted">
                            Belum ada fisioterapis. Tambahkan di <Link href="/tim" className="font-semibold text-jade">Terapis &amp; akses</Link>.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {rows.length > 1 && (
                      <tfoot>
                        <tr className="border-t border-line bg-canvas/60 font-bold">
                          <td className="px-4 py-3">Semua</td>
                          <td className="tnum px-3 py-3 text-right">{num(sessions)}</td>
                          <td className="tnum px-3 py-3 text-right">{rupiah(commission)}</td>
                          <td className="tnum px-3 py-3 text-right">{num(compDays)}</td>
                          <td className="tnum px-3 py-3 text-right">{rupiah(compensation)}</td>
                          {(held > 0 || settings.holdUntilReport) && <td className="tnum px-3 py-3 text-right">{held ? rupiah(held) : "–"}</td>}
                          <td className="tnum px-4 py-3 text-right">{rupiah(total)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </Card>
            ) : (
              mine && (
                <section>
                  <h2 className="mb-2 text-sm font-bold text-ink-2">Rincian per hari</h2>
                  <PayDays pay={mine} settings={settings} manage={false} today={today} />
                </section>
              )
            )}
          </>
        )}
      </div>

      {manage && <CommissionSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} services={services} staff={staff.filter((s) => s.active)} />}

      <Sheet open={!!detail} onClose={() => setOpenStaff(null)} wide title={detail?.staff.name ?? ""}>
        {detail && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Mini label="Komisi" value={rupiah(detail.commission)} sub={`${num(detail.sessions)} sesi`} />
              <Mini label="Kompensasi" value={rupiah(detail.compensation)} sub={`${num(detail.compDays)} hari`} />
              <Mini label="Total" value={rupiah(detail.total)} sub={detail.held ? `${rupiah(detail.held)} ditahan` : rangeLabel(range)} strong />
            </div>
            <PayDays pay={detail} settings={settings} manage={manage} today={today} />
            {manage && <OtherDay staffId={detail.staff.id} from={range.from} to={range.to > today ? today : range.to} amount={settings.compensation.amount} />}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Mini({ label, value, sub, strong }: { label: string; value: string; sub: string; strong?: boolean }) {
  return (
    <div className={cx("rounded-xl border px-2 py-2.5", strong ? "border-jade/40 bg-jade-mist/50" : "border-line")}>
      <p className="text-[12px] text-muted">{label}</p>
      <p className="tnum truncate text-[15px] font-bold">{value}</p>
      <p className="truncate text-[11px] text-muted">{sub}</p>
    </div>
  );
}

/** A day that is not in the list (no clock-in, no session): the manager can still give compensation for it. */
function OtherDay({ staffId, from, to, amount: initial }: { staffId: string; from: string; to: string; amount: number }) {
  const user = useUser();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(to);
  const [amount, setAmount] = useState(initial);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Atur kompensasi untuk tanggal lain
      </Button>
    );
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-3.5">
      <p className="text-sm font-bold">Kompensasi untuk tanggal lain</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tanggal" htmlFor="od-day">
          <Input id="od-day" type="date" min={from} max={to} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </Field>
        <Field label="Jumlah" htmlFor="od-amount">
          <MoneyInput id="od-amount" value={amount} onChange={setAmount} />
        </Field>
      </div>
      <Field label="Catatan (opsional)" htmlFor="od-note">
        <Input id="od-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Jaga klinik saat libur" />
      </Field>
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={busy}
          disabled={day < from || day > to}
          onClick={async () => {
            setBusy(true);
            try {
              await setPayDay(staffId, day, amount, note, user);
              toast("Kompensasi disimpan");
              setOpen(false);
              setNote("");
            } catch (e) {
              toast(errorText(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Simpan
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Batal
        </Button>
      </div>
    </div>
  );
}
