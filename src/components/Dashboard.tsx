"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, Spinner, cx } from "./ui";
import { Delta, RankBars, SplitBar, StackedColumns, StatTile, VIZ } from "./Stats";
import { previousRange, rangeDays } from "./DateRange";
import { useCan } from "@/lib/auth";
import { monthLoads, monthOf } from "@/lib/assign";
import { payroll, useCommission, workdays } from "@/lib/commission";
import { SOURCES, ageFrom } from "@/lib/flow";
import { addDays, dateKey, dayMonth, fromDateKey, num, pad, rupiah, rupiahShort, shortDate, staffColor } from "@/lib/format";
import { useCollection, useCustomers, useNow, useStaff } from "@/lib/hooks";
import { reportOnTime } from "@/lib/reports";
import { durationText, useTeam } from "@/lib/settings";
import type { Filter, Row } from "@/lib/store";
import type { Attendance, Booking, Customer, PayDay, Sale, TherapyReport, Visit } from "@/lib/types";

const spanOf = (from: string, to: string): Filter[] => [
  ["dateKey", ">=", from],
  ["dateKey", "<=", to],
];


interface Bucket {
  key: string;
  label: string;
  full: string;
  from: string;
  to: string;
}

/** Days for a month or so, then weeks, then months, so the chart never has more columns than it can show. */
function buckets(from: string, to: string): Bucket[] {
  const days = rangeDays({ from, to });
  const out: Bucket[] = [];
  if (days <= 35) {
    for (let d = from; d <= to; d = addDays(d, 1)) out.push({ key: d, label: String(fromDateKey(d).getDate()), full: shortDate(d), from: d, to: d });
  } else if (days <= 190) {
    for (let d = from; d <= to; d = addDays(d, 7)) {
      const end = addDays(d, 6) > to ? to : addDays(d, 6);
      out.push({ key: d, label: dayMonth(d), full: `${dayMonth(d)} – ${shortDate(end)}`, from: d, to: end });
    }
  } else {
    for (let d = from; d <= to; ) {
      const x = fromDateKey(d);
      const last = dateKey(new Date(x.getFullYear(), x.getMonth() + 1, 0));
      const end = last > to ? to : last;
      out.push({ key: d, label: x.toLocaleDateString("id-ID", { month: "short" }), full: x.toLocaleDateString("id-ID", { month: "long", year: "numeric" }), from: d, to: end });
      d = addDays(end, 1);
    }
  }
  return out;
}

const AGE_GROUPS: [label: string, test: (age: number) => boolean][] = [
  ["Di bawah 18", (a) => a < 18],
  ["18–30", (a) => a >= 18 && a <= 30],
  ["31–45", (a) => a >= 31 && a <= 45],
  ["46–60", (a) => a >= 46 && a <= 60],
  ["Di atas 60", (a) => a > 60],
];

