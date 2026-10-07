"use client";

import { Pager, usePager } from "@/components/Pager";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Download, Pencil, Store } from "lucide-react";
import { Avatar, Badge, Button, Card, Empty, Field, IconButton, Input, PageHeader, ScrollX, Segmented, Sheet, Spinner, cx, errorText, useToast } from "@/components/ui";
import { AttendanceStatus, ClockCard } from "@/components/Attendance";
import { useCan, useUser } from "@/lib/auth";
import { useCollection, useNow } from "@/lib/hooks";
import { ROLE_LABEL, STAFF_ROLES, normalizeRole } from "@/lib/roles";
import { dateKey, fromDateKey, pad, time } from "@/lib/format";
import {
  OVERTIME_GRACE,
  WEEKDAYS,
  WEEK_ORDER,
  attendanceCsv,
  correctAttendance,
  dot,
  durationLong,
  overtimeAt,
  saveSettings,
  saveTeamMember,
  shiftOn,
  toMin,
  useSettings,
  useTeam,
  workedMin,
} from "@/lib/settings";
import type { Row } from "@/lib/store";
import type { Access, Attendance, DayHours, TeamMember, Week } from "@/lib/types";

type Tab = "hari" | "rekap" | "shift" | "jam";

export default function JadwalKerjaPage() {
  const can = useCan();
  const manage = can("attendance.manage");
  const [tab, setTab] = useState<Tab>("hari");
  useSyncTeamFromAccess();

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <PageHeader title="Jadwal kerja" subtitle="Absen masuk dan pulang, shift tiap staf, lembur, dan jam buka klinik" />
      <div className="flex flex-col gap-5 px-4 md:px-8">
        <ClockCard className="md:max-w-md" />
        <Segmented
          className="w-full md:w-auto"
          value={tab}
          onChange={setTab}
          options={[
            { value: "hari", label: "Hari ini" },
            { value: "rekap", label: manage ? "Rekap lembur" : "Riwayat saya" },
            { value: "shift", label: "Shift" },
            ...(manage ? [{ value: "jam" as const, label: "Jam buka" }] : []),
          ]}
        />
        {tab === "hari" && <Today />}
        {tab === "rekap" && <Recap />}
        {tab === "shift" && <Shifts />}
        {tab === "jam" && manage && <OpeningHours />}
      </div>
    </div>
  );
}

/** Admin only: every login in the access list gets a team entry, so it can have a shift. */
function useSyncTeamFromAccess() {
  const can = useCan();
  const { rows: access } = useCollection<Access>(can("team") ? "access" : null);
  const { team, loading } = useTeam(true);
  useEffect(() => {
    if (!access || loading) return;
    for (const a of access) {
      const role = normalizeRole(a.role);
      if (!role || !STAFF_ROLES.includes(role)) continue;
      const t = team.find((x) => x.id === a.id);
      if (!t) saveTeamMember(a.id, { name: a.name || a.id, role, staffId: a.staffId, active: true, schedule: {} }).catch(() => {});
      else if (t.role !== role || t.name !== (a.name || a.id) || t.staffId !== a.staffId)
        saveTeamMember(a.id, { name: a.name || a.id, role, staffId: a.staffId ?? "" }).catch(() => {});
    }
    for (const t of team) if (t.active && !access.some((a) => a.id === t.id)) saveTeamMember(t.id, { active: false }).catch(() => {});
  }, [access, team, loading]);
}

/* ---------------- Today: who is in, who is on overtime ---------------- */

