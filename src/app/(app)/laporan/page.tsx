"use client";

import { useMemo, useState } from "react";
import { Card, PageHeader, ScrollX, Spinner, cx } from "@/components/ui";
import { DateRangePicker, presetRange, type Range } from "@/components/DateRange";
import { useCollection, useStaff } from "@/lib/hooks";
import { voucherState } from "@/lib/actions";
import { PAYMENT_LABEL, addDays, fromDateKey, num, pad, remaining, rupiah, rupiahShort, shortDate, staffColor } from "@/lib/format";
import type { PaymentMethod, Sale, Voucher } from "@/lib/types";

export default function LaporanPage() {
  const [range, setRange] = useState<Range>(() => presetRange("month"));
  const { rows, loading } = useCollection<Sale>("sales", [
    ["dateKey", ">=", range.from],
    ["dateKey", "<=", range.to],
  ]);
  const { rows: vouchers } = useCollection<Voucher>("vouchers", [["status", "==", "active"]]);
  const { staff } = useStaff(true);

  const r = useMemo(() => {
    const sales = (rows ?? []).filter((s) => s.status === "paid");
    const voided = (rows ?? []).filter((s) => s.status === "void").length;
    const revenue = sales.reduce((s, x) => s + x.total, 0);
    const discount = sales.reduce((s, x) => s + x.discount, 0);

    let sessions = 0;
    let voucherSessions = 0;
    let voucherValue = 0;
    let pkgCount = 0;
    let pkgRevenue = 0;
    const byMethod: Record<PaymentMethod, { amount: number; count: number }> = {
      qris: { amount: 0, count: 0 },
      transfer: { amount: 0, count: 0 },
      card: { amount: 0, count: 0 },
    };
    const byStaff = new Map<string, { name: string; sessions: number; viaVoucher: number; value: number; cash: number }>();
    const byService = new Map<string, { name: string; sessions: number; value: number }>();
    const bySeller = new Map<string, { name: string; count: number; value: number }>();

    for (const s of sales) {
      if (s.paymentMethod !== "voucher") {
        byMethod[s.paymentMethod].amount += s.total;
        byMethod[s.paymentMethod].count += 1;
      }
      for (const i of s.items) {
        if (i.kind === "package") {
          pkgCount += i.qty;
          pkgRevenue += i.amount;
          const key = i.soldBy ?? s.createdBy;
          const se = bySeller.get(key) ?? { name: i.soldByName ?? s.createdByName ?? key, count: 0, value: 0 };
          se.count += i.qty;
          se.value += i.amount;
          bySeller.set(key, se);
          continue;
        }
        sessions += i.qty;
        if (i.voucherId) {
          voucherSessions += i.qty;
          voucherValue += i.unitPrice * i.qty;
        }
        const key = i.staffId ?? "-";
        const st = byStaff.get(key) ?? { name: i.staffName ?? "Tanpa terapis", sessions: 0, viaVoucher: 0, value: 0, cash: 0 };
        st.sessions += i.qty;
        st.viaVoucher += i.voucherId ? i.qty : 0;
        st.value += i.unitPrice * i.qty;
        st.cash += i.amount;
        byStaff.set(key, st);
        const sv = byService.get(i.refId) ?? { name: i.name, sessions: 0, value: 0 };
        sv.sessions += i.qty;
        sv.value += i.unitPrice * i.qty;
        byService.set(i.refId, sv);
      }
    }

    // Revenue series: by hour for a single day, otherwise by day.
    const single = range.from === range.to;
    let series: { label: string; full: string; value: number }[] = [];
    if (single) {
      const hours = Array.from({ length: 14 }, (_, i) => 8 + i);
      series = hours.map((h) => ({
        label: `${pad(h)}`,
        full: `${pad(h)}.00–${pad(h + 1)}.00`,
        value: sales.filter((s) => new Date(s.createdAt).getHours() === h).reduce((a, s) => a + s.total, 0),
      }));
    } else {
      const days: string[] = [];
      for (let d = range.from; d <= range.to && days.length < 92; d = addDays(d, 1)) days.push(d);
      series = days.map((d) => ({
        label: String(fromDateKey(d).getDate()),
        full: shortDate(d),
        value: sales.filter((s) => s.dateKey === d).reduce((a, s) => a + s.total, 0),
      }));
    }

    return {
      revenue,
      discount,
      count: sales.length,
      voided,
      sessions,
      voucherSessions,
      voucherValue,
      pkgCount,
      pkgRevenue,
      avg: sales.length ? revenue / sales.length : 0,
      byMethod,
      byStaff: [...byStaff.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.sessions - a.sessions),
      byService: [...byService.values()].sort((a, b) => b.sessions - a.sessions),
      bySeller: [...bySeller.values()].sort((a, b) => b.value - a.value),
      series,
      single,
    };
  }, [rows, range]);

  const active = (vouchers ?? []).filter((v) => voucherState(v) === "active");
  const prepaidSessions = active.reduce((s, v) => s + remaining(v), 0);
  const prepaidValue = active.reduce((s, v) => s + (v.pricePaid / v.totalSessions) * remaining(v), 0);

  const maxSeries = Math.max(1, ...r.series.map((s) => s.value));
  const methodTotal = Math.max(1, r.byMethod.qris.amount + r.byMethod.transfer.amount + r.byMethod.card.amount);

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <PageHeader
        title="Laporan penjualan"
        subtitle={range.from === range.to ? shortDate(range.from) : `${shortDate(range.from)} – ${shortDate(range.to)}`}
      />
      <div className="px-4 md:px-8">
        <DateRangePicker value={range} onChange={setRange} />

        {loading ? (
          <Spinner />
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
              <Kpi label="Pemasukan" value={rupiah(r.revenue)} sub={r.discount ? `Diskon ${rupiah(r.discount)}` : `${num(r.count)} transaksi`} strong />
              <Kpi label="Rata-rata per transaksi" value={rupiah(r.avg)} sub={`${num(r.count)} faktur lunas`} />
              <Kpi label="Sesi dilayani" value={num(r.sessions)} sub={`${num(r.voucherSessions)} dari voucher`} />
              <Kpi label="Paket terjual" value={num(r.pkgCount)} sub={rupiah(r.pkgRevenue)} />
            </div>

            <Card className="mt-4 p-4 md:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-bold">{r.single ? "Pemasukan per jam" : "Pemasukan per hari"}</h2>
                <p className="tnum text-sm text-muted">Tertinggi {rupiah(maxSeries === 1 ? 0 : maxSeries)}</p>
              </div>
              <div className="mt-5 flex h-44 items-end gap-[3px] md:h-56 md:gap-1.5">
                {r.series.map((p, i) => {
                  const h = (p.value / maxSeries) * 100;
                  const showLabel = r.series.length <= 16 || i % Math.ceil(r.series.length / 10) === 0;
                  return (
                    <div key={i} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${p.full}: ${rupiah(p.value)}`}>
                      <span className="pointer-events-none absolute -top-1 z-10 hidden -translate-y-full rounded-md bg-ink px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-white group-hover:block">
                        {p.full}: {rupiah(p.value)}
                      </span>
                      <div
                        className={cx("w-full rounded-t-[4px] transition-colors", p.value ? "bg-jade-bead group-hover:bg-jade-deep" : "bg-line-soft")}
                        style={{ height: `${Math.max(h, p.value ? 2 : 1.5)}%` }}
                      />
                      <span className={cx("tnum mt-1.5 text-[10px] text-muted md:text-[11px]", !showLabel && "invisible")}>{p.label}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card className="p-4 md:p-5">
                <h2 className="font-bold">Metode pembayaran</h2>
                <div className="mt-4 flex flex-col gap-4">
                  {(["qris", "transfer", "card"] as const).map((m) => {
                    const v = r.byMethod[m];
                    const pct = (v.amount / methodTotal) * 100;
                    return (
                      <div key={m}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-semibold">{PAYMENT_LABEL[m]}</span>
                          <span className="tnum">
                            <span className="font-semibold">{rupiah(v.amount)}</span>
                            <span className="ml-2 text-muted">{num(v.count)}x</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line-soft">
                          <div className="h-full rounded-full bg-jade" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-baseline justify-between gap-3 rounded-xl bg-jade-mist/60 px-3.5 py-3 text-sm">
                    <span className="font-semibold text-jade-deep">Voucher dipakai</span>
                    <span className="tnum text-jade-deep">
                      <span className="font-semibold">{num(r.voucherSessions)} sesi</span>
                      <span className="ml-2">senilai {rupiah(r.voucherValue)}</span>
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-4 md:p-5">
                <h2 className="font-bold">Prabayar</h2>
                <p className="mt-1 text-[13px] text-muted">Posisi saat ini, tidak terpengaruh rentang tanggal.</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-line p-3.5">
                    <p className="text-[13px] text-muted">Sesi belum terpakai</p>
                    <p className="tnum mt-1 text-2xl font-bold text-jade-deep">{num(prepaidSessions)}</p>
                    <p className="text-[13px] text-muted">{num(active.length)} voucher aktif</p>
                  </div>
                  <div className="rounded-xl border border-line p-3.5">
                    <p className="text-[13px] text-muted">Nilai tersisa</p>
                    <p className="tnum mt-1 text-2xl font-bold">{rupiahShort(prepaidValue)}</p>
                    <p className="tnum text-[13px] text-muted">{rupiah(prepaidValue)}</p>
                  </div>
                </div>
                <p className="mt-3 text-[13px] text-muted">
                  Nilai tersisa adalah uang yang sudah diterima untuk sesi yang belum dilayani.
                </p>
              </Card>
            </div>

            <Card className="mt-4 overflow-hidden">
              <h2 className="px-4 pt-4 font-bold md:px-5 md:pt-5">Per terapis</h2>
              <ScrollX label="Per terapis">
                <table className="mt-3 w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-y border-line-soft text-left text-[13px] text-muted">
                      <th className="px-4 py-2.5 font-semibold md:px-5">Terapis</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Sesi</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Via voucher</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Nilai layanan</th>
                      <th className="px-4 py-2.5 text-right font-semibold md:px-5">Pemasukan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.byStaff.map((s) => {
                      const c = staffColor(staff.find((x) => x.id === s.id)?.color);
                      return (
                        <tr key={s.id} className="border-b border-line-soft last:border-0">
                          <td className="px-4 py-3 md:px-5">
                            <span className="inline-flex items-center gap-2 font-semibold">
                              <span className="size-2.5 rounded-full" style={{ background: c.dot }} />
                              {s.name}
                            </span>
                          </td>
                          <td className="tnum px-3 py-3 text-right font-semibold">{num(s.sessions)}</td>
                          <td className="tnum px-3 py-3 text-right text-ink-2">{num(s.viaVoucher)}</td>
                          <td className="tnum px-3 py-3 text-right text-ink-2">{rupiah(s.value)}</td>
                          <td className="tnum px-4 py-3 text-right font-semibold md:px-5">{rupiah(s.cash)}</td>
                        </tr>
                      );
                    })}
                    {r.byStaff.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-6 text-center text-muted">
                          Belum ada sesi di rentang ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollX>
            </Card>

            <Card className="mt-4 overflow-hidden">
              <h2 className="px-4 pt-4 font-bold md:px-5 md:pt-5">Penjualan paket per staf</h2>
              <ul className="mt-3">
                {r.bySeller.map((s) => (
                  <li key={s.name} className="flex items-baseline justify-between gap-3 border-t border-line-soft px-4 py-3 text-sm md:px-5">
                    <span className="truncate font-semibold">{s.name}</span>
                    <span className="tnum shrink-0">
                      <span className="font-semibold">{num(s.count)} paket</span>
                      <span className="ml-2 text-muted">{rupiah(s.value)}</span>
                    </span>
                  </li>
                ))}
                {r.bySeller.length === 0 && <li className="border-t border-line-soft px-5 py-6 text-center text-sm text-muted">Belum ada paket terjual di rentang ini.</li>}
              </ul>
            </Card>

            <Card className="mt-4 overflow-hidden">
              <h2 className="px-4 pt-4 font-bold md:px-5 md:pt-5">Per layanan</h2>
              <ul className="mt-3">
                {r.byService.map((s) => {
                  const max = r.byService[0]?.sessions || 1;
                  return (
                    <li key={s.name} className="border-t border-line-soft px-4 py-3 md:px-5">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-semibold">{s.name}</span>
                        <span className="tnum shrink-0">
                          <span className="font-semibold">{num(s.sessions)} sesi</span>
                          <span className="ml-2 text-muted">{rupiah(s.value)}</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line-soft">
                        <div className="h-full rounded-full bg-jade-bead" style={{ width: `${(s.sessions / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
                {r.byService.length === 0 && <li className="border-t border-line-soft px-5 py-6 text-center text-sm text-muted">Belum ada data.</li>}
              </ul>
            </Card>

            {r.voided > 0 && (
              <p className="mt-4 text-[13px] text-muted">
                {num(r.voided)} faktur dibatalkan tidak dihitung dalam laporan ini.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={cx("rounded-xl border p-3.5 md:p-4", strong ? "border-jade-deep bg-jade-deep text-white" : "border-line bg-surface")}>
      <p className={cx("text-[13px]", strong ? "text-white/70" : "text-muted")}>{label}</p>
      <p className="tnum mt-1 truncate text-lg font-bold tracking-[-0.01em] md:text-[22px]">{value}</p>
      {sub && <p className={cx("tnum mt-0.5 truncate text-xs md:text-[13px]", strong ? "text-white/70" : "text-muted")}>{sub}</p>}
    </div>
  );
}
