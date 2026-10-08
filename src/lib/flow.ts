import { store, type Row } from "./store";
import { createBooking } from "./actions";
import { INVERSE, relationLabel } from "./relations";
import { dateKey, time } from "./format";
import type { Booking, Customer, CustomerLink, Gender, PatientProfile, RelationKind, Service, Staff, Visit } from "./types";

/* ---------------- Rooms and beds ---------------- */

export interface Bed {
  id: string;
  label: string;
  room: number;
  /** Spot in the room's floor plan: row 0 is against the back wall; col counts from the left, halves sit between. */
  row: number;
  col: number;
}

export const ROOMS = [
  { id: 1, name: "Ruang 1" },
  { id: 2, name: "Ruang 2" },
];

/* The clinic as seen from the entrance: Ruang 1 at the back with 2 beds along the back wall and
   3 in front of them, then Ruang 2 (a little narrower, flush right) with 2 beds. */
export const BEDS: Bed[] = [
  { id: "b1", label: "Bed 1", room: 1, row: 0, col: 0.5 },
  { id: "b2", label: "Bed 2", room: 1, row: 0, col: 1.5 },
  { id: "b3", label: "Bed 3", room: 1, row: 1, col: 0 },
  { id: "b4", label: "Bed 4", room: 1, row: 1, col: 1 },
  { id: "b5", label: "Bed 5", room: 1, row: 1, col: 2 },
  { id: "b6", label: "Bed 6", room: 2, row: 0, col: 0 },
  { id: "b7", label: "Bed 7", room: 2, row: 0, col: 1 },
];

export const bedLabel = (id?: string | null) => BEDS.find((b) => b.id === id)?.label ?? "";

/* ---------------- Labels ---------------- */

export const GENDER_LABEL: Record<Gender, string> = { L: "Laki-laki", P: "Perempuan" };
export const GENDER_SHORT: Record<Gender, string> = { L: "Pria", P: "Wanita" };

export const CONDITIONS: [key: string, label: string][] = [
  ["diabetes", "Diabetes"],
  ["hipertensi", "Hipertensi"],
  ["jantung", "Jantung"],
  ["stroke", "Stroke"],
  ["asma", "Asma"],
  ["kolesterol", "Kolesterol"],
  ["asam_urat", "Asam urat"],
];

export const DOCUMENTS: [key: string, label: string][] = [
  ["xray", "X-Ray"],
  ["mri", "MRI"],
  ["ct", "CT Scan"],
  ["usg", "USG"],
  ["lab", "Laboratorium"],
];

export const SOURCES: [key: string, label: string][] = [
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["facebook", "Facebook"],
  ["google", "Google"],
  ["teman", "Teman / keluarga"],
  ["dokter", "Dokter"],
];

export const labelsOf = (list: [string, string][], keys?: string[], other?: string) =>
  [...(keys ?? []).map((k) => list.find(([x]) => x === k)?.[1] ?? k), ...(other?.trim() ? [other.trim()] : [])];

export function ageFrom(birthDate?: string, at = Date.now()) {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y) return null;
  const now = new Date(at);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** Things a therapist should know before touching the patient. */
export function medicalFlags(p?: PatientProfile) {
  if (!p) return [];
  const flags = labelsOf(CONDITIONS, p.conditions, p.conditionsOther);
  if (p.drugAllergy === "ya") flags.push(`Alergi obat${p.drugAllergyDetail ? `: ${p.drugAllergyDetail}` : ""}`);
  if (p.surgery === "ya") flags.push(`Pernah operasi${p.surgeryDetail ? `: ${p.surgeryDetail}` : ""}`);
  return flags;
}

/* ---------------- Visit state ---------------- */

export type VisitRow = Row<Visit>;

/** Still on the board: not closed. A cancelled visit stays until its shoes are back. */
export const isOpen = (v: Visit) => !v.closedAt;
/** The session part is over (or never happens), only shoes may be left. */
export const isDone = (v: Visit) => v.stage === "finished" || v.stage === "cancelled";
export const peopleCount = (v: Visit) => (v.peopleL || 0) + (v.peopleP || 0);
export const readyForSession = (v: Visit) =>
  v.stage === "waiting" && v.shoes === "changed" && !!v.staffId && !!v.bedId;