/** The manager's view of a date range: who came, how many were new, what it earned, and whether reports keep up. */
export function Dashboard({ from, to }: { from: string; to: string }) {
  const can = useCan();
  const today = dateKey(useNow(60_000));
  const prev = useMemo(() => previousRange({ from, to }), [from, to]);
  const { staff } = useStaff(true);
  const { customers, loading: customersLoading } = useCustomers();
  const bookings = useCollection<Booking>("bookings", spanOf(from, to)).rows;
  const visits = useCollection<Visit>("visits", spanOf(from, to)).rows;
  const reports = useCollection<TherapyReport>("reports", spanOf(from, to)).rows;
  const sales = useCollection<Sale>("sales", spanOf(from, to)).rows;
  const prevBookings = useCollection<Booking>("bookings", spanOf(prev.from, prev.to)).rows;
  const prevVisits = useCollection<Visit>("visits", spanOf(prev.from, prev.to)).rows;
  const prevSales = useCollection<Sale>("sales", spanOf(prev.from, prev.to)).rows;

  // What the physios earned, for the manager only.
  const payView = can("commission");
  const { settings: commission } = useCommission();
  const { team } = useTeam(true);
  const attendance = useCollection<Attendance>(payView ? "attendance" : null, spanOf(from, to)).rows;
  const overrides = useCollection<PayDay>(payView ? "payDays" : null, spanOf(from, to)).rows;

  const loading = !bookings || !visits || !reports || !sales || !prevBookings || !prevVisits || !prevSales || customersLoading;

  const d = useMemo(() => {
    if (!bookings || !visits || !reports || !sales || !prevBookings || !prevVisits || !prevSales) return null;
    const byId = new Map(customers.map((c) => [c.id, c]));
    const servedIn = (rows: Row<Booking>[], vis: Row<Visit>[]) => {
      const finished = new Set(vis.filter((v) => v.stage === "finished" && v.bookingId).map((v) => v.bookingId!));
      return rows.filter((b) => b.status !== "cancelled" && (b.status === "paid" || !!b.endedAt || finished.has(b.id)));
    };
    const sessions = servedIn(bookings, visits);
    const prevSessions = servedIn(prevBookings, prevVisits);
    // When each patient first had a session. Recorded at checkout; for patients from before that was recorded:
    // someone registered inside the days loaded here is new at their first session in them, anyone older is a returning patient.
    const earliest = new Map<string, number>();
    for (const b of [...prevSessions, ...sessions]) if (b.startAt < (earliest.get(b.customerId) ?? Infinity)) earliest.set(b.customerId, b.startAt);
    const firstSession = (id: string) => {
      const c = byId.get(id);
      if (!c) return earliest.get(id) ?? 0;
      if (c.firstSessionAt) return c.firstSessionAt;
      return dateKey(c.createdAt) >= prev.from ? (earliest.get(id) ?? c.createdAt) : c.createdAt;
    };
    const isNewIn = (id: string, a: string, b: string) => {
      const first = firstSession(id);
      if (!first) return false;
      const k = dateKey(first);
      return k >= a && k <= b;
    };
    const patients = [...new Set(sessions.map((b) => b.customerId))];
    const prevPatients = [...new Set(prevSessions.map((b) => b.customerId))];
    const fresh = patients.filter((id) => isNewIn(id, from, to));
    const prevFresh = prevPatients.filter((id) => isNewIn(id, prev.from, prev.to));
    const cameBack = prevPatients.filter((id) => patients.includes(id)).length;

    // Money
    const paid = sales.filter((s) => s.status === "paid");
    const prevPaid = prevSales.filter((s) => s.status === "paid");
    const revenue = paid.reduce((n, s) => n + s.total, 0);
    const prevRevenue = prevPaid.reduce((n, s) => n + s.total, 0);
    const packages = paid.flatMap((s) => s.items.filter((i) => i.kind === "package"));

    // Cancellations
    const cancelled = bookings.filter((b) => b.status === "cancelled").length;
    const prevCancelled = prevBookings.filter((b) => b.status === "cancelled").length;

    // Therapy reports: on time means written on the day of the session.
    const reportOf = new Map(reports.map((r) => [r.bookingId, r]));
    const status = (b: Row<Booking>) => {
      const r = reportOf.get(b.id);
      return !r ? "missing" : reportOnTime(r) ? "onTime" : "late";
    };
    const delays = sessions.flatMap((b) => {
      const r = reportOf.get(b.id);
      return r ? [Math.max(0, r.createdAt - (b.endedAt ?? b.startAt + b.durationMin * 60_000)) / 60_000] : [];
    });
    const count = (rows: Row<Booking>[]) => ({
      onTime: rows.filter((b) => status(b) === "onTime").length,
      late: rows.filter((b) => status(b) === "late").length,
      missing: rows.filter((b) => status(b) === "missing").length,
      overdue: rows.filter((b) => status(b) === "missing" && b.dateKey < today).length,
    });
    const rep = count(sessions);

    // Per physio
    const perStaff = staff
      .map((s) => {
        const mine = sessions.filter((b) => b.staffId === s.id);
        return { s, sessions: mine.length, patients: new Set(mine.map((b) => b.customerId)).size, value: mine.reduce((n, b) => n + b.price, 0), ...count(mine) };
      })
      .filter((x) => x.sessions > 0)
      .sort((a, b) => b.sessions - a.sessions);

    // Patients over time: new on the day (week, month) of their first session, returning after that.
    const series = buckets(from, to).map((bk) => {
      const here = [...new Set(sessions.filter((b) => b.dateKey >= bk.from && b.dateKey <= bk.to).map((b) => b.customerId))];
      const n = here.filter((id) => isNewIn(id, bk.from, bk.to)).length;
      return { key: bk.key, label: bk.label, full: bk.full, values: [here.length - n, n] };
    });

    // Where new patients heard of the clinic
    const sourceCount = new Map<string, number>();
    for (const id of fresh) {
      const c = byId.get(id);
      const keys = c?.profile?.sources?.length ? c.profile.sources : c?.profile?.sourcesOther?.trim() ? ["lainnya"] : ["kosong"];
      for (const k of keys) sourceCount.set(k, (sourceCount.get(k) ?? 0) + 1);
    }
    const sourceLabel = (k: string) => SOURCES.find(([x]) => x === k)?.[1] ?? (k === "kosong" ? "Belum diisi" : k === "lainnya" ? "Lainnya" : k);
    const sources = [...sourceCount].map(([k, v]) => ({ label: sourceLabel(k), value: v })).sort((a, b) => b.value - a.value);
    const online = fresh.filter((id) => byId.get(id)?.source === "online").length;

    // Services and hours
    const svc = new Map<string, { n: number; value: number }>();
    for (const b of sessions) {
      const x = svc.get(b.serviceName) ?? { n: 0, value: 0 };
      svc.set(b.serviceName, { n: x.n + 1, value: x.value + b.price });
    }
    const services = [...svc].map(([label, x]) => ({ label, value: x.n, text: `${num(x.n)} sesi`, sub: rupiah(x.value) })).sort((a, b) => b.value - a.value).slice(0, 6);
    const hourOf = (b: Booking) => new Date(b.startAt).getHours();
    const hrs = sessions.map(hourOf);
    const h0 = Math.min(8, ...hrs);
    const h1 = Math.max(20, ...hrs);
    const hours = Array.from({ length: h1 - h0 + 1 }, (_, i) => {
      const h = h0 + i;
      return { key: String(h), label: pad(h), full: `${pad(h)}.00–${pad(h + 1)}.00`, values: [hrs.filter((x) => x === h).length] };
    });

    // Who the patients are
    const people = patients.map((id) => byId.get(id)).filter(Boolean) as Row<Customer>[];
    const gender = { L: people.filter((c) => c.gender === "L").length, P: people.filter((c) => c.gender === "P").length };
    const ages = people.map((c) => ageFrom(c.birthDate || c.profile?.birthDate)).filter((a): a is number => a != null);
    const ageRows = AGE_GROUPS.map(([label, test]) => ({ label, value: ages.filter(test).length })).filter((r) => r.value > 0);

    // The newest patients, to welcome or follow up
    const sessionsOf = (id: string) => sessions.filter((b) => b.customerId === id).length;
    const newest = fresh
      .filter((id) => byId.has(id))
      .map((id) => ({ c: byId.get(id)!, first: firstSession(id), n: sessionsOf(id) }))
      .sort((a, b) => b.first - a.first);

    return {
      sessions: sessions.length,
      prevSessions: prevSessions.length,
      patients: patients.length,
      prevPatients: prevPatients.length,
      fresh: fresh.length,
      prevFresh: prevFresh.length,
      returning: patients.length - fresh.length,
      prevReturning: prevPatients.length - prevFresh.length,
      retention: prevPatients.length ? Math.round((cameBack / prevPatients.length) * 100) : null,
      revenue,
      prevRevenue,
      invoices: paid.length,
      pkgCount: packages.reduce((n, i) => n + i.qty, 0),
      pkgValue: packages.reduce((n, i) => n + i.amount, 0),
      cancelled,
      cancelRate: bookings.length ? Math.round((cancelled / bookings.length) * 100) : 0,
      prevCancelRate: prevBookings.length ? Math.round((prevCancelled / prevBookings.length) * 100) : 0,
      booked: bookings.length,
      rep,
      punctual: sessions.length ? Math.round((rep.onTime / sessions.length) * 100) : null,
      // The middle one: a single report written days later doesn't drag it.
      typicalDelay: delays.length ? Math.round([...delays].sort((a, b) => a - b)[Math.floor(delays.length / 2)]) : null,
      perStaff,
      series,
      sources,
      online,
      services,
      hours,
      gender,
      ageRows,
      agesKnown: ages.length,
      newest,
    };
  }, [bookings, visits, reports, sales, prevBookings, prevVisits, prevSales, customers, staff, from, to, prev.from, prev.to, today]);

  const pay = useMemo(() => {
    if (!payView || !bookings || !visits || !reports || !attendance) return null;
    if (!commission.enabled && !commission.compensation.enabled) return null;
    const finished = new Set(visits.filter((v) => v.stage === "finished" && v.bookingId).map((v) => v.bookingId!));
    const reported = new Set(reports.map((r) => r.bookingId));
    const rows = payroll({
      settings: commission,
      staff,
      bookings,
      isDone: (b) => b.status === "paid" || !!b.endedAt || finished.has(b.id),
      hasReport: (b) => !!b.reportAt || reported.has(b.id),
      workdays: workdays(commission.compensation.basis, { attendance, team, from, to }),
      overrides: overrides ?? [],
      from,
      to,
      today,
    });
    return { total: rows.reduce((n, r) => n + r.total, 0), held: rows.reduce((n, r) => n + r.held, 0), compensation: rows.reduce((n, r) => n + r.compensation, 0) };
  }, [payView, commission, bookings, visits, reports, attendance, overrides, staff, team, from, to, today]);

  if (loading || !d) return <Spinner />;

  const days = rangeDays({ from, to });
  const bucketWord = days <= 35 ? "per hari" : days <= 190 ? "per minggu" : "per bulan";
  const share = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "0%");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        Dibandingkan dengan {days} hari sebelumnya, {shortDate(prev.from)} – {shortDate(prev.to)}.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          lead
          className="col-span-2 lg:col-span-1"
          label="Pasien dilayani"
          value={num(d.patients)}
          sub={`${num(d.fresh)} baru, ${num(d.returning)} lama`}
          delta={<Delta cur={d.patients} prev={d.prevPatients} />}
        />
        <StatTile
          label="Pasien baru"
          value={num(d.fresh)}
          sub={`${share(d.fresh, d.patients)} dari pasien${d.online ? `, ${num(d.online)} dari booking online` : ""}`}
          delta={<Delta cur={d.fresh} prev={d.prevFresh} />}
        />
        <StatTile
          label="Pasien lama"
          value={num(d.returning)}
          sub={d.retention == null ? "Sudah pernah datang sebelumnya" : `${d.retention}% pasien periode lalu datang lagi`}
          delta={<Delta cur={d.returning} prev={d.prevReturning} />}
        />
        <StatTile
          href="/kalender"
          label="Sesi selesai"
          value={num(d.sessions)}
          sub={`${d.patients ? (d.sessions / d.patients).toFixed(1).replace(".", ",") : "0"} sesi per pasien`}
          delta={<Delta cur={d.sessions} prev={d.prevSessions} />}
        />
        <StatTile
          href="/laporan"
          label="Pemasukan"
          value={`Rp ${rupiahShort(d.revenue)}`}
          sub={`${num(d.invoices)} faktur, ${num(d.pkgCount)} paket terjual`}
          delta={<Delta cur={d.revenue} prev={d.prevRevenue} />}
        />
        <StatTile
          href="/laporan-terapi"
          label="Laporan tepat waktu"
          value={d.punctual == null ? "–" : `${d.punctual}%`}
          sub={`${num(d.rep.late)} terlambat, ${num(d.rep.missing)} belum dibuat`}
          alert={d.rep.overdue > 0}
        />
        <StatTile
          label="Booking batal"
          value={`${d.cancelRate}%`}
          sub={`${num(d.cancelled)} dari ${num(d.booked)} booking`}
          delta={<Delta cur={d.cancelRate} prev={d.prevCancelRate} goodWhenUp={false} />}
        />
        {pay ? (
          <StatTile
            href="/komisi"
            label="Komisi fisioterapis"
            value={`Rp ${rupiahShort(pay.total)}`}
            sub={`Termasuk kompensasi ${rupiah(pay.compensation)}${pay.held ? `, ${rupiah(pay.held)} ditahan` : ""}`}
          />
        ) : (
          <StatTile label="Paket terjual" value={num(d.pkgCount)} sub={rupiah(d.pkgValue)} href="/voucher" />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 md:p-5 lg:col-span-2">
          <h2 className="font-bold">Pasien baru dan lama {bucketWord}</h2>
          <p className="mb-4 text-[13px] text-muted">Pasien dihitung baru pada sesi pertamanya, dan lama pada kedatangan berikutnya.</p>
          <StackedColumns
            data={d.series}
            unit="pasien"
            series={[
              { name: "Pasien lama", color: VIZ.returning },
              { name: "Pasien baru", color: VIZ.fresh },
            ]}
          />
        </Card>
        <Card className="p-4 md:p-5">
          <h2 className="font-bold">Dari mana pasien baru tahu klinik</h2>
          <p className="mb-4 text-[13px] text-muted">Dari formulir pasien baru, bagian E.</p>
          <RankBars rows={d.sources} color={VIZ.fresh} empty="Belum ada pasien baru di rentang ini." />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="p-4 pb-3 md:p-5 md:pb-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-bold">Laporan terapi per fisioterapis</h2>
              <Link href="/laporan-terapi" className="text-[13px] font-semibold text-jade">
                Buka laporan terapi
              </Link>
            </div>
            <p className="text-[13px] text-muted">
              Tepat waktu berarti dibuat di hari yang sama dengan sesi.
              {d.typicalDelay != null && ` Biasanya laporan masuk ${durationText(d.typicalDelay)} setelah sesi.`}
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold text-ink-2">
              {(
                [
                  ["Tepat waktu", VIZ.good],
                  ["Terlambat", VIZ.warn],
                  ["Belum dibuat", VIZ.bad],
                ] as const
              ).map(([name, color]) => (
                <li key={name} className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
                  {name}
                </li>
              ))}
            </ul>
          </div>
          <ul className="divide-y divide-line-soft border-t border-line-soft">
            {d.perStaff.map((x) => (
              <li key={x.s.id} className="px-4 py-3 md:px-5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: staffColor(x.s.color).dot }} />
                    <span className="truncate">{x.s.name}</span>
                  </span>
                  <span className="tnum shrink-0 text-[13px]">
                    <span className="font-bold">
                      {x.onTime}/{x.sessions}
                    </span>
                    <span className="ml-1 text-muted">tepat waktu</span>
                  </span>
                </div>
                <SplitBar
                  className="mt-2"
                  parts={[
                    { name: "Tepat waktu", value: x.onTime, color: VIZ.good },
                    { name: "Terlambat", value: x.late, color: VIZ.warn },
                    { name: "Belum dibuat", value: x.missing, color: VIZ.bad },
                  ]}
                />
                <p className="tnum mt-1.5 text-[12px] text-muted">
                  {num(x.sessions)} sesi, {num(x.patients)} pasien
                  {x.late > 0 && `, ${num(x.late)} terlambat`}
                  {x.missing > 0 && (
                    <span className={cx(x.overdue > 0 && "font-semibold text-danger")}>
                      , {num(x.missing)} belum dibuat{x.overdue > 0 ? ` (${num(x.overdue)} lewat hari)` : ""}
                    </span>
                  )}
                </p>
              </li>
            ))}
            {d.perStaff.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">Belum ada sesi selesai di rentang ini.</li>}
          </ul>
        </Card>

        <Card className="p-4 md:p-5">
          <h2 className="font-bold">Layanan terbanyak</h2>
          <p className="mb-4 text-[13px] text-muted">Jumlah sesi selesai dan nilai layanannya.</p>
          <RankBars rows={d.services} />
        </Card>
      </div>

      <MonthShare day={to > today ? today : to} customers={customers} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 md:p-5">
          <h2 className="font-bold">Jam tersibuk</h2>
          <p className="mb-4 text-[13px] text-muted">Sesi menurut jam mulai, untuk mengatur shift.</p>
          <StackedColumns data={d.hours} unit="sesi" height={160} series={[{ name: "Sesi", color: VIZ.returning }]} />
        </Card>
        <Card className="p-4 md:p-5">
          <h2 className="font-bold">Profil pasien yang dilayani</h2>
          <p className="mb-3 text-[13px] text-muted">Dari data pasien. Yang belum diisi tidak dihitung.</p>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold">Jenis kelamin</span>
            <span className="tnum text-[13px] text-muted">
              <span className="font-bold text-ink">{num(d.gender.P)}</span> perempuan, <span className="font-bold text-ink">{num(d.gender.L)}</span> laki-laki
            </span>
          </div>
          <SplitBar
            className="mt-2"
            parts={[
              { name: "Perempuan", value: d.gender.P, color: VIZ.fresh },
              { name: "Laki-laki", value: d.gender.L, color: VIZ.returning },
            ]}
          />
          <p className="mt-5 mb-3 text-sm font-semibold">Kelompok usia</p>
          <RankBars rows={d.ageRows} empty="Tanggal lahir pasien belum diisi." />
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 md:px-5">
          <h2 className="font-bold">Pasien baru di rentang ini</h2>
          <p className="tnum text-[13px] text-muted">{num(d.newest.length)} pasien</p>
        </div>
        {d.newest.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">Belum ada pasien baru di rentang ini.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line-soft border-t border-line-soft">
            {d.newest.slice(0, 8).map(({ c, first, n }) => (
              <li key={c.id}>
                <Link href={`/pelanggan/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas md:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="truncate text-[13px] text-muted">
                      Sesi pertama {shortDate(first)}
                      {c.source === "online" ? ", booking online" : ""}
                    </p>
                  </div>
                  <span className={cx("tnum shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold", n > 1 ? "bg-jade-mist text-jade-deep" : "bg-line-soft text-ink-2")}>
                    {n > 1 ? `Sudah ${n} sesi` : "1 sesi"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {d.newest.length > 8 && (
          <Link href="/pelanggan" className="block border-t border-line-soft px-4 py-2.5 text-center text-sm font-semibold text-jade hover:bg-canvas">
            Lihat semua pelanggan
          </Link>
        )}
      </Card>
    </div>
  );
}

/** How evenly the month's patients are shared out: what the therapist suggestion works from. */
function MonthShare({ day, customers }: { day: string; customers: Row<Customer>[] }) {
  const { staff } = useStaff();
  const month = useMemo(() => monthOf(day), [day]);
  const { rows } = useCollection<Booking>("bookings", spanOf(month.from, month.to));
  const data = useMemo(() => {
    const live = (rows ?? []).filter((b) => b.status !== "cancelled");
    const loads = monthLoads(live);
    const firstKey = new Map(customers.map((c) => [c.id, dateKey(c.firstSessionAt ?? c.createdAt)]));
    return staff.map((s) => {
      const mine = new Set(live.filter((b) => b.staffId === s.id).map((b) => b.customerId));
      const fresh = [...mine].filter((id) => (firstKey.get(id) ?? "") >= month.from && (firstKey.get(id) ?? "") <= month.to).length;
      return { s, patients: loads.get(s.id)?.patients ?? 0, sessions: loads.get(s.id)?.sessions ?? 0, fresh };
    });
  }, [rows, customers, staff, month]);
  if (!rows || data.length < 2) return null;
  const max = Math.max(1, ...data.map((x) => x.patients));
  const gap = Math.max(...data.map((x) => x.patients)) - Math.min(...data.map((x) => x.patients));
  const label = fromDateKey(day).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold">Pembagian pasien per fisioterapis, {label}</h2>
        <p className="tnum text-[13px] text-muted">
          Selisih terbanyak dan tersedikit: <span className="font-bold text-ink">{num(gap)} pasien</span>
        </p>
      </div>
      <p className="mb-4 text-[13px] text-muted">
        Pasien lama tetap dengan fisioterapisnya. Pasien baru disarankan ke fisioterapis berjenis kelamin sama dengan pasien paling sedikit bulan ini. Termasuk booking yang belum berlangsung.
      </p>
      <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {data.map((x) => (
          <li key={x.s.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: staffColor(x.s.color).dot }} />
                <span className="truncate">{x.s.name}</span>
                {x.s.gender && <span className="text-[12px] font-medium text-muted">{x.s.gender === "L" ? "pria" : "wanita"}</span>}
              </span>
              <span className="tnum shrink-0">
                <span className="font-bold">{num(x.patients)} pasien</span>
                <span className="ml-2 text-[12px] text-muted">
                  {num(x.fresh)} baru, {num(x.sessions)} sesi
                </span>
              </span>
            </div>
            <div className="mt-1.5 h-2">
              <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(1.5, (x.patients / max) * 100)}%`, background: VIZ.returning }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
