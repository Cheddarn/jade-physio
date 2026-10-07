"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ClipboardList,
  FileText,
  Footprints,
  Minus,
  Play,
  Plus,
  RotateCcw,
  ShoppingBag,
  Square,
  Stethoscope,
  UserPlus,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { Badge, Button, Confirm, Field, IconButton, Input, Select, Sheet, Textarea, cx, errorText, useToast } from "./ui";
import { CustomerPicker } from "./CustomerPicker";
import { Choice } from "./PatientForm";
import { useFlowAlerts } from "./FlowAlerts";
import { useCan, useUser } from "@/lib/auth";
import { useDoc, useServices, useStaff } from "@/lib/hooks";
import { canRunSession } from "@/lib/roles";
import {
  BEDS,
  GENDER_LABEL,
  GENDER_SHORT,
  ROOMS,
  ageFrom,
  assignVisit,
  bedLabel,
  bedOccupancy,
  cancelVisit,
  checkIn,
  finishVisit,
  groupText,
  isDone,
  markShoes,
  medicalFlags,
  peopleText,
  readyForSession,
  startVisit,
  undoShoes,
  type VisitRow,
} from "@/lib/flow";
import { duration, rupiah, staffColor, time } from "@/lib/format";
import type { Row } from "@/lib/store";
import { groupColor, relationLabel, relationOptions } from "@/lib/relations";
import type { Customer, Gender, RelationKind } from "@/lib/types";
import { minutesSince } from "./BedPlan";

/* ---------------- Check-in: patient walks in ---------------- */

interface RelativeDraft {
  key: number;
  customer: Row<Customer> | null;
  gender?: Gender;
  relation: RelationKind | "";
  want: Gender | "any";
  complaint: string;
}