/** The booking a patient made for today, when they arrive: still open, not on another visit, the one nearest now. */
export function bookingOnArrival(bookings: Row<Booking>[], visits: Visit[], customerId: string, now: number) {
  const used = new Set(visits.map((v) => v.bookingId).filter(Boolean));
  return (
    bookings
      .filter((b) => b.customerId === customerId && b.status === "booked" && !used.has(b.id))
      .sort((a, b) => Math.abs(a.startAt - now) - Math.abs(b.startAt - now))[0] ?? null
  );
}

export function peopleText(v: Pick<Visit, "peopleL" | "peopleP">) {
  const parts = [];
  if (v.peopleL) parts.push(`${v.peopleL} pria`);
  if (v.peopleP) parts.push(`${v.peopleP} wanita`);
  return parts.join(", ") || "0 orang";
}

/** Which bed is taken by which open visit. A bed frees up when the therapist finishes. */
export function bedOccupancy(visits: VisitRow[]) {
  const m = new Map<string, VisitRow>();
  for (const v of visits) {
    if (!v.bedId || !isOpen(v) || isDone(v)) continue;
    const cur = m.get(v.bedId);
    // If two visits ever point at one bed, the one in session wins.
    if (!cur || (v.stage === "in_session" && cur.stage !== "in_session")) m.set(v.bedId, v);
  }
  return m;
}

/* ---------------- Tasks per role (used for alerts and badges) ---------------- */

export interface Task {
  id: string; // stable per visit + step, so an alert fires once
  visitId: string;
  /** Family walking in together: alerts for the same step are merged. */
  groupId?: string | null;
  title: string;
  body: string;
}

export function tasksFor(
  user: { role: string; staffId?: string },
  visits: VisitRow[],
  staff: Row<Staff>[],
): Task[] {
  const out: Task[] = [];
  const me = staff.find((s) => s.id === user.staffId);
  for (const v of visits) {
    if (!isOpen(v)) continue;
    const who = `${v.customerName} (${peopleText(v)})`;
    const push = (t: Omit<Task, "groupId">) => out.push({ ...t, groupId: v.groupId });
    if (user.role === "cleaning") {
      if (v.shoes === "pending" && !isDone(v))
        push({ id: `${v.id}:shoes-in`, visitId: v.id, title: "Ganti sepatu pasien", body: who });
      if (isDone(v) && v.shoes === "changed")
        push({
          id: `${v.id}:shoes-out`,
          visitId: v.id,
          title: "Kembalikan sepatu",
          body: `${who}${v.shoeRack ? `, rak ${v.shoeRack}` : ""}`,
        });
    } else if (user.role === "therapist") {
      const mine = !!user.staffId && v.staffId === user.staffId;
      if (mine && v.stage === "waiting" && v.bedId)
        push({
          id: `${v.id}:assigned:${v.bedId}`,
          visitId: v.id,
          title: `${v.bookedAt ? "Pasien booking Anda" : "Pasien baru untuk Anda"}, ${bedLabel(v.bedId)}`,
          body: `${v.customerName}${v.complaint ? `: ${v.complaint}` : ""}`,
        });
      // Came for a booking with this therapist: told on arrival, before the desk picks a bed.
      if (mine && v.stage === "waiting" && !v.bedId)
        push({
          id: `${v.id}:arrived`,
          visitId: v.id,
          title: "Pasien booking Anda sudah datang",
          body: `${v.customerName}, booking ${time(v.bookedAt ?? v.arrivedAt)}${v.complaint ? `: ${v.complaint}` : ""}`,
        });
      if (mine && readyForSession(v))
        push({ id: `${v.id}:ready`, visitId: v.id, title: "Pasien siap masuk", body: `${v.customerName}, ${bedLabel(v.bedId)}` });
      if (!v.staffId && v.stage === "waiting" && (!v.therapistGender || !me?.gender || v.therapistGender === me.gender))
        push({
          id: `${v.id}:incoming`,
          visitId: v.id,
          title: `Pasien datang, butuh terapis ${v.therapistGender ? GENDER_SHORT[v.therapistGender].toLowerCase() : ""}`.trim(),
          body: `${v.customerName}${v.complaint ? `: ${v.complaint}` : ""}`,
        });
    } else {
      // Front desk, manager, admin
      if (v.stage === "finished")
        push({ id: `${v.id}:done`, visitId: v.id, title: "Sesi selesai, siap checkout", body: `${v.customerName}, ${v.staffName ?? ""}` });
      if (v.stage === "waiting" && v.shoes === "changed" && !v.intakeDone)
        push({ id: `${v.id}:form`, visitId: v.id, title: "Pasien menunggu formulir", body: v.customerName });
    }
  }
  return out;
}

