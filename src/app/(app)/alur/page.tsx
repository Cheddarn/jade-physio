"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Bell, Box, DoorOpen, Footprints, LayoutGrid, Stethoscope, UserPlus, Volume2, VolumeX } from "lucide-react";
import { Badge, Button, Card, Confirm, Empty, Fab, Field, IconButton, Input, Segmented, Spinner, cx, errorText, useToast } from "@/components/ui";
import { BedPlan, minutesSince } from "@/components/BedPlan";
import { AssignSheet, CheckInSheet, GroupTag, StageBadge, Steps, VisitActions, VisitDetail } from "@/components/FlowSheets";
import { PatientForm } from "@/components/PatientForm";
import { useFlowAlerts } from "@/components/FlowAlerts";
import { QueryAction } from "@/components/QueryAction";
import { useCan, useUser } from "@/lib/auth";
import { useDoc, useMediaQuery, useNow, useStaff } from "@/lib/hooks";
import { GENDER_SHORT, bedLabel, bedOccupancy, isDone, isOpen, markShoes, peopleText, readyForSession, type VisitRow } from "@/lib/flow";
import { groupColor, relationLabel } from "@/lib/relations";
import { longDate, staffColor, time } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Customer } from "@/lib/types";

const BedMap3D = dynamic(() => import("@/components/BedMap3D"), {
  ssr: false,
  loading: () => <Spinner className="h-full" />,
});

const MAP_KEY = "jade-physio-map";
/** The 3D bed map is hidden for now; set to true to bring back the 3D / Denah switch. */
const SHOW_3D = false;
/** The bed map (Denah) is hidden for now; set to true to show it on Alur pasien again. */
const SHOW_BED_MAP = false;