export function CheckInSheet({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (visitId: string, customer: Row<Customer>) => void;
}) {
  const toast = useToast();
  const user = useUser();
  const [customer, setCustomer] = useState<Row<Customer> | null>(null);
  const [gender, setGender] = useState<Gender | undefined>();
  const [peopleL, setPeopleL] = useState(0);
  const [peopleP, setPeopleP] = useState(0);
  const [want, setWant] = useState<Gender | "any">("any");
  const [complaint, setComplaint] = useState("");
  const [relatives, setRelatives] = useState<RelativeDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCustomer(null);
      setGender(undefined);
      setPeopleL(0);
      setPeopleP(0);
      setWant("any");
      setComplaint("");
      setRelatives([]);
      setError("");
    }
  }

  function pick(c: Row<Customer> | null) {
    setCustomer(c);
    if (!c) return;
    if (c.gender) choose(c.gender);
    if (c.profile?.complaint && !complaint) setComplaint(c.profile.complaint);
  }
  function choose(g: Gender) {
    setGender(g);
    // One pair of slippers for the patient, and a same-gender therapist by default.
    if (peopleL + peopleP <= 1) {
      setPeopleL(g === "L" ? 1 : 0);
      setPeopleP(g === "P" ? 1 : 0);
    }
    setWant(g);
  }
  const patchRel = (key: number, p: Partial<RelativeDraft>) =>
    setRelatives((list) => list.map((r) => (r.key === key ? { ...r, ...p } : r)));

  async function save() {
    setError("");
    if (!customer) return setError("Pilih atau tambahkan pasien dulu.");
    if (!gender) return setError("Pilih jenis kelamin pasien.");
    if (peopleL + peopleP < 1) return setError("Minimal 1 orang.");
    for (const [i, r] of relatives.entries()) {
      const n = `Kerabat ${i + 1}`;
      if (!r.customer) return setError(`${n}: pilih atau tambahkan pasiennya.`);
      if (r.customer.id === customer.id || relatives.some((x) => x !== r && x.customer?.id === r.customer!.id))
        return setError(`${n}: ${r.customer.name} sudah ada di daftar.`);
      if (!r.gender) return setError(`${n}: pilih jenis kelamin.`);
      if (!r.relation) return setError(`${n}: pilih hubungannya dengan ${customer.name}.`);
    }
    setBusy(true);
    try {
      const id = await checkIn(
        { customer, gender, peopleL, peopleP, therapistGender: want === "any" ? null : want, complaint },
        relatives.map((r) => ({
          customer: r.customer!,
          gender: r.gender,
          // Each relative in therapy needs their own pair of slippers.
          peopleL: r.gender === "L" ? 1 : 0,
          peopleP: r.gender === "P" ? 1 : 0,
          therapistGender: r.want === "any" ? null : r.want,
          complaint: r.complaint,
          relation: r.relation as RelationKind,
        })),
        user.email,
      );
      toast(
        relatives.length
          ? `${customer.name} dan ${relatives.length} kerabat tercatat dan terhubung. Tim sudah diberi tahu.`
          : `${customer.name} tercatat. Cleaning service dan terapis sudah diberi tahu.`,
      );
      onDone(id, { ...customer, gender });
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const formHint = (c: Row<Customer>) =>
    c.profile ? (
      <span className="text-[13px] font-medium text-jade-deep">Formulir sudah ada, {c.profile.medicalRecordNo}</span>
    ) : (
      <span className="text-[13px] font-medium text-amber">Belum isi formulir pasien</span>
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide={relatives.length > 0}
      title="Pasien datang"
      footer={
        <div className="flex flex-col gap-3">
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button size="lg" block loading={busy} onClick={save}>
            {relatives.length ? `Catat ${relatives.length + 1} pasien & beri tahu tim` : "Catat & beri tahu tim"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <Field label="Pasien" hint={!customer ? "Pasien baru: ketik nama lalu tambah. Formulir lengkap diisi setelah ini." : undefined}>
          <CustomerPicker value={customer} onChange={pick} autoFocus hint={formHint} />
        </Field>

        <Field label="Jenis kelamin pasien">
          <Choice
            value={gender}
            onChange={choose}
            options={[
              ["L", GENDER_LABEL.L],
              ["P", GENDER_LABEL.P],
            ]}
          />
        </Field>

        <Field
          label="Jumlah orang (ganti sepatu)"
          hint="Pasien ini dan pendamping yang tidak ikut terapi. Kerabat yang ikut terapi di bawah dihitung sendiri."
        >
          <div className="grid grid-cols-2 gap-3">
            <Stepper label="Pria" value={peopleL} onChange={setPeopleL} />
            <Stepper label="Wanita" value={peopleP} onChange={setPeopleP} />
          </div>
        </Field>

        <Field label="Butuh terapis">
          <Choice
            value={want}
            onChange={setWant}
            options={[
              ["L", "Pria"],
              ["P", "Wanita"],
              ["any", "Siapa saja"],
            ]}
          />
        </Field>

        <Field label="Keluhan singkat" htmlFor="ci-complaint" hint="Langsung terlihat oleh terapis.">
          <Textarea id="ci-complaint" value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="mis. Nyeri lutut kanan sejak 2 minggu" />
        </Field>

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-[15px] font-bold">
              <Users className="size-4 text-jade" />
              Kerabat yang juga ikut terapi
            </h3>
            <p className="text-[13px] text-muted">
              Masing-masing terdaftar sebagai pasien, mendapat terapis dan bed sendiri, dan terhubung dengan {customer?.name ?? "pasien ini"}.
            </p>
          </div>
          {relatives.map((r, i) => (
            <div key={r.key} className="flex flex-col gap-4 rounded-xl border border-line bg-canvas/60 p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Kerabat {i + 1}</p>
                <IconButton label={`Hapus kerabat ${i + 1}`} className="-my-2 -mr-2 size-9" onClick={() => setRelatives((l) => l.filter((x) => x.key !== r.key))}>
                  <X className="size-4" />
                </IconButton>
              </div>
              <CustomerPicker
                value={r.customer}
                onChange={(c) =>
                  patchRel(r.key, {
                    customer: c,
                    ...(c?.gender ? { gender: c.gender, want: c.gender } : {}),
                    ...(c?.profile?.complaint && !r.complaint ? { complaint: c.profile.complaint } : {}),
                  })
                }
                hint={formHint}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Jenis kelamin">
                  <Choice
                    value={r.gender}
                    onChange={(g) => patchRel(r.key, { gender: g, want: g })}
                    options={[
                      ["L", "Laki-laki"],
                      ["P", "Perempuan"],
                    ]}
                  />
                </Field>
                <Field label={`Hubungan dengan ${customer?.name.split(" ")[0] ?? "pasien"}`} htmlFor={`rel-${r.key}`}>
                  <Select id={`rel-${r.key}`} value={r.relation} onChange={(e) => patchRel(r.key, { relation: e.target.value as RelationKind })}>
                    <option value="">Pilih hubungan</option>
                    {relationOptions().map(([k, label]) => (
                      <option key={k} value={k}>
                        {k === "pasangan" || k === "orang_tua" || k === "kakek_nenek" ? relationLabel(k, r.gender) : label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Butuh terapis">
                <Choice
                  value={r.want}
                  onChange={(w) => patchRel(r.key, { want: w })}
                  options={[
                    ["L", "Pria"],
                    ["P", "Wanita"],
                    ["any", "Siapa saja"],
                  ]}
                />
              </Field>
              <Field label="Keluhan singkat" htmlFor={`rel-c-${r.key}`}>
                <Input id={`rel-c-${r.key}`} value={r.complaint} onChange={(e) => patchRel(r.key, { complaint: e.target.value })} />
              </Field>
            </div>
          ))}
          <Button
            variant="secondary"
            icon={<UserPlus className="size-4" />}
            onClick={() => setRelatives((l) => [...l, { key: Date.now(), customer: null, relation: "", want: "any", complaint: "" }])}
          >
            Tambah kerabat yang ikut terapi
          </Button>
        </section>
      </div>
    </Sheet>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-line px-2 py-1.5">
      <span className="pl-1.5 text-sm font-semibold">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={`Kurangi ${label}`} onClick={() => onChange(Math.max(0, value - 1))} className="flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-line-soft">
          <Minus className="size-4" />
        </button>
        <span className="tnum w-6 text-center text-lg font-bold">{value}</span>
        <button type="button" aria-label={`Tambah ${label}`} onClick={() => onChange(Math.min(20, value + 1))} className="flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-line-soft">
          <Plus className="size-4" />
        </button>
      </span>
    </div>
  );
}

/* ---------------- Assign therapist, service and bed ---------------- */

export function AssignSheet({
  visit,
  visits,
  onClose,
  initialBed,
}: {
  visit: VisitRow | null;
  visits: VisitRow[];
  onClose: () => void;
  initialBed?: string;
}) {
  const toast = useToast();
  const { staff } = useStaff();
  const { services } = useServices();
  const { row: customer } = useDoc<Customer>("customers", visit?.customerId);
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [bedId, setBedId] = useState("");
  const [complaint, setComplaint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = visit ? visit.id : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (visit) {
      setServiceId("");
      setStaffId(visit.staffId ?? "");
      setBedId(visit.bedId ?? initialBed ?? "");
      setComplaint(visit.complaint ?? "");
      setError("");
    }
  }
  // Pre-select the service already on the booking, once services load.
  const svc = services.find((s) => s.id === serviceId) ?? (visit?.serviceName ? services.find((s) => s.name === visit.serviceName) : undefined);

  const occupied = useMemo(() => bedOccupancy(visits.filter((v) => v.id !== visit?.id)), [visits, visit?.id]);
  const load = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of visits) if (v.staffId && !isDone(v) && !v.closedAt) m[v.staffId] = (m[v.staffId] ?? 0) + 1;
    return m;
  }, [visits]);
  const want = visit?.therapistGender;
  const sorted = useMemo(
    () => [...staff].sort((a, b) => Number(want ? b.gender === want : 0) - Number(want ? a.gender === want : 0) || (load[a.id] ?? 0) - (load[b.id] ?? 0)),
    [staff, want, load],
  );

  async function save() {
    setError("");
    const therapist = staff.find((s) => s.id === staffId);
    if (!visit || !customer) return;
    if (!svc) return setError("Pilih layanan.");
    if (!therapist) return setError("Pilih terapis.");
    if (!bedId) return setError("Pilih bed.");
    setBusy(true);
    try {
      await assignVisit(visit, { customer, staff: therapist, service: svc, bedId, complaint });
      toast(`${therapist.name} diberi tahu: ${visit.customerName} di ${bedLabel(bedId)}`);
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={!!visit}
      onClose={onClose}
      title={`Terapis & bed, ${visit?.customerName ?? ""}`}
      footer={
        <div className="flex flex-col gap-3">
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button size="lg" block loading={busy} onClick={save}>
            Simpan & beri tahu terapis
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <Field label="Layanan">
          <div className="grid gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setServiceId(s.id)}
                className={cx(
                  "flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                  svc?.id === s.id ? "border-jade bg-jade-mist/50 ring-1 ring-jade" : "border-line hover:border-ink-2/30",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{s.name}</span>
                  <span className="block text-[13px] text-muted">{duration(s.durationMin)}</span>
                </span>
                <span className="tnum shrink-0 text-sm font-semibold">{rupiah(s.price)}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Terapis"
          hint={want ? `Pasien butuh terapis ${GENDER_SHORT[want].toLowerCase()}. Angka = pasien yang sedang ditangani.` : "Angka = pasien yang sedang ditangani."}
        >
          <div className="flex flex-wrap gap-2">
            {sorted.map((s) => {
              const c = staffColor(s.color);
              const n = load[s.id] ?? 0;
              const off = !!want && !!s.gender && s.gender !== want;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setStaffId(s.id)}
                  className={cx(
                    "flex h-11 items-center gap-2 rounded-full border pr-3.5 pl-2.5 text-sm font-semibold transition-colors",
                    staffId === s.id ? "border-transparent ring-2" : "border-line hover:border-ink-2/30",
                    off && staffId !== s.id && "opacity-50",
                  )}
                  style={staffId === s.id ? { background: c.bg, color: c.fg, ["--tw-ring-color" as string]: c.dot } : undefined}
                >
                  <span className="size-3 rounded-full" style={{ background: c.dot }} />
                  {s.name}
                  {s.gender && <span className="text-xs font-medium opacity-70">{GENDER_SHORT[s.gender]}</span>}
                  {n > 0 && <span className="tnum rounded-full bg-ink/8 px-1.5 text-xs font-bold">{n}</span>}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Bed" hint={visit?.groupId ? "Keluarga ditandai, supaya bisa ditempatkan berdekatan." : undefined}>
          <div className="flex flex-col gap-3">
            {ROOMS.map((room) => (
              <div key={room.id}>
                <p className="mb-1.5 text-xs font-semibold text-muted">{room.name}</p>
                <div className="grid grid-cols-5 gap-2">
                  {BEDS.filter((b) => b.room === room.id).map((b) => {
                    const taken = occupied.get(b.id);
                    const family = !!taken && !!visit?.groupId && taken.groupId === visit.groupId;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        disabled={!!taken}
                        onClick={() => setBedId(b.id)}
                        title={taken ? `Dipakai ${taken.customerName}` : undefined}
                        className={cx(
                          "flex h-14 flex-col items-center justify-center rounded-xl border text-sm font-bold transition-colors disabled:cursor-not-allowed",
                          bedId === b.id ? "border-jade bg-jade-mist text-jade-deep ring-1 ring-jade" : "border-line hover:border-ink-2/30",
                          taken && "bg-canvas text-muted",
                        )}
                      >
                        {b.label.replace("Bed ", "")}
                        <span className="text-[10px] font-semibold" style={family ? { color: groupColor(visit!.groupId!) } : undefined}>
                          {family ? "keluarga" : taken ? "terisi" : "kosong"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Field>

        <Field label="Keluhan untuk terapis" htmlFor="as-complaint">
          <Textarea id="as-complaint" value={complaint} onChange={(e) => setComplaint(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

/* ---------------- Visit detail: what each role can do ---------------- */

/** "Keluarga Sari: Budi (suami)" tag, coloured per group so families stand out on the board. */
export function GroupTag({ v, className }: { v: VisitRow; className?: string }) {
  if (!v.groupId) return null;
  const color = groupColor(v.groupId);
  return (
    <span
      className={cx("inline-flex h-6 max-w-full items-center gap-1 truncate rounded-full px-2 text-[11px] font-bold text-white", className)}
      style={{ background: color }}
      title="Datang bersama keluarga"
    >
      <Users className="size-3 shrink-0" />
      <span className="truncate">{v.relation ? groupText(v) : `Rombongan ${v.customerName.split(" ")[0]}`}</span>
    </span>
  );
}

export function VisitDetail({
  visit,
  visits = [],
  now,
  onClose,
  onAssign,
  onForm,
  onOpen,
}: {
  visit: VisitRow | null;
  /** Today's visits, to list the rest of the family. */
  visits?: VisitRow[];
  onOpen?: (id: string) => void;
  now: number;
  onClose: () => void;
  onAssign: (v: VisitRow) => void;
  onForm: (v: VisitRow) => void;
}) {
  const can = useCan();
  const clinical = can("customers.view");
  const { row: customer } = useDoc<Customer>("customers", clinical ? visit?.customerId : null);
  const [cancelling, setCancelling] = useState(false);
  if (!visit) return null;
  const v = visit;
  const p = customer?.profile;
  const flags = medicalFlags(p);
  const age = ageFrom(p?.birthDate);

  return (
    <>
      <Sheet open onClose={onClose} title="Detail pasien" footer={<VisitActions v={v} onAssign={onAssign} onForm={onForm} onCancel={() => setCancelling(true)} />}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xl leading-tight font-bold">{v.customerName}</p>
            <p className="mt-1 text-sm text-muted">
              {v.customerGender ? GENDER_LABEL[v.customerGender] : ""}
              {age != null ? `, ${age} tahun` : ""}
              {p?.medicalRecordNo ? `, ${p.medicalRecordNo}` : ""}
            </p>
          </div>
          <StageBadge v={v} />
        </div>

        {v.groupId && (
          <div className="mt-3">
            <GroupTag v={v} />
          </div>
        )}

        <Steps v={v} now={now} />

        {v.groupId && (
          <div className="mt-5 rounded-xl border-2 p-3" style={{ borderColor: groupColor(v.groupId) }}>
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
              <Users className="size-4" style={{ color: groupColor(v.groupId) }} />
              Datang bersama
            </p>
            <ul className="mt-1.5 flex flex-col">
              {visits
                .filter((x) => x.groupId === v.groupId && x.id !== v.id)
                .map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => onOpen?.(x.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-1.5 py-1.5 text-left text-sm hover:bg-canvas"
                    >
                      <span className="min-w-0">
                        <span className="font-semibold">{x.customerName}</span>
                        <span className="text-muted">
                          , {x.relation ? relationLabel(x.relation, x.customerGender).toLowerCase() : "pasien utama"}
                          {x.bedId ? `, ${bedLabel(x.bedId)}` : ""}
                          {x.staffName ? `, ${x.staffName}` : ""}
                        </span>
                      </span>
                      <StageBadge v={x} />
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {clinical && (v.complaint || flags.length > 0) && (
          <div className="mt-5 rounded-xl border border-line p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
              <Stethoscope className="size-4 text-jade" />
              Keluhan
            </p>
            <p className="mt-1 text-[15px] font-medium whitespace-pre-line">{v.complaint || "Belum diisi"}</p>
            {p?.complaintSince && <p className="mt-1 text-[13px] text-muted">Sejak {p.complaintSince}</p>}
            {flags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {flags.map((f) => (
                  <Badge key={f} tone="danger">
                    <AlertTriangle className="size-3" />
                    {f}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {clinical && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/pelanggan/${v.customerId}`}>
              <Button size="sm" variant="secondary" icon={<UserRound className="size-3.5" />}>
                Profil pasien
              </Button>
            </Link>
          </div>
        )}

        <ShoeUndo v={v} />
      </Sheet>

      <Confirm
        open={cancelling}
        title="Batalkan kunjungan?"
        body={
          v.shoes === "changed"
            ? `${v.customerName} tidak jadi terapi. Cleaning service tetap diminta mengembalikan sepatunya.`
            : `${v.customerName} tidak jadi terapi.`
        }
        confirmLabel="Batalkan"
        tone="danger"
        onClose={() => setCancelling(false)}
        onConfirm={async () => {
          await cancelVisit(v);
          setCancelling(false);
          onClose();
        }}
      />
    </>
  );
}

export function StageBadge({ v }: { v: VisitRow }) {
  if (v.stage === "cancelled") return <Badge tone="danger">Batal</Badge>;
  if (v.stage === "finished") return <Badge tone="jade">Selesai</Badge>;
  if (v.stage === "in_session")
    return (
      <Badge tone="amber">
        <span className="pulse-dot size-1.5 rounded-full bg-amber" />
        Sedang sesi
      </Badge>
    );
  if (readyForSession(v)) return <Badge tone="jade">Siap masuk</Badge>;
  return <Badge>Baru datang</Badge>;
}

/** Checklist from the door to the bed and back. */
export function Steps({ v, now, compact }: { v: VisitRow; now: number; compact?: boolean }) {
  const want = v.therapistGender ? `butuh ${GENDER_SHORT[v.therapistGender].toLowerCase()}` : "siapa saja";
  const rows: { done: boolean; label: string; detail: string }[] = [
    { done: true, label: "Datang", detail: `${time(v.arrivedAt)}, ${peopleText(v)}` },
    {
      done: v.shoes !== "pending",
      label: v.shoes === "returned" ? "Sepatu dikembalikan" : "Sepatu diganti",
      detail: v.shoes === "pending" ? "Menunggu cleaning service" : v.shoeRack ? `Rak ${v.shoeRack}` : "",
    },
    { done: v.intakeDone, label: "Formulir pasien", detail: v.intakeDone ? "" : "Belum diisi" },
    {
      done: !!v.staffId && !!v.bedId,
      label: "Terapis & bed",
      detail: v.staffId ? `${v.staffName}, ${bedLabel(v.bedId)}` : `Belum ditentukan (${want})`,
    },
    {
      done: v.stage === "in_session" || v.stage === "finished",
      label: v.stage === "finished" ? "Sesi selesai" : "Sesi",
      detail:
        v.stage === "in_session"
          ? `Mulai ${time(v.startedAt!)}, ${minutesSince(v.startedAt, now)} mnt`
          : v.stage === "finished" && v.startedAt && v.endedAt
            ? `${time(v.startedAt)}–${time(v.endedAt)}`
            : "",
    },
  ];
  return (
    <ol className={cx("flex flex-col", compact ? "mt-2 gap-1" : "mt-5 gap-2.5")}>
      {rows.map((r) => (
        <li key={r.label} className="flex items-start gap-2.5 text-sm">
          <span
            className={cx(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
              r.done ? "bg-jade text-white" : "border-2 border-line",
            )}
          >
            {r.done && <Check className="size-3" strokeWidth={3} />}
          </span>
          <span className="min-w-0">
            <span className={cx("font-semibold", !r.done && "text-ink-2")}>{r.label}</span>
            {r.detail && <span className="text-muted">, {r.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The buttons for whoever is looking: cleaning, therapist, or front desk. */
export function VisitActions({
  v,
  onAssign,
  onForm,
  onCancel,
  size = "lg",
}: {
  v: VisitRow;
  onAssign: (v: VisitRow) => void;
  onForm: (v: VisitRow) => void;
  onCancel?: () => void;
  size?: "sm" | "lg";
}) {
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const can = useCan();
  const desk = can("flow.manage");
  const runner = canRunSession(user, { staffId: v.staffId ?? undefined });
  const { reported } = useFlowAlerts();
  const shoes = user.role === "cleaning" || desk;
  const [rackFor, setRackFor] = useState(false);
  const [rack, setRack] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(null);
    }
  }

  const btns: React.ReactNode[] = [];
  if (shoes && v.shoes === "pending" && !isDone(v))
    btns.push(
      <Button key="shoes" size={size} icon={<Footprints className="size-4" />} onClick={() => (setRack(""), setRackFor(true))}>
        Sepatu sudah diganti
      </Button>,
    );
  if (shoes && v.shoes === "changed" && isDone(v))
    btns.push(
      <Button
        key="return"
        size={size}
        loading={busy === "return"}
        icon={<Footprints className="size-4" />}
        onClick={() => run("return", () => markShoes(v, "returned", user.email), `Sepatu ${v.customerName} dikembalikan`)}
      >
        Sepatu dikembalikan{v.shoeRack ? ` (rak ${v.shoeRack})` : ""}
      </Button>,
    );
  if (desk && !v.intakeDone && !isDone(v))
    btns.push(
      <Button key="form" size={size} variant="secondary" icon={<ClipboardList className="size-4" />} onClick={() => onForm(v)}>
        Isi formulir
      </Button>,
    );
  if (desk && v.stage === "waiting")
    btns.push(
      <Button key="assign" size={size} variant={v.staffId ? "secondary" : "primary"} icon={<Stethoscope className="size-4" />} onClick={() => onAssign(v)}>
        {v.staffId ? "Ubah terapis & bed" : "Atur terapis & bed"}
      </Button>,
    );
  if (runner && v.stage === "waiting" && v.staffId && v.bedId)
    btns.push(
      <Button
        key="start"
        size={size}
        variant={readyForSession(v) ? "primary" : "secondary"}
        loading={busy === "start"}
        icon={<Play className="size-4" />}
        onClick={() => run("start", () => startVisit(v), `Sesi ${v.customerName} dimulai`)}
      >
        {readyForSession(v) ? "Mulai sesi" : "Mulai sesi (sepatu belum)"}
      </Button>,
    );
  if (runner && v.stage === "in_session")
    btns.push(
      <Button
        key="finish"
        size={size}
        loading={busy === "finish"}
        icon={<Square className="size-4" />}
        onClick={() =>
          run(
            "finish",
            () => finishVisit(v),
            user.role === "therapist"
              ? `Sesi ${v.customerName} selesai. Jangan lupa buat laporan terapi.`
              : `Sesi ${v.customerName} selesai. Cleaning dan front desk diberi tahu.`,
          )
        }
      >
        Sesi selesai
      </Button>,
    );
  // The physio owes a report for every session.
  if (user.role === "therapist" && v.staffId === user.staffId && v.bookingId && v.stage === "finished" && !reported.has(v.bookingId))
    btns.push(
      <Button key="report" size={size} icon={<FileText className="size-4" />} onClick={() => router.push(`/laporan-terapi?booking=${v.bookingId}`)}>
        Buat laporan terapi
      </Button>,
    );
  if (can("checkout") && v.bookingId && (v.stage === "finished" || v.stage === "in_session"))
    btns.push(
      <Button
        key="checkout"
        size={size}
        variant={v.stage === "finished" ? "primary" : "secondary"}
        icon={<ShoppingBag className="size-4" />}
        onClick={() => router.push(`/checkout?booking=${v.bookingId}`)}
      >
        Checkout
      </Button>,
    );
  if (desk && onCancel && v.stage === "waiting")
    btns.push(
      <Button key="cancel" size={size} variant="ghost" className="text-danger hover:bg-danger-mist hover:text-danger" icon={<XCircle className="size-4" />} onClick={onCancel}>
        Batal
      </Button>,
    );

  return (
    <>
      {btns.length > 0 ? (
        <div className={cx("flex flex-wrap gap-2", size === "lg" && "[&>*]:flex-1")}>{btns}</div>
      ) : size === "lg" ? (
        <p className="py-1 text-center text-sm text-muted">{waitingText(v)}</p>
      ) : null}
      <Confirm
        open={rackFor}
        title="Sepatu sudah diganti?"
        body={`${v.customerName}: ${peopleText(v)}. Isi nomor rak agar mudah dikembalikan.`}
        confirmLabel="Simpan"
        onClose={() => setRackFor(false)}
        onConfirm={async () => {
          try {
            await markShoes(v, "changed", user.email, rack);
            toast(`Sepatu ${v.customerName} sudah diganti. Terapis diberi tahu.`);
            setRackFor(false);
          } catch (e) {
            toast(errorText(e), "error");
          }
        }}
      >
        <Field label="No. rak sepatu (opsional)" htmlFor="rack">
          <Input id="rack" inputMode="numeric" value={rack} onChange={(e) => setRack(e.target.value)} autoFocus />
        </Field>
      </Confirm>
    </>
  );
}

function waitingText(v: VisitRow) {
  if (v.stage === "cancelled") return "Kunjungan dibatalkan.";
  if (v.stage === "finished") return v.shoes === "changed" ? "Menunggu sepatu dikembalikan." : "Selesai.";
  if (v.stage === "in_session") return `Sedang sesi dengan ${v.staffName}.`;
  if (v.shoes === "pending") return "Menunggu cleaning service mengganti sepatu.";
  if (!v.staffId) return "Front desk sedang menentukan terapis dan bed.";
  return `Menunggu ${v.staffName} memulai sesi.`;
}

/** Fix a wrong tap on the shoe step. */
function ShoeUndo({ v }: { v: VisitRow }) {
  const user = useUser();
  const can = useCan();
  const toast = useToast();
  if (v.shoes === "pending" || !(user.role === "cleaning" || can("flow.manage"))) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await undoShoes(v);
          toast("Status sepatu dikembalikan");
        } catch (e) {
          toast(errorText(e), "error");
        }
      }}
      className="mt-6 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-muted hover:bg-line-soft hover:text-ink"
    >
      <RotateCcw className="size-3.5" />
      Batalkan tanda sepatu terakhir
    </button>
  );
}