/* ---------------- Actions ---------------- */

export interface CheckInPerson {
  customer: Row<Customer>;
  gender?: Gender;
  peopleL: number;
  peopleP: number;
  therapistGender: Gender | null;
  complaint?: string;
  /** Today's booking they came for: its therapist is told straight away, and it is the one paid at checkout. */
  booking?: Row<Booking> | null;
}

/**
 * One patient walks in, or a family together. Every relative who also has therapy gets
 * their own visit in the same group, and is linked to the first patient as family.
 */
export async function checkIn(
  lead: CheckInPerson,
  relatives: (CheckInPerson & { relation: RelationKind })[] = [],
  createdBy: string,
) {
  const now = Date.now();
  const groupId = relatives.length ? store.newId("visits") : null;
  const visit = (p: CheckInPerson, relation: RelationKind | null, booking: Row<Booking> | null): Visit => ({
    dateKey: dateKey(now),
    arrivedAt: now,
    customerId: p.customer.id,
    customerName: p.customer.name,
    customerGender: p.gender ?? p.customer.gender,
    peopleL: p.peopleL,
    peopleP: p.peopleP,
    therapistGender: p.therapistGender,
    complaint: p.complaint?.trim() || booking?.notes?.trim() || p.customer.profile?.complaint || undefined,
    // Came for a booking: its therapist and service carry over, so only the bed is left to pick.
    ...(booking
      ? { bookingId: booking.id, bookedAt: booking.startAt, staffId: booking.staffId, staffName: booking.staffName, serviceName: booking.serviceName }
      : {}),
    intakeDone: !!p.customer.profile,
    groupId,
    relation,
    groupLeadName: groupId ? lead.customer.name : null,
    shoes: "pending",
    stage: "waiting",
    createdBy,
  });
  // One transaction: the whole family appears on every screen at once, and links are saved with it.
  const id = groupId ?? store.newId("visits");
  await store.transaction(async (tx) => {
    const people = [lead, ...relatives];
    const fresh = new Map<string, Customer>();
    for (const p of people) {
      const c = await tx.get<Customer>("customers", p.customer.id);
      if (!c) throw new Error(`Pasien ${p.customer.name} tidak ditemukan.`);
      fresh.set(p.customer.id, c);
    }
    // A booking someone started or cancelled a moment ago is left alone.
    const booked = new Map<CheckInPerson, Row<Booking>>();
    for (const p of people) {
      if (!p.booking) continue;
      const b = await tx.get<Booking>("bookings", p.booking.id);
      if (b?.status === "booked") booked.set(p, b);
    }
    const links = new Map<string, CustomerLink[]>([...fresh].map(([cid, c]) => [cid, c.links ?? []]));
    const addLink = (from: string, link: CustomerLink) =>
      links.set(from, [...links.get(from)!.filter((l) => l.id !== link.id), link]);
    for (const r of relatives) {
      addLink(lead.customer.id, { id: r.customer.id, name: r.customer.name, kind: r.relation, at: now });
      addLink(r.customer.id, { id: lead.customer.id, name: lead.customer.name, kind: INVERSE[r.relation], at: now });
    }
    for (const p of people) {
      const patch: Partial<Customer> = {};
      if (p.gender && p.gender !== fresh.get(p.customer.id)!.gender) patch.gender = p.gender;
      if (relatives.length) patch.links = links.get(p.customer.id);
      if (Object.keys(patch).length) tx.update("customers", p.customer.id, patch);
    }
    tx.set("visits", id, visit(lead, null, booked.get(lead) ?? null));
    for (const r of relatives) tx.set("visits", store.newId("visits"), visit(r, r.relation, booked.get(r) ?? null));
  });
  return id;
}

export async function markShoes(v: VisitRow, state: "changed" | "returned", by: string, rack?: string) {
  const now = Date.now();
  if (state === "changed")
    return store.update("visits", v.id, { shoes: "changed", shoeRack: rack?.trim() ?? "", shoesChangedAt: now, shoesChangedBy: by });
  return store.update("visits", v.id, {
    shoes: "returned",
    shoesReturnedAt: now,
    shoesReturnedBy: by,
    // The visit leaves the board once the session is over and the shoes are back.
    closedAt: isDone(v) ? now : null,
  });
}