export default function AlurPage() {
  const user = useUser();
  const can = useCan();
  const desk = can("flow.manage");
  const clinical = can("customers.view");
  const now = useNow(15_000);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { staff } = useStaff(true);
  const { visits: rows, tasks, sound, setSound, notifyAllowed, askNotify } = useFlowAlerts();

  const [checkIn, setCheckIn] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [assignBed, setAssignBed] = useState<string | undefined>();
  const [formFor, setFormFor] = useState<{ customerId: string; visitId?: string; fresh?: Row<Customer> } | null>(null);
  const [savedMapMode, setMapModeState] = useState<"3d" | "plan">("3d");
  const mapMode = SHOW_3D ? savedMapMode : "plan";
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MAP_KEY);
      // Phones: the flat plan reads better unless 3D was picked before.
      if (saved === "plan" || (!saved && window.innerWidth < 768)) setMapModeState("plan");
    } catch {
      /* ignore */
    }
  }, []);
  const setMapMode = (m: "3d" | "plan") => {
    setMapModeState(m);
    try {
      window.localStorage.setItem(MAP_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const visits = useMemo(() => (rows ?? []).slice().sort((a, b) => a.arrivedAt - b.arrivedAt), [rows]);
  const open = useMemo(() => visits.filter(isOpen), [visits]);
  const occupancy = useMemo(() => bedOccupancy(visits), [visits]);
  const closedToday = visits.filter((v) => v.closedAt && v.stage === "finished").length;
  const selected = visits.find((v) => v.id === selectedId) ?? null;
  const assigning = visits.find((v) => v.id === assignId) ?? null;

  const columns = [
    { key: "new", title: "Baru datang", hint: "Sepatu, formulir, terapis & bed", items: open.filter((v) => v.stage === "waiting" && !readyForSession(v)) },
    { key: "ready", title: "Siap masuk", hint: "Tinggal dimulai terapis", items: open.filter(readyForSession) },
    { key: "session", title: "Sedang sesi", hint: "Di bed", items: open.filter((v) => v.stage === "in_session") },
    { key: "done", title: "Selesai", hint: "Kembalikan sepatu & checkout", items: open.filter(isDone) },
  ];

  function pickBed(bedId: string) {
    const v = occupancy.get(bedId);
    if (v) return setSelectedId(v.id);
    // Empty bed: the desk can put the next waiting patient there.
    const next = open.find((x) => x.stage === "waiting" && !x.bedId);
    if (desk && next) {
      setAssignBed(bedId);
      setAssignId(next.id);
    }
  }

  const freeBeds = 7 - occupancy.size;
  const inSession = open.filter((v) => v.stage === "in_session").length;
  const waiting = open.filter((v) => v.stage === "waiting").length;

  return (
    <div className="pb-24 md:pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3 px-4 pt-5 pb-4 md:px-8 md:pt-8">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-bold tracking-[-0.01em] md:text-[26px]">Alur pasien</h1>
          <p className="mt-1 text-sm text-muted">{longDate(now)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <IconButton label={sound ? "Matikan suara notifikasi" : "Nyalakan suara notifikasi"} onClick={() => setSound(!sound)}>
            {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </IconButton>
          {notifyAllowed === false && (
            <Button size="sm" variant="secondary" icon={<Bell className="size-3.5" />} onClick={askNotify}>
              Izinkan notifikasi
            </Button>
          )}
          {desk && (
            <span className="hidden md:block">
              <Button icon={<UserPlus className="size-4" />} onClick={() => setCheckIn(true)}>
                Pasien datang
              </Button>
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-4 gap-2 px-4 pb-4 text-[13px] md:flex md:px-8">
        <Pill value={waiting} label="menunggu" />
        <Pill value={inSession} label="sedang sesi" tone="amber" />
        <Pill value={freeBeds} label="bed kosong" tone="jade" />
        <Pill value={closedToday} label="selesai" />
      </div>

      <div className="flex flex-col gap-6 px-4 md:px-8">
        {(user.role === "cleaning" || user.role === "therapist") && (
          <MyTasks role={user.role} tasks={tasks} visits={visits} now={now} onOpen={setSelectedId} onAssign={setAssignId} onForm={() => {}} />
        )}

        {SHOW_BED_MAP && (
          <Card className="overflow-hidden">
            {/* Phones hide the legend, so without the 3D switch this bar would be empty there. */}
            <div className={cx(SHOW_3D ? "flex" : "hidden sm:flex", "items-center justify-between gap-3 border-b border-line-soft px-4 py-2.5")}>
              <div className="flex min-w-0 items-center gap-3 text-[12px] text-muted">
                <Legend color="#e4e8ee" label="Kosong" />
                <Legend color="#f6dfa8" label="Menunggu" />
                <Legend color="var(--color-jade-bead)" label="Sesi (warna terapis)" />
              </div>
              {SHOW_3D && (
                <Segmented
                  size="sm"
                  value={mapMode}
                  onChange={setMapMode}
                  options={[
                    { value: "3d", label: <span className="inline-flex items-center gap-1"><Box className="size-3.5" />3D</span> },
                    { value: "plan", label: <span className="inline-flex items-center gap-1"><LayoutGrid className="size-3.5" />Denah</span> },
                  ]}
                />
              )}
            </div>
            <div className={cx(mapMode === "3d" && "h-[360px] md:h-[520px]", "bg-gradient-to-b from-[#eef4f1] to-surface")}>
              {rows === null ? (
                <Spinner className="h-full" />
              ) : mapMode === "3d" ? (
                <BedMap3D occupancy={occupancy} staff={staff} now={now} onPick={pickBed} compact={!isDesktop} />
              ) : (
                <BedPlan occupancy={occupancy} staff={staff} now={now} onPick={pickBed} />
              )}
            </div>
            {mapMode === "3d" && (
              <p className="border-t border-line-soft px-4 py-2 text-[12px] text-muted">
                Geser untuk memutar, cubit atau scroll untuk zoom. Ketuk bed untuk detail{desk ? ", atau bed kosong untuk menempatkan pasien berikutnya" : ""}.
              </p>
            )}
          </Card>
        )}

        {user.role !== "cleaning" &&
          (rows === null ? (
            <Spinner />
          ) : open.length === 0 ? (
            <Card>
              <Empty
                icon={<DoorOpen className="size-5" />}
                title="Belum ada pasien di klinik"
                body={desk ? "Tekan Pasien datang saat pasien walk-in masuk. Cleaning service dan terapis langsung diberi tahu." : "Pasien yang datang akan muncul di sini."}
                action={desk && <Button icon={<UserPlus className="size-4" />} onClick={() => setCheckIn(true)}>Pasien datang</Button>}
              />
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-4">
              {columns.map((col) => (
                <section key={col.key} className="min-w-0">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-ink-2">
                    {col.title}
                    <span className="tnum rounded-full bg-line-soft px-2 text-xs">{col.items.length}</span>
                  </h2>
                  <p className="mb-2 truncate text-xs text-muted">{col.hint}</p>
                  <div className="flex flex-col gap-2">
                    {col.items.map((v) => (
                      <VisitCard
                        key={v.id}
                        v={v}
                        now={now}
                        staffColorKey={staff.find((s) => s.id === v.staffId)?.color}
                        showComplaint={clinical}
                        onOpen={() => setSelectedId(v.id)}
                        onAssign={() => setAssignId(v.id)}
                        onForm={() => setFormFor({ customerId: v.customerId, visitId: v.id })}
                      />
                    ))}
                    {col.items.length === 0 && (
                      <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[13px] text-muted">Kosong</p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          ))}
      </div>

      {desk && <QueryAction name="baru" run={() => setCheckIn(true)} />}
      {/* Phone: floating check-in */}
      {desk && <Fab label="Pasien datang" icon={<UserPlus className="size-5" />} onClick={() => setCheckIn(true)} />}

      <CheckInSheet
        open={checkIn}
        onClose={() => setCheckIn(false)}
        onDone={(visitId, c) => {
          // New patient: open the registration form right away.
          if (!c.profile) setFormFor({ customerId: c.id, visitId, fresh: c });
        }}
      />
      <AssignSheet
        visit={assigning}
        visits={visits}
        initialBed={assignBed}
        onClose={() => {
          setAssignId(null);
          setAssignBed(undefined);
        }}
      />
      <VisitDetail
        visit={selected}
        visits={visits}
        onOpen={setSelectedId}
        now={now}
        onClose={() => setSelectedId(null)}
        onAssign={(v) => {
          setSelectedId(null);
          setAssignId(v.id);
        }}
        onForm={(v) => {
          setSelectedId(null);
          setFormFor({ customerId: v.customerId, visitId: v.id });
        }}
      />
      <FormLoader value={formFor} onClose={() => setFormFor(null)} />
    </div>
  );
}

/** Opens the registration form with the latest customer data. */
function FormLoader({
  value,
  onClose,
}: {
  value: { customerId: string; visitId?: string; fresh?: Row<Customer> } | null;
  onClose: () => void;
}) {
  const { row, loading } = useDoc<Customer>("customers", value?.customerId);
  const customer = row ?? value?.fresh ?? null;
  return (
    <PatientForm
      open={!!value && (!loading || !!value.fresh)}
      onClose={onClose}
      customer={customer}
      visitId={value?.visitId}
    />
  );
}

/** Phones: a small tile with the number on top. Wider screens: a pill. */
function Pill({ value, label, tone }: { value: number; label: string; tone?: "amber" | "jade" }) {
  return (
    <span
      className={cx(
        "flex min-w-0 flex-col items-center justify-center rounded-xl px-1 py-2 text-center leading-tight font-medium md:h-7 md:shrink-0 md:flex-row md:gap-1.5 md:rounded-full md:px-3 md:py-0",
        tone === "amber" ? "bg-amber-mist text-amber" : tone === "jade" ? "bg-jade-mist text-jade-deep" : "bg-line-soft text-ink-2",
      )}
    >
      <span className="tnum text-lg font-bold md:text-[13px]">{value}</span>
      <span className="text-[11px] md:text-[13px]">{label}</span>
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="hidden items-center gap-1.5 whitespace-nowrap sm:inline-flex">
      <span className="size-2.5 rounded-sm ring-1 ring-ink/10" style={{ background: color }} />
      {label}
    </span>
  );
}

function VisitCard({
  v,
  now,
  staffColorKey,
  showComplaint,
  onOpen,
  onAssign,
  onForm,
}: {
  v: VisitRow;
  now: number;
  staffColorKey?: string;
  showComplaint: boolean;
  onOpen: () => void;
  onAssign: () => void;
  onForm: () => void;
}) {
  const c = staffColor(staffColorKey);
  const waitMin = minutesSince(v.arrivedAt, now);
  return (
    <div
      className="relative rounded-xl border border-line border-l-[3px] bg-surface p-3"
      style={{
        borderLeftColor: v.staffId ? c.dot : "var(--color-line)",
        ...(v.groupId ? { boxShadow: `inset 0 3px 0 ${groupColor(v.groupId)}` } : {}),
      }}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{v.customerName}</p>
            <p className="truncate text-[12px] text-muted">
              {time(v.arrivedAt)}
              {v.stage === "waiting" && <span className={cx(waitMin >= 15 && "font-semibold text-danger")}>, tunggu {waitMin} mnt</span>}
              {v.bedId ? `, ${bedLabel(v.bedId)}` : ""}
            </p>
          </div>
          <StageBadge v={v} />
        </div>
        {v.groupId && <GroupTag v={v} className="mt-1.5" />}
        {showComplaint && v.complaint && <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-2">{v.complaint}</p>}
        <div className="mt-2 flex flex-wrap gap-1">
          <Chip ok={v.shoes !== "pending"} icon={<Footprints className="size-3" />}>
            {v.shoes === "pending" ? peopleText(v) : v.shoes === "returned" ? "Sepatu kembali" : `Rak ${v.shoeRack || "-"}`}
          </Chip>
          <Chip ok={v.intakeDone}>{v.intakeDone ? "Formulir" : "Formulir belum"}</Chip>
          <Chip ok={!!v.staffId} icon={<Stethoscope className="size-3" />}>
            {v.staffName ?? (v.therapistGender ? `Butuh ${GENDER_SHORT[v.therapistGender].toLowerCase()}` : "Terapis?")}
          </Chip>
        </div>
      </button>
      <div className="mt-2.5">
        <VisitActions v={v} size="sm" onAssign={onAssign} onForm={onForm} />
      </div>
    </div>
  );
}

function Chip({ ok, icon, children }: { ok: boolean; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold",
        ok ? "bg-jade-mist text-jade-deep" : "bg-amber-mist text-amber",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Cleaning and therapists: their own to-do list, big buttons first. */
function MyTasks({
  role,
  tasks,
  visits,
  now,
  onOpen,
  onAssign,
  onForm,
}: {
  role: "cleaning" | "therapist";
  tasks: ReturnType<typeof useFlowAlerts>["tasks"];
  visits: VisitRow[];
  now: number;
  onOpen: (id: string) => void;
  onAssign: (id: string) => void;
  onForm: () => void;
}) {
  const user = useUser();
  // A therapist also sees their patients already in session, to press "Sesi selesai".
  const ids = new Set(tasks.map((t) => t.visitId));
  if (role === "therapist")
    visits.filter((v) => isOpen(v) && v.stage === "in_session" && v.staffId === user.staffId).forEach((v) => ids.add(v.id));
  const list = visits.filter((v) => ids.has(v.id));
  if (role === "cleaning") return <ShoeTasks visits={list} onOpen={onOpen} />;
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-2">
        Pasien untuk Anda
        {list.length > 0 && <Badge tone="danger">{list.length}</Badge>}
      </h2>
      {list.length === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted">
          Belum ada pasien untuk Anda. Notifikasi berbunyi saat front desk menugaskan pasien.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((v) => {
            const task = tasks.find((t) => t.visitId === v.id);
            return (
              <Card key={v.id} className="p-4">
                <button type="button" onClick={() => onOpen(v.id)} className="block w-full text-left">
                  <p className="text-[13px] font-bold text-jade">{task?.title ?? "Sedang sesi"}</p>
                  <p className="mt-0.5 text-lg leading-tight font-bold">{v.customerName}</p>
                  {v.groupId && <GroupTag v={v} className="mt-1" />}
                  <p className="mt-1 text-sm text-muted">
                    {v.bedId ? bedLabel(v.bedId) : "Bed belum ditentukan"}
                    {v.serviceName ? `, ${v.serviceName}` : ""}
                  </p>
                  {v.complaint && <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm font-medium">{v.complaint}</p>}
                  <Steps v={v} now={now} compact />
                </button>
                <div className="mt-3">
                  <VisitActions v={v} size="lg" onAssign={() => onAssign(v.id)} onForm={onForm} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Cleaning service: one card per family, so all their shoes are handled in one tap. */
function ShoeTasks({ visits, onOpen }: { visits: VisitRow[]; onOpen: (id: string) => void }) {
  const user = useUser();
  const toast = useToast();
  const [rackFor, setRackFor] = useState<VisitRow[] | null>(null);
  const [rack, setRack] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Same family + same step = one card.
  const cards = new Map<string, { step: "in" | "out"; items: VisitRow[] }>();
  for (const v of visits) {
    const step = v.shoes === "pending" ? "in" : "out";
    const key = `${v.groupId ?? v.id}|${step}`;
    const card = cards.get(key) ?? { step, items: [] };
    card.items.push(v);
    cards.set(key, card);
  }
  const people = (items: VisitRow[]) =>
    peopleText({ peopleL: items.reduce((n, v) => n + (v.peopleL || 0), 0), peopleP: items.reduce((n, v) => n + (v.peopleP || 0), 0) });

  async function returnAll(key: string, items: VisitRow[]) {
    setBusy(key);
    try {
      for (const v of items) await markShoes(v, "returned", user.email);
      toast(`Sepatu ${items.map((v) => v.customerName.split(" ")[0]).join(", ")} dikembalikan`);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-2">
        Tugas sepatu
        {cards.size > 0 && <Badge tone="danger">{cards.size}</Badge>}
      </h2>
      {cards.size === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted">Tidak ada tugas. Notifikasi berbunyi saat pasien datang atau selesai.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {[...cards.entries()].map(([key, { step, items }]) => {
            const group = items[0].groupId;
            const racks = [...new Set(items.map((v) => v.shoeRack).filter(Boolean))];
            return (
              <Card key={key} className="overflow-hidden">
                {group && <div className="h-1.5" style={{ background: groupColor(group) }} />}
                <div className="p-4">
                  <p className="text-[13px] font-bold text-jade">
                    {step === "in" ? "Ganti sepatu pasien" : "Kembalikan sepatu"}
                    {items.length > 1 && <span className="text-ink-2">, rombongan {items.length} pasien</span>}
                  </p>
                  <p className="mt-1 text-2xl leading-tight font-bold">{people(items)}</p>
                  <ul className="mt-2 flex flex-col gap-0.5">
                    {items.map((v) => (
                      <li key={v.id}>
                        <button type="button" onClick={() => onOpen(v.id)} className="text-left text-[15px]">
                          <span className="font-semibold">{v.customerName}</span>
                          <span className="text-muted">
                            {v.relation ? `, ${relationLabel(v.relation, v.customerGender).toLowerCase()}` : ""}
                            {v.peopleL + v.peopleP > 1 ? ` (${peopleText(v)})` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {step === "out" && racks.length > 0 && <p className="mt-1 text-[15px] font-semibold">Rak {racks.join(", ")}</p>}
                  <div className="mt-3">
                    {step === "in" ? (
                      <Button size="lg" block icon={<Footprints className="size-4" />} onClick={() => (setRack(""), setRackFor(items))}>
                        Sepatu sudah diganti{items.length > 1 ? " (semua)" : ""}
                      </Button>
                    ) : (
                      <Button size="lg" block loading={busy === key} icon={<Footprints className="size-4" />} onClick={() => returnAll(key, items)}>
                        Sepatu dikembalikan{items.length > 1 ? " (semua)" : ""}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Confirm
        open={!!rackFor}
        title="Sepatu sudah diganti?"
        body={rackFor ? `${rackFor.map((v) => v.customerName).join(", ")}: ${people(rackFor)}.` : ""}
        confirmLabel="Simpan"
        onClose={() => setRackFor(null)}
        onConfirm={async () => {
          try {
            for (const v of rackFor!) await markShoes(v, "changed", user.email, rack);
            toast("Sepatu sudah diganti. Terapis diberi tahu.");
            setRackFor(null);
          } catch (e) {
            toast(errorText(e), "error");
          }
        }}
      >
        <Field label="No. rak sepatu (opsional)" htmlFor="rack-group">
          <Input id="rack-group" inputMode="numeric" value={rack} onChange={(e) => setRack(e.target.value)} autoFocus />
        </Field>
      </Confirm>
    </section>
  );
}