function Today() {
  const can = useCan();
  const user = useUser();
  const now = useNow(30_000);
  const today = dateKey(now);
  const manage = can("attendance.manage");
  const { team, loading } = useTeam();
  const { rows } = useCollection<Attendance>("attendance", manage ? [["dateKey", "==", today]] : [["email", "==", user.email]]);
  const [edit, setEdit] = useState<Row<Attendance> | null>(null);
  const byEmail = new Map((rows ?? []).filter((a) => a.dateKey === today).map((a) => [a.email, a]));
  const people = manage ? team : team.filter((t) => t.id === user.email);

  if (loading) return <Spinner />;
  if (people.length === 0)
    return (
      <Card>
        <Empty icon={<CalendarClock className="size-5" />} title="Belum ada data staf" body="Admin menambahkan staf di Terapis & akses. Setelah itu shift bisa diatur di sini." />
      </Card>
    );
  const overtime = people.filter((t) => {
    const a = byEmail.get(t.id);
    return a && !a.outAt && overtimeAt(a, now) >= OVERTIME_GRACE;
  }).length;

  return (
    <section>
      {manage && (
        <div className="mb-3 flex flex-wrap gap-2 text-[13px]">
          <Badge tone="jade">{[...byEmail.values()].filter((a) => !a.outAt).length} sedang bekerja</Badge>
          <Badge tone="amber">{overtime} lembur sekarang</Badge>
          <Badge>{people.filter((t) => shiftOn(t, today) && !byEmail.get(t.id)).length} belum absen</Badge>
        </div>
      )}
      {/* Phones: one card per person instead of a wide table. */}
      <Card className="divide-y divide-line-soft md:hidden">
        {people.map((t) => {
          const a = byEmail.get(t.id);
          const shift = a?.shiftEnd ? { start: a.shiftStart ?? "", end: a.shiftEnd } : shiftOn(t, today);
          const late = a && shift?.start && a.inAt > fromDateKey(today).getTime() + toMin(shift.start) * 60_000 + 5 * 60_000;
          return (
            <div key={t.id} className="flex items-start gap-3 px-4 py-3">
              <Avatar name={t.name} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-semibold">
                    {t.name}
                    <span className="ml-1.5 text-[12px] font-normal text-muted">{ROLE_LABEL[t.role]}</span>
                  </p>
                  {a && <AttendanceStatus a={a} now={now} />}
                </div>
                <p className="tnum mt-0.5 text-[13px] text-ink-2">
                  Shift {shift ? `${dot(shift.start)}–${dot(shift.end)}` : "libur"}
                  {a ? (
                    <>
                      {" · "}masuk <b className={cx(late && "text-amber")}>{time(a.inAt)}</b>
                      {" · "}
                      {a.outAt ? (
                        <>
                          pulang <b>{time(a.outAt)}</b>
                        </>
                      ) : (
                        "masih bekerja"
                      )}
                      {" · "}
                      {durationLong(workedMin(a, now))}
                    </>
                  ) : (
                    shift && <span className="text-muted"> · belum absen</span>
                  )}
                </p>
                {a?.note && <p className="mt-0.5 truncate text-[12px] text-muted">{a.note}</p>}
              </div>
              {manage && a && (
                <IconButton label={`Koreksi jam ${t.name}`} className="-my-1 size-9" onClick={() => setEdit(a)}>
                  <Pencil className="size-4" />
                </IconButton>
              )}
            </div>
          );
        })}
      </Card>
      <Card className="hidden overflow-hidden md:block">
        <ScrollX label="Absensi hari ini">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line-soft text-left text-[12px] text-muted">
                <th className="px-4 py-2.5 font-semibold">Staf</th>
                <th className="px-2 py-2.5 font-semibold">Shift</th>
                <th className="px-2 py-2.5 font-semibold">Masuk</th>
                <th className="px-2 py-2.5 font-semibold">Pulang</th>
                <th className="px-2 py-2.5 font-semibold">Lama kerja</th>
                <th className="px-2 py-2.5 font-semibold">Status</th>
                {manage && <th />}
              </tr>
            </thead>
            <tbody>
              {people.map((t) => {
                const a = byEmail.get(t.id);
                const shift = a?.shiftEnd ? { start: a.shiftStart ?? "", end: a.shiftEnd } : shiftOn(t, today);
                const late = a && shift?.start && a.inAt > fromDateKey(today).getTime() + toMin(shift.start) * 60_000 + 5 * 60_000;
                return (
                  <tr key={t.id} className="border-b border-line-soft align-middle last:border-0">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <Avatar name={t.name} size={34} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{t.name}</span>
                          <span className="block truncate text-[12px] text-muted">{ROLE_LABEL[t.role]}</span>
                        </span>
                      </span>
                    </td>
                    <td className="tnum px-2 py-3 text-ink-2">{shift ? `${dot(shift.start)}–${dot(shift.end)}` : "Libur"}</td>
                    <td className="tnum px-2 py-3">
                      {a ? (
                        <span className={cx("font-bold", late && "text-amber")} title={late ? "Lewat dari jam mulai shift" : undefined}>
                          {time(a.inAt)}
                        </span>
                      ) : (
                        <span className="text-muted">{shift ? "Belum absen" : "–"}</span>
                      )}
                    </td>
                    <td className="tnum px-2 py-3 font-bold">{a?.outAt ? time(a.outAt) : a ? <span className="font-normal text-muted">masih bekerja</span> : "–"}</td>
                    <td className="tnum px-2 py-3 text-ink-2">{a ? durationLong(workedMin(a, now)) : "–"}</td>
                    <td className="px-2 py-3">
                      {a && <AttendanceStatus a={a} now={now} />}
                      {a?.note && <span className="mt-1 block max-w-48 truncate text-[12px] text-muted">{a.note}</span>}
                    </td>
                    {manage && (
                      <td className="pr-3">
                        {a && (
                          <IconButton label={`Koreksi jam ${t.name}`} onClick={() => setEdit(a)}>
                            <Pencil className="size-4" />
                          </IconButton>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollX>
      </Card>
      <CorrectSheet a={edit} onClose={() => setEdit(null)} />
    </section>
  );
}

/** Manager fixes a clock-in/out, e.g. a forgotten Pulang. */
function CorrectSheet({ a, onClose }: { a: Row<Attendance> | null; onClose: () => void }) {
  const toast = useToast();
  const [inT, setInT] = useState("");
  const [outT, setOutT] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const hm = (ms: number) => new Date(ms).toTimeString().slice(0, 5);
  if ((a?.id ?? null) !== openedFor) {
    setOpenedFor(a?.id ?? null);
    if (a) {
      setInT(hm(a.inAt));
      setOutT(a.outAt ? hm(a.outAt) : "");
      setNote(a.note ?? "");
    }
  }
  return (
    <Sheet
      open={!!a}
      onClose={onClose}
      title={`Koreksi absen ${a?.name ?? ""}`}
      footer={
        <Button
          size="lg"
          block
          loading={busy}
          disabled={!inT}
          onClick={async () => {
            setBusy(true);
            try {
              await correctAttendance(a!, inT, outT || null, note);
              toast("Jam absen dikoreksi, lembur dihitung ulang");
              onClose();
            } catch (e) {
              toast(errorText(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Simpan koreksi
        </Button>
      }
    >
      {a && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            {fromDateKey(a.dateKey).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, shift{" "}
            {dot(a.shiftStart) || "-"}–{dot(a.shiftEnd) || "-"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jam masuk" htmlFor="ca-in">
              <Input id="ca-in" type="time" value={inT} onChange={(e) => setInT(e.target.value)} />
            </Field>
            <Field label="Jam pulang" htmlFor="ca-out" hint="Kosongkan jika masih bekerja">
              <Input id="ca-out" type="time" value={outT} onChange={(e) => setOutT(e.target.value)} />
            </Field>
          </div>
          <Field label="Catatan" htmlFor="ca-note">
            <Input id="ca-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Lupa absen pulang, dikonfirmasi manajer" />
          </Field>
        </div>
      )}
    </Sheet>
  );
}

/* ---------------- Monthly overtime ---------------- */

function Recap() {
  const can = useCan();
  const user = useUser();
  const manage = can("attendance.manage");
  const [month, setMonth] = useState(() => dateKey().slice(0, 7));
  const [edit, setEdit] = useState<Row<Attendance> | null>(null);
  const first = `${month}-01`;
  const d = fromDateKey(first);
  const last = dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const { rows, loading } = useCollection<Attendance>(
    "attendance",
    manage ? [["dateKey", ">=", first], ["dateKey", "<=", last]] : [["email", "==", user.email]],
  );
  const list = (rows ?? []).filter((a) => a.dateKey >= first && a.dateKey <= last);
  const people = useMemo(() => {
    const m = new Map<string, { name: string; role: string; days: number; worked: number; ot: number; otDays: number; open: number; items: Row<Attendance>[] }>();
    for (const a of list) {
      const p = m.get(a.email) ?? { name: a.name, role: a.role, days: 0, worked: 0, ot: 0, otDays: 0, open: 0, items: [] };
      p.days++;
      p.worked += a.outAt ? workedMin(a) : 0;
      p.ot += a.overtimeMin || 0;
      if (a.closing === "overtime") p.otDays++;
      if (!a.outAt && a.dateKey < dateKey()) p.open++;
      p.items.push(a);
      m.set(a.email, p);
    }
    return [...m.entries()].sort((a, b) => b[1].ot - a[1].ot);
  }, [list]);
  const [open, setOpen] = useState<string | null>(null);
  const shift = (n: number) => {
    const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
    setMonth(`${x.getFullYear()}-${pad(x.getMonth() + 1)}`);
  };
  const label = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  function download() {
    const blob = new Blob(["\ufeff" + attendanceCsv(list)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `absensi-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <IconButton label="Bulan sebelumnya" onClick={() => shift(-1)}>
          <ChevronLeft className="size-5" />
        </IconButton>
        <p className="min-w-40 text-center font-bold">{label}</p>
        <IconButton label="Bulan berikutnya" onClick={() => shift(1)}>
          <ChevronRight className="size-5" />
        </IconButton>
        {list.length > 0 && (
          <Button size="sm" variant="secondary" className="ml-auto" icon={<Download className="size-3.5" />} onClick={download}>
            Unduh CSV
          </Button>
        )}
      </div>
      {loading ? (
        <Spinner />
      ) : people.length === 0 ? (
        <Card>
          <Empty icon={<CalendarClock className="size-5" />} title="Belum ada absen di bulan ini" />
        </Card>
      ) : (
        <Card className="divide-y divide-line-soft">
          {people.map(([email, p]) => (
            <div key={email}>
              <button type="button" onClick={() => setOpen(open === email ? null : email)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas">
                <Avatar name={p.name} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block text-[13px] text-muted">
                    {p.days} hari, total kerja {durationLong(p.worked)}, {p.otDays} hari lembur
                    {p.open > 0 && <span className="font-semibold text-danger">, {p.open} lupa absen pulang</span>}
                  </span>
                </span>
                <span className="tnum text-right">
                  <span className={cx("block font-bold", p.ot ? "text-amber" : "text-muted")}>{p.ot ? durationLong(p.ot) : "0"}</span>
                  <span className="block text-xs text-muted">total lembur</span>
                </span>
              </button>
              {open === email && <PersonDays items={p.items} manage={manage} onEdit={setEdit} />}
            </div>
          ))}
        </Card>
      )}
      <CorrectSheet a={edit} onClose={() => setEdit(null)} />
    </section>
  );
}

/** One person's days in the month, newest first, a page at a time. */
function PersonDays({ items, manage, onEdit }: { items: Row<Attendance>[]; manage: boolean; onEdit: (a: Row<Attendance>) => void }) {
  const sorted = useMemo(() => [...items].sort((a, b) => b.dateKey.localeCompare(a.dateKey)), [items]);
  const pager = usePager(sorted, "absen-harian", 10);
  return (
    <div className="bg-canvas/60 px-4 py-2">
      <ScrollX label="Rincian harian">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-muted">
              <th className="py-1.5 pr-2 font-semibold">Tanggal</th>
              <th className="px-2 py-1.5 font-semibold">Shift</th>
              <th className="px-2 py-1.5 font-semibold">Masuk</th>
              <th className="px-2 py-1.5 font-semibold">Pulang</th>
              <th className="px-2 py-1.5 font-semibold">Lama kerja</th>
              <th className="px-2 py-1.5 font-semibold">Lembur</th>
              {manage && <th />}
            </tr>
          </thead>
          <tbody>
            {pager.shown.map((a) => (
              <tr key={a.id} className="tnum border-t border-line-soft align-top">
                <td className="py-1.5 pr-2 font-medium">
                  {fromDateKey(a.dateKey).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
                </td>
                <td className="px-2 py-1.5 text-muted">
                  {dot(a.shiftStart) || "-"}–{dot(a.shiftEnd) || "-"}
                </td>
                <td className="px-2 py-1.5 font-semibold">{time(a.inAt)}</td>
                <td className="px-2 py-1.5 font-semibold">
                  {a.outAt ? time(a.outAt) : <span className={a.dateKey < dateKey() ? "text-danger" : "text-muted"}>{a.dateKey < dateKey() ? "lupa absen" : "…"}</span>}
                </td>
                <td className="px-2 py-1.5">{a.outAt ? durationLong(workedMin(a)) : "–"}</td>
                <td className={cx("px-2 py-1.5", a.closing === "overtime" ? "font-semibold text-amber" : "text-muted")}>
                  {a.closing === "overtime" ? durationLong(a.overtimeMin) : a.outAt ? "normal" : ""}
                  {a.note ? <span className="block font-normal text-muted">{a.note}</span> : null}
                </td>
                {manage && (
                  <td className="py-0.5 text-right">
                    <IconButton label="Koreksi" className="size-8" onClick={() => onEdit(a)}>
                      <Pencil className="size-3.5" />
                    </IconButton>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
      <Pager pager={pager} label="hari" className="py-2" />
    </div>
  );
}

/* ---------------- Weekly shifts ---------------- */

function Shifts() {
  const can = useCan();
  const user = useUser();
  const manage = can("attendance.manage");
  const { team, loading } = useTeam();
  const [edit, setEdit] = useState<Row<TeamMember> | null>(null);
  const people = manage ? team : team.filter((t) => t.id === user.email);
  if (loading) return <Spinner />;
  return (
    <section>
      <p className="mb-3 text-[13px] text-muted">
        Lewat dari jam selesai shift dihitung lembur (toleransi {OVERTIME_GRACE} menit). Staf tanpa shift mengikuti jam buka klinik.
      </p>
      <Card className="overflow-hidden">
        <ScrollX label="Shift mingguan">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line-soft text-left text-[12px] text-muted">
                <th className="px-4 py-2.5 font-semibold">Staf</th>
                {WEEK_ORDER.map((d) => (
                  <th key={d} className="px-1.5 py-2.5 text-center font-semibold">
                    {WEEKDAYS[+d].slice(0, 3)}
                  </th>
                ))}
                {manage && <th />}
              </tr>
            </thead>
            <tbody>
              {people.map((t) => (
                <tr key={t.id} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-[12px] text-muted">{ROLE_LABEL[t.role]}</p>
                  </td>
                  {WEEK_ORDER.map((d) => {
                    const s = t.schedule?.[d];
                    return (
                      <td key={d} className="px-1 py-2 text-center">
                        {s ? (
                          <span className="tnum inline-block rounded-md bg-jade-mist px-1.5 py-1 text-[12px] leading-tight font-semibold text-jade-deep">
                            {dot(s.start)}
                            <br />
                            {dot(s.end)}
                          </span>
                        ) : (
                          <span className="text-[12px] text-muted">{t.schedule && Object.keys(t.schedule).length ? "Libur" : "–"}</span>
                        )}
                      </td>
                    );
                  })}
                  {manage && (
                    <td className="pr-3">
                      <IconButton label={`Ubah shift ${t.name}`} onClick={() => setEdit(t)}>
                        <Pencil className="size-4" />
                      </IconButton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      </Card>
      <ShiftSheet member={edit} onClose={() => setEdit(null)} />
    </section>
  );
}

function WeekEditor({ value, onChange }: { value: Week; onChange: (w: Week) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {WEEK_ORDER.map((d) => {
        const h = value[d];
        const set = (v: DayHours | null) => onChange({ ...value, [d]: v });
        return (
          <div key={d} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => set(h ? null : { start: "08:00", end: "16:00" })}
              aria-pressed={!!h}
              className={cx(
                "h-10 w-24 shrink-0 rounded-[10px] border text-sm font-semibold transition-colors",
                h ? "border-jade bg-jade-mist/60 text-jade-deep" : "border-line text-muted",
              )}
            >
              {WEEKDAYS[+d]}
            </button>
            {h ? (
              <>
                <Input type="time" step={900} aria-label={`Mulai ${WEEKDAYS[+d]}`} value={h.start} onChange={(e) => set({ ...h, start: e.target.value })} className="!h-10" />
                <span className="text-muted">–</span>
                <Input type="time" step={900} aria-label={`Selesai ${WEEKDAYS[+d]}`} value={h.end} onChange={(e) => set({ ...h, end: e.target.value })} className="!h-10" />
              </>
            ) : (
              <span className="text-sm text-muted">Libur / tutup</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ShiftSheet({ member, onClose }: { member: Row<TeamMember> | null; onClose: () => void }) {
  const toast = useToast();
  const [week, setWeek] = useState<Week>({});
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if ((member?.id ?? null) !== openedFor) {
    setOpenedFor(member?.id ?? null);
    if (member) setWeek(Object.fromEntries(WEEK_ORDER.map((d) => [d, member.schedule?.[d] ?? null])));
  }
  const invalid = Object.values(week).some((h) => h && h.end <= h.start);
  return (
    <Sheet
      open={!!member}
      onClose={onClose}
      title={`Shift ${member?.name ?? ""}`}
      footer={
        <Button
          size="lg"
          block
          loading={busy}
          disabled={invalid}
          onClick={async () => {
            setBusy(true);
            try {
              await saveTeamMember(member!.id, { schedule: week });
              toast("Shift disimpan");
              onClose();
            } catch (e) {
              toast(errorText(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Simpan shift
        </Button>
      }
    >
      <p className="mb-4 text-sm text-muted">Tiap hari bisa berbeda. Ketuk nama hari untuk menandai libur.</p>
      <WeekEditor value={week} onChange={setWeek} />
      {invalid && <p className="mt-3 text-sm text-danger">Jam selesai harus setelah jam mulai.</p>}
    </Sheet>
  );
}

/* ---------------- Clinic opening hours ---------------- */

function OpeningHours() {
  const toast = useToast();
  const { settings, loading } = useSettings();
  const [week, setWeek] = useState<Week | null>(null);
  const [busy, setBusy] = useState(false);
  const value = week ?? settings.hours;
  const invalid = Object.values(value).some((h) => h && h.end <= h.start);
  if (loading) return <Spinner />;
  return (
    <section className="max-w-xl">
      <Card className="p-4">
        <p className="mb-4 flex items-center gap-2 font-semibold">
          <Store className="size-4 text-jade" />
          Jam buka klinik
        </p>
        <WeekEditor value={value} onChange={setWeek} />
        {invalid && <p className="mt-3 text-sm text-danger">Jam tutup harus setelah jam buka.</p>}
        <p className="mt-4 text-[13px] text-muted">Dipakai kalender (jam di luar ini diarsir) dan sebagai shift default staf yang belum punya shift.</p>
        <Button
          className="mt-4"
          loading={busy}
          disabled={!week || invalid}
          onClick={async () => {
            setBusy(true);
            try {
              await saveSettings({ hours: value });
              setWeek(null);
              toast("Jam buka disimpan");
            } catch (e) {
              toast(errorText(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Simpan jam buka
        </Button>
      </Card>
    </section>
  );
}