export async function undoShoes(v: VisitRow) {
  if (v.shoes === "returned")
    return store.update("visits", v.id, { shoes: "changed", shoesReturnedAt: null, shoesReturnedBy: null, closedAt: null });
  return store.update("visits", v.id, { shoes: "pending", shoesChangedAt: null, shoesChangedBy: null });
}

export async function assignVisit(
  v: VisitRow,
  input: { customer: Row<Customer>; staff: Row<Staff>; service: Row<Service>; bedId: string; complaint?: string },
) {
  const complaint = input.complaint?.trim() || v.complaint || "";
  let bookingId = v.bookingId ?? null;
  if (bookingId) {
    await store.update("bookings", bookingId, {
      staffId: input.staff.id,
      staffName: input.staff.name,
      serviceId: input.service.id,
      serviceName: input.service.name,
      price: input.service.price,
      durationMin: input.service.durationMin,
      notes: complaint,
    });
  } else {
    bookingId = await createBooking({
      customer: input.customer,
      staff: input.staff,
      service: input.service,
      startAt: Date.now(),
      durationMin: input.service.durationMin,
      notes: complaint,
    });
  }
  await store.update("visits", v.id, {
    staffId: input.staff.id,
    staffName: input.staff.name,
    serviceName: input.service.name,
    bedId: input.bedId,
    bookingId,
    complaint,
    assignedAt: Date.now(),
  });
}

export async function startVisit(v: VisitRow) {
  const now = Date.now();
  // Booking first: if the therapist isn't allowed, nothing changes.
  if (v.bookingId) await store.update("bookings", v.bookingId, { status: "in_session" });
  await store.update("visits", v.id, { stage: "in_session", startedAt: now });
}

export async function finishVisit(v: VisitRow) {
  const now = Date.now();
  await store.update("visits", v.id, {
    stage: "finished",
    endedAt: now,
    closedAt: v.shoes === "returned" ? now : null,
  });
}

export async function cancelVisit(v: VisitRow) {
  if (v.bookingId && v.stage === "waiting") await store.update("bookings", v.bookingId, { status: "cancelled" });
  // Shoes still in the rack: keep it on the board so cleaning returns them.
  await store.update("visits", v.id, { stage: "cancelled", closedAt: v.shoes === "changed" ? null : Date.now() });
}

/** "Budi, suami Sari" for a relative in a group. */
export function groupText(v: Pick<Visit, "groupId" | "relation" | "groupLeadName" | "customerGender">) {
  if (!v.groupId) return "";
  if (!v.relation) return "Datang bersama keluarga";
  return `${relationLabel(v.relation, v.customerGender)} ${v.groupLeadName ?? ""}`.trim();
}

/** Next medical record number, RM-000001, counted in meta/counters. */
export async function nextMedicalRecordNo() {
  return store.transaction(async (tx) => {
    const counters: Record<string, unknown> = (await tx.get<Record<string, number>>("meta", "counters")) ?? {};
    const n = (Number(counters.rm) || 0) + 1;
    const { id: _omit, ...rest } = counters;
    tx.set("meta", "counters", { ...rest, rm: n });
    return `RM-${String(n).padStart(6, "0")}`;
  });
}

/** Save the registration form onto the customer, and tick the form off on today's visit. */
export async function saveProfile(
  customerId: string | null,
  base: { name: string; phone: string; email?: string; gender?: Gender },
  profile: PatientProfile,
  visitId?: string,
) {
  const data = {
    name: base.name.trim(),
    nameLower: base.name.trim().toLowerCase(),
    phone: base.phone.trim(),
    email: base.email?.trim() ?? "",
    gender: base.gender,
    profile,
    // Also on the patient, so the basic data form shows the same values.
    birthDate: profile.birthDate ?? "",
    nik: profile.ktp ?? "",
    address: profile.address ?? "",
  };
  let id = customerId;
  if (id) await store.update("customers", id, data);
  else id = await store.add("customers", { ...data, createdAt: Date.now(), source: "klinik" } satisfies Customer);
  if (visitId)
    await store.update("visits", visitId, {
      intakeDone: true,
      customerName: data.name,
      customerGender: data.gender,
      ...(profile.complaint ? { complaint: profile.complaint } : {}),
    });
  return id;
}
