import type { Filter, Row, Store, Tx } from "./store";
import { addDays, atTime, dateKey } from "./format";

type Doc = Record<string, unknown>;
type Data = Record<string, Record<string, Doc>>;

const KEY = "jade-physio-demo-v7";
let data: Data | null = null;
const listeners = new Set<() => void>();

const rid = () => Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function load(): Data {
  if (data) return data;
  if (typeof window === "undefined") return (data = {});
  try {
    const raw = window.localStorage.getItem(KEY);
    data = raw ? JSON.parse(raw) : seed();
  } catch {
    data = seed();
  }
  persist();
  return data!;
}

// Another tab (e.g. the cleaning service view) changed the demo data: pick it up live.
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      data = JSON.parse(e.newValue);
      listeners.forEach((l) => l());
    } catch {
      /* ignore */
    }
  });

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked: demo keeps working in memory */
  }
}

function notify() {
  persist();
  listeners.forEach((l) => l());
}

function matches(doc: Doc, filters: Filter[]) {
  return filters.every(([f, op, v]) => {
    const x = doc[f] as never;
    switch (op) {
      case "==":
        return x === v;
      case ">=":
        return x >= (v as never);
      case "<=":
        return x <= (v as never);
      case "<":
        return x < (v as never);
      case ">":
        return x > (v as never);
    }
  });
}

function rows(col: string, filters: Filter[]) {
  const c = load()[col] ?? {};
  return Object.entries(c)
    .filter(([, d]) => matches(d, filters))
    .map(([id, d]) => ({ id, ...clone(d) }));
}

const put = (col: string, id: string, doc: Doc) => {
  const d = load();
  d[col] ??= {};
  d[col][id] = clone(doc);
};
const patch = (col: string, id: string, p: Doc) => {
  const d = load();
  if (!d[col]?.[id]) throw new Error("Dokumen tidak ditemukan");
  d[col][id] = { ...d[col][id], ...clone(p) };
};

export const demoStore: Store = {
  watch<T>(col: string, filters: Filter[], cb: (rows: Row<T>[]) => void) {
    const run = () => cb(rows(col, filters) as Row<T>[]);
    listeners.add(run);
    queueMicrotask(run);
    return () => void listeners.delete(run);
  },
  watchDoc<T>(col: string, id: string, cb: (row: Row<T> | null) => void) {
    const run = () => {
      const d = load()[col]?.[id];
      cb(d ? ({ id, ...clone(d) } as Row<T>) : null);
    };
    listeners.add(run);
    queueMicrotask(run);
    return () => void listeners.delete(run);
  },
  async list<T>(col: string, filters: Filter[] = []) {
    return rows(col, filters) as Row<T>[];
  },
  async get<T>(col: string, id: string) {
    const d = load()[col]?.[id];
    return d ? ({ id, ...clone(d) } as Row<T>) : null;
  },
  async add(col, doc) {
    const id = rid();
    put(col, id, doc as Doc);
    notify();
    return id;
  },
  async set(col, id, doc) {
    put(col, id, doc as Doc);
    notify();
  },
  async update(col, id, p) {
    patch(col, id, p as Doc);
    notify();
  },
  async remove(col, id) {
    delete load()[col]?.[id];
    notify();
  },
  newId: () => rid(),
  async transaction(fn) {
    const snapshot = clone(load());
    const tx: Tx = {
      async get<T>(col: string, id: string) {
        const d = load()[col]?.[id];
        return d ? ({ id, ...clone(d) } as Row<T>) : null;
      },
      set: (col, id, doc) => put(col, id, doc as Doc),
      update: (col, id, p) => patch(col, id, p as Doc),
    };
    try {
      const r = await fn(tx);
      notify();
      return r;
    } catch (e) {
      data = snapshot;
      throw e;
    }
  },
};

/* ---------------- sample data ---------------- */

function seed(): Data {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

  const d: Data = {
    staff: {}, services: {}, packages: {}, customers: {}, bookings: {}, vouchers: {}, sales: {}, meta: {}, access: {}, visits: {},
    team: {}, attendance: {}, reports: {}, restock: {}, requests: {}, accounts: {}, discounts: {}, receipts: {},
  };
  const staff = [
    { id: "st1", name: "Ft. Andini", color: "jade", gender: "P" },
    { id: "st2", name: "Ft. Bagus", color: "sky", gender: "L" },
    { id: "st3", name: "Ft. Clara", color: "plum", gender: "P" },
    { id: "st4", name: "Ft. Dimas", color: "amber", gender: "L" },
  ];
  staff.forEach((x, i) => (d.staff[x.id] = { name: x.name, color: x.color, gender: x.gender, active: true, order: i + 1 }));

  const services = [
    { id: "sv1", name: "Fisioterapi 60 menit", durationMin: 60, price: 300000 },
    { id: "sv2", name: "Terapi nyeri punggung", durationMin: 60, price: 350000 },
    { id: "sv3", name: "Sports massage", durationMin: 45, price: 250000 },
    { id: "sv4", name: "Terapi pasca-cedera", durationMin: 90, price: 450000 },
    { id: "sv5", name: "Dry needling", durationMin: 30, price: 200000 },
  ];
  services.forEach((x) => (d.services[x.id] = { name: x.name, durationMin: x.durationMin, price: x.price, active: true }));

  const packages = [
    { id: "pk1", name: "Paket 5 sesi fisioterapi", sessions: 5, price: 1350000, serviceIds: ["sv1", "sv2"], validityDays: 90 },
    { id: "pk2", name: "Paket 10 sesi fisioterapi", sessions: 10, price: 2500000, serviceIds: ["sv1", "sv2"], validityDays: 180 },
    { id: "pk3", name: "Paket 4 sesi sports massage", sessions: 4, price: 900000, serviceIds: ["sv3"], validityDays: 60 },
    { id: "pk4", name: "Paket 1 sesi fisioterapi", sessions: 1, price: 300000, serviceIds: ["sv1", "sv2"], validityDays: 30 },
  ];
  packages.forEach((x) => (d.packages[x.id] = { ...x, id: undefined, active: true }));

  const names = [
    ["Rina Wulandari", "0812 8841 2290", "P"],
    ["Budi Santoso", "0813 1120 4471", "L"],
    ["Siti Rahmawati", "0857 2203 9910", "P"],
    ["Agus Pratama", "0811 9087 3321", "L"],
    ["Dewi Lestari", "0821 4410 7788", "P"],
    ["Hendra Wijaya", "0812 7765 0012", "L"],
    ["Maya Anggraini", "0878 3321 6654", "P"],
    ["Fajar Nugroho", "0819 2208 1147", "L"],
    ["Putri Ayu", "0813 5567 2201", "P"],
    ["Yoga Firmansyah", "0822 9910 3345", "L"],
    ["Lina Kusuma", "0812 3345 8870", "P"],
    ["Rizky Hidayat", "0856 7712 0098", "L"],
  ];
  const complaints = [
    "Nyeri punggung bawah setelah angkat galon",
    "Lutut kanan sakit saat naik tangga",
    "Bahu kiri kaku, susah angkat tangan",
    "Leher tegang dan pusing",
    "Pemulihan ACL pasca operasi",
    "Pergelangan kaki terkilir saat futsal",
  ];
  const now = Date.now();
  const today = dateKey(now);
  const customers = names.map(([name, phone, gender], i) => {
    const id = `cu${i + 1}`;
    const createdAt = now - (60 - i) * 86_400_000;
    d.customers[id] = {
      name, nameLower: name.toLowerCase(), phone, gender, createdAt,
      ...(i < 8 ? { profile: {
        medicalRecordNo: `RM-${String(i + 1).padStart(6, "0")}`, registeredAt: createdAt,
        birthPlace: "Medan", birthDate: `${1970 + ((i * 7) % 35)}-0${(i % 9) + 1}-1${i % 9}`,
        address: "Jl. Gatot Subroto, Medan", occupation: pick(["Karyawan swasta", "Wiraswasta", "Guru", "Mahasiswa"]),
        heightCm: 155 + ((i * 5) % 30), weightKg: 50 + ((i * 7) % 35), firstVisit: "tidak", insurance: "tidak",
        complaint: complaints[i % complaints.length], complaintSince: "2 minggu",
        injury: i % 3 === 0 ? "ya" : "tidak", surgery: i === 4 ? "ya" : "tidak", surgeryDetail: i === 4 ? "Rekonstruksi ACL 2025" : "",
        conditions: i % 4 === 1 ? ["hipertensi"] : i % 4 === 2 ? ["diabetes", "kolesterol"] : [],
        drugAllergy: i === 2 ? "ya" : "tidak", drugAllergyDetail: i === 2 ? "Ibuprofen" : "",
        routineMeds: "tidak", sources: [pick(["instagram", "google", "teman", "dokter"])], consent: true, consentAt: createdAt,
      } } : {}),
    };
    return { id, name, phone, gender };
  });

  let inv = 0;
  const invNo = () => `INV/${new Date(now).getFullYear()}/${String(++inv).padStart(5, "0")}`;
  const methods = ["qris", "qris", "qris", "transfer", "card"];

  // Active vouchers for some customers
  const vouchers: Record<string, { id: string; used: number; total: number }> = {};
  const addVoucher = (cu: (typeof customers)[number], pk: (typeof packages)[number], used: number, daysAgo: number) => {
    const id = `vo${Object.keys(vouchers).length + 1}`;
    const at = now - daysAgo * 86_400_000;
    const saleId = rid();
    const invoiceNo = invNo();
    d.sales[saleId] = {
      invoiceNo,
      customerId: cu.id,
      customerName: cu.name,
      customerPhone: cu.phone,
      items: [{ kind: "package", refId: pk.id, name: pk.name, qty: 1, unitPrice: pk.price, amount: pk.price, issuedVoucherIds: [id] }],
      subtotal: pk.price,
      voucherCovered: 0,
      discount: 0,
      total: pk.price,
      paymentMethod: pick(["transfer", "qris"]),
      status: "paid",
      createdAt: at,
      dateKey: dateKey(at),
      createdBy: "admin@jadephysio.id",
    };
    const redemptions = Array.from({ length: used }, (_, k) => ({
      saleId: rid(),
      invoiceNo: invNo(),
      serviceName: services.find((s) => s.id === pk.serviceIds[0])!.name,
      staffName: pick(staff).name,
      at: at + (k + 1) * 4 * 86_400_000,
    }));
    d.vouchers[id] = {
      code: `JP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      customerId: cu.id,
      customerName: cu.name,
      packageId: pk.id,
      name: pk.name,
      serviceIds: pk.serviceIds,
      totalSessions: pk.sessions,
      usedSessions: used,
      pricePaid: pk.price,
      purchasedAt: at,
      expiresAt: at + pk.validityDays * 86_400_000,
      status: used >= pk.sessions ? "used" : "active",
      source: "sale",
      saleId,
      invoiceNo,
      redemptions,
    };
    vouchers[cu.id] = { id, used, total: pk.sessions };
  };
  addVoucher(customers[0], packages[0], 2, 12);
  addVoucher(customers[2], packages[1], 6, 40);
  addVoucher(customers[4], packages[2], 1, 8);
  addVoucher(customers[6], packages[0], 4, 25);
  addVoucher(customers[9], packages[1], 3, 18);
  // Two packages running out soon, for the "hampir kedaluwarsa" reminder filter.
  addVoucher(customers[11], packages[2], 1, 52);
  addVoucher(customers[3], packages[0], 2, 84);

  // Past 30 days of paid visits
  for (let day = 30; day >= 1; day--) {
    const key = addDays(today, -day);
    const visits = 5 + Math.floor(rnd() * 7);
    for (let v = 0; v < visits; v++) {
      const cu = pick(customers);
      const sv = pick(services);
      const st = pick(staff);
      const start = atTime(key, `${9 + Math.floor(rnd() * 10)}:${pick(["00", "15", "30", "45"])}`);
      const usesVoucher = !!vouchers[cu.id] && rnd() < 0.45 && ["sv1", "sv2"].includes(sv.id);
      const method = pick(methods);
      const bookingId = rid();
      const saleId = rid();
      const invoiceNo = invNo();
      d.bookings[bookingId] = {
        customerId: cu.id, customerName: cu.name, customerPhone: cu.phone, staffId: st.id, staffName: st.name,
        serviceId: sv.id, serviceName: sv.name, price: sv.price, startAt: start, durationMin: sv.durationMin,
        dateKey: key, status: "paid", saleId, invoiceNo, createdAt: start - 3_600_000,
      };
      d.sales[saleId] = {
        invoiceNo, customerId: cu.id, customerName: cu.name, customerPhone: cu.phone, bookingId,
        items: [{ kind: "service", refId: sv.id, name: sv.name, qty: 1, unitPrice: sv.price, amount: usesVoucher ? 0 : sv.price,
          staffId: st.id, staffName: st.name, bookingId, voucherId: usesVoucher ? vouchers[cu.id].id : undefined }],
        subtotal: sv.price, voucherCovered: usesVoucher ? sv.price : 0, discount: 0, total: usesVoucher ? 0 : sv.price,
        paymentMethod: usesVoucher ? "voucher" : method, status: "paid",
        createdAt: start + sv.durationMin * 60_000, dateKey: key, createdBy: "admin@jadephysio.id",
      };
    }
  }

  // Today's schedule
  const todayPlan: [number, string, string, string, string][] = [
    [0, "st1", "sv1", "08:30", "paid"],
    [1, "st2", "sv3", "09:00", "paid"],
    [2, "st1", "sv2", "09:45", "paid"],
    [3, "st3", "sv4", "10:00", "in_session"],
    [4, "st3", "sv3", "10:30", "in_session"],
    [5, "st1", "sv1", "11:00", "in_session"],
    [6, "st1", "sv5", "11:15", "booked"],
    [7, "st2", "sv2", "11:30", "booked"],
    [8, "st4", "sv1", "13:00", "booked"],
    [9, "st2", "sv1", "14:00", "booked"],
    [10, "st4", "sv4", "14:30", "booked"],
    [11, "st3", "sv5", "15:00", "booked"],
    [0, "st4", "sv3", "16:00", "booked"],
  ];
  for (const [ci, sid, svid, hm, status] of todayPlan) {
    const cu = customers[ci];
    const st = staff.find((x) => x.id === sid)!;
    const sv = services.find((x) => x.id === svid)!;
    const bookingId = rid();
    const startAt = atTime(today, hm);
    const b: Doc = {
      customerId: cu.id, customerName: cu.name, customerPhone: cu.phone, staffId: st.id, staffName: st.name,
      serviceId: sv.id, serviceName: sv.name, price: sv.price, startAt, durationMin: sv.durationMin,
      dateKey: today, status, createdAt: startAt - 7_200_000,
    };
    if (status === "paid") {
      const saleId = rid();
      const invoiceNo = invNo();
      b.saleId = saleId;
      b.invoiceNo = invoiceNo;
      const method = pick(methods);
      d.sales[saleId] = {
        invoiceNo, customerId: cu.id, customerName: cu.name, customerPhone: cu.phone, bookingId,
        items: [{ kind: "service", refId: sv.id, name: sv.name, qty: 1, unitPrice: sv.price, amount: sv.price, staffId: st.id, staffName: st.name, bookingId }],
        subtotal: sv.price, voucherCovered: 0, discount: 0, total: sv.price, paymentMethod: method, status: "paid",
        createdAt: startAt + sv.durationMin * 60_000, dateKey: today, createdBy: "admin@jadephysio.id",
      };
    }
    d.bookings[bookingId] = b;
  }

  // Tomorrow's appointments, for the WhatsApp reminder list.
  const tomorrowPlan: [number, string, string, string][] = [
    [2, "st1", "sv1", "09:00"],
    [6, "st2", "sv2", "10:30"],
    [9, "st3", "sv1", "13:00"],
    [7, "st4", "sv4", "15:30"],
  ];
  for (const [ci, sid, svid, hm] of tomorrowPlan) {
    const cu = customers[ci];
    const st = staff.find((x) => x.id === sid)!;
    const sv = services.find((x) => x.id === svid)!;
    const startAt = atTime(addDays(today, 1), hm);
    d.bookings[rid()] = {
      customerId: cu.id, customerName: cu.name, customerPhone: cu.phone, staffId: st.id, staffName: st.name,
      serviceId: sv.id, serviceName: sv.name, price: sv.price, startAt, durationMin: sv.durationMin,
      dateKey: addDays(today, 1), status: "booked", createdAt: now - 86_400_000,
    };
  }

  // Patient flow right now: one on each step, so every role has something to see.
  const flow: [ci: number, sid: string | null, bed: string | null, stage: string, shoes: string, minsAgo: number, intake: boolean][] = [
    [3, "st3", "b1", "in_session", "changed", 40, true],
    [4, "st3", "b2", "in_session", "changed", 25, true],
    [5, "st1", "b4", "in_session", "changed", 15, true],
    [11, "st2", "b6", "waiting", "changed", 8, true],
    [10, null, null, "waiting", "pending", 2, false],
    [1, "st2", "b3", "finished", "changed", 70, true],
  ];
  for (const [ci, sid, bed, stage, shoes, minsAgo, intake] of flow) {
    const cu = customers[ci];
    const st = staff.find((x) => x.id === sid);
    const arrivedAt = now - (minsAgo + 10) * 60_000;
    let bookingId: string | null = null;
    if (st) {
      const sv = services[ci % 2];
      bookingId = rid();
      d.bookings[bookingId] = {
        customerId: cu.id, customerName: cu.name, customerPhone: cu.phone, staffId: st.id, staffName: st.name,
        serviceId: sv.id, serviceName: sv.name, price: sv.price, startAt: arrivedAt + 5 * 60_000, durationMin: sv.durationMin,
        dateKey: today, status: stage === "waiting" ? "booked" : "in_session", notes: complaints[ci % complaints.length], createdAt: arrivedAt,
      };
    }
    d.visits[rid()] = {
      dateKey: today, arrivedAt, customerId: cu.id, customerName: cu.name, customerGender: cu.gender,
      peopleL: cu.gender === "L" ? 1 : ci === 4 ? 1 : 0, peopleP: cu.gender === "P" ? 1 : 0,
      therapistGender: cu.gender, complaint: complaints[ci % complaints.length], intakeDone: intake,
      shoes, shoeRack: shoes === "changed" ? String(ci + 1) : "", shoesChangedAt: shoes === "changed" ? arrivedAt + 2 * 60_000 : null,
      staffId: st?.id ?? null, staffName: st?.name ?? null, bedId: bed, bookingId,
      serviceName: st ? services[ci % 2].name : null, assignedAt: st ? arrivedAt + 4 * 60_000 : null,
      stage, startedAt: stage !== "waiting" ? now - minsAgo * 60_000 : null,
      endedAt: stage === "finished" ? now - 3 * 60_000 : null, closedAt: null, createdBy: "kasir@jadephysio.id",
    };
  }

  // A family: Dewi came with her husband Hendra, both in therapy now. Their daughter Putri is a patient too.
  const link = (a: number, b: number, kind: string, back: string) => {
    const ca = d.customers[customers[a].id] as { links?: unknown[] };
    const cb = d.customers[customers[b].id] as { links?: unknown[] };
    ca.links = [...(ca.links ?? []), { id: customers[b].id, name: customers[b].name, kind, at: now }];
    cb.links = [...(cb.links ?? []), { id: customers[a].id, name: customers[a].name, kind: back, at: now }];
  };
  link(4, 5, "pasangan", "pasangan");
  link(4, 8, "anak", "orang_tua");
  link(5, 8, "anak", "orang_tua");
  link(4, 0, "saudara", "saudara");
  link(8, 9, "teman", "teman");
  const family = Object.entries(d.visits).filter(([, v]) => [customers[4].id, customers[5].id].includes(v.customerId as string));
  const lead = family.find(([, v]) => v.customerId === customers[4].id)!;
  for (const [, v] of family) {
    v.groupId = lead[0];
    v.groupLeadName = customers[4].name;
    v.relation = v.customerId === customers[5].id ? "pasangan" : null;
    if (v.customerId === customers[4].id) v.peopleL = 0; // the husband has his own visit now
    v.arrivedAt = lead[1].arrivedAt;
  }

  // ---- Settings, team shifts, attendance ----
  const hours = (start: string, end: string) => ({ start, end });
  d.meta.settings = {
    hours: { "1": hours("08:00", "21:00"), "2": hours("08:00", "21:00"), "3": hours("08:00", "21:00"), "4": hours("08:00", "21:00"), "5": hours("08:00", "21:00"), "6": hours("08:00", "17:00"), "0": null },
    reminderDays: 14,
  };
  const week = (start: string, end: string, off: string[]) =>
    Object.fromEntries(["0", "1", "2", "3", "4", "5", "6"].map((k) => [k, off.includes(k) ? null : hours(start, end)]));
  const nowD = new Date(now);
  const minsAgo = (m: number) => now - m * 60_000;
  const hm = (ms: number) => `${String(new Date(ms).getHours()).padStart(2, "0")}:${String(new Date(ms).getMinutes()).padStart(2, "0")}`;
  const team: [string, string, string, string | null, [string, string, string[]]][] = [
    ["admin@jadephysio.id", "Admin Demo", "admin", null, ["08:00", "17:00", ["0"]]],
    ["manajer@jadephysio.id", "Manajer Demo", "manager", null, ["09:00", "18:00", ["0", "6"]]],
    ["kasir@jadephysio.id", "Front Desk Demo", "admin", null, ["08:00", "16:00", ["0"]]],
    ["andini@jadephysio.id", "Ft. Andini", "therapist", "st1", ["08:00", "16:00", ["0"]]],
    ["bagus@jadephysio.id", "Ft. Bagus", "therapist", "st2", ["12:00", "21:00", ["0", "1"]]],
    ["cleaning@jadephysio.id", "Pak Joko", "cleaning", null, ["07:30", "15:30", ["0"]]],
  ];
  for (const [email, name, role, staffId, [st, en, off]] of team) {
    d.team[email] = { name, role, active: true, schedule: week(st, en, off), ...(staffId ? { staffId } : {}) };
  }
  // Past two weeks of clock-ins, with some overtime, plus today.
  for (let back = 13; back >= 0; back--) {
    const key = addDays(today, -back);
    const wd = String(new Date(`${key}T12:00:00`).getDay());
    for (const [email, name, role, , [st, en, off]] of team) {
      if (off.includes(wd) || role === "admin") continue;
      const inAt = atTime(key, st) - Math.floor(rnd() * 15) * 60_000;
      const ot = rnd() < 0.25 ? 20 + Math.floor(rnd() * 70) : 0;
      let outAt: number | null = atTime(key, en) + (ot ? ot : Math.floor(rnd() * 4)) * 60_000;
      if (back === 0) {
        if (inAt > now) continue;
        outAt = null;
      }
      d.attendance[`${email}_${key}`] = {
        email, name, role, dateKey: key, inAt, outAt, shiftStart: st, shiftEnd: en,
        overtimeMin: outAt ? ot : 0, closing: outAt ? (ot >= 5 ? "overtime" : "normal") : null,
        note: ot > 45 ? "Pasien terakhir datang terlambat" : "",
      };
    }
  }
  // Cleaning started early today and is still in past the shift end, to show live overtime.
  if (nowD.getHours() >= 16) {
    d.attendance[`cleaning@jadephysio.id_${today}`] = {
      email: "cleaning@jadephysio.id", name: "Pak Joko", role: "cleaning", dateKey: today, inAt: atTime(today, "07:25"), outAt: null,
      shiftStart: "07:30", shiftEnd: hm(minsAgo(35)), overtimeMin: 0, closing: null,
    };
  }

  // ---- Therapy reports for today's finished sessions (one missing on purpose) ----
  const paidToday = Object.entries(d.bookings).filter(([, b]) => b.dateKey === today && b.status === "paid");
  paidToday.slice(0, -1).forEach(([id, b], i) => {
    d.reports[id] = {
      bookingId: id, visitId: null, customerId: b.customerId, customerName: b.customerName, customerPhone: b.customerPhone,
      staffId: b.staffId, staffName: b.staffName, serviceName: b.serviceName, dateKey: today, sessionAt: b.startAt,
      complaint: complaints[i % complaints.length],
      assessment: "ROM terbatas, nyeri tekan pada otot sekitar, kekuatan otot 4/5.",
      treatment: "TENS 15 menit, manual terapi, stretching dan penguatan ringan.",
      advice: "Kompres hangat 2x sehari 15 menit. Latihan peregangan 3x10 repetisi pagi dan sore.",
      nextVisit: "3 hari lagi, evaluasi nyeri dan ROM.",
      file: null, createdAt: (b.startAt as number) + 70 * 60_000, createdBy: "andini@jadephysio.id",
      updatedAt: (b.startAt as number) + 70 * 60_000, sentAt: i === 0 ? (b.startAt as number) + 90 * 60_000 : null, sentBy: i === 0 ? "kasir@jadephysio.id" : null,
    };
  });

  // ---- Restock: this month, some done ----
  const items: [string, number, string, string, boolean][] = [
    ["Gel USG", 3, "botol", "Alat terapi", true],
    ["Tisu wajah", 2, "box", "Kebersihan", false],
    ["Handuk kecil", 10, "pcs", "Linen & handuk", false],
    ["Elektroda TENS", 4, "pak", "Alat terapi", true],
    ["Sabun cuci tangan", 2, "botol", "Kebersihan", false],
    ["Kertas struk", 5, "roll", "ATK", false],
    ["Kinesio tape", 3, "roll", "Medis & obat", false],
    ["Air mineral galon", 2, "pcs", "Pantry", false],
    ["Sarung bantal", 8, "pcs", "Linen & handuk", false],
  ];
  const people = team.filter(([, , role]) => role !== "admin");
  items.forEach(([item, qty, unit, category, urgent], i) => {
    const back = Math.min(nowD.getDate() - 1, i * 2);
    const key = addDays(today, -back);
    const by = people[i % people.length];
    const createdAt = atTime(key, `${9 + (i % 7)}:${i % 2 ? "30" : "10"}`);
    const done = back > 2 && i % 3 !== 0;
    const doneBy = people[(i + 2) % people.length];
    d.restock[rid()] = {
      item, qty, unit, category, urgent, note: i === 0 ? "Tinggal 1 botol di ruang 1" : "", dateKey: key, createdAt: Math.min(createdAt, now - 3_600_000),
      createdBy: by[0], createdByName: by[1], done, doneAt: done ? createdAt + 86_400_000 : null, doneBy: done ? doneBy[0] : null, doneByName: done ? doneBy[1] : null,
    };
  });

  // ---- Patient portal: Rina's account books for herself and her son ----
  d.accounts["rina@gmail.com"] = {
    name: "Rina Wulandari",
    persons: [
      { id: "self", name: "Rina Wulandari", phone: "0812 8841 2290", gender: "P", relation: "self" },
      { id: "p-kevin", name: "Kevin Pratama", phone: "0812 5550 1188", gender: "L", relation: "anak" },
    ],
    createdAt: now - 20 * 86_400_000,
  };
  const tomorrow = addDays(today, 1);
  const batch = rid();
  const req = (personId: string, personName: string, phone: string, gender: string, relation: string, complaint: string, staffId: string | null, at: number) => ({
    accountEmail: "rina@gmail.com", accountName: "Rina Wulandari", batchId: batch, personId, personName, phone, gender, relation,
    holderPhone: "0812 8841 2290", complaint, serviceId: "sv1", serviceName: "Fisioterapi 60 menit", durationMin: 60,
    staffId, staffName: staffId ? staff.find((x) => x.id === staffId)!.name : null, startAt: at, dateKey: dateKey(at), status: "pending", createdAt: now - 25 * 60_000,
  });
  d.requests[rid()] = req("self", "Rina Wulandari", "0812 8841 2290", "P", "self", "Bahu kiri masih kaku setelah sesi terakhir", "st1", atTime(tomorrow, "10:00"));
  d.requests[rid()] = req("p-kevin", "Kevin Pratama", "0812 5550 1188", "L", "anak", "Cedera lutut saat main basket", "st2", atTime(tomorrow, "10:00"));
  d.access["rina@gmail.com"] = { role: "patient", name: "Rina Wulandari", addedAt: now - 20 * 86_400_000 };

  // ---- Discounts set up by the manager ----
  const disc = (id: string, name: string, type: string, value: number, appliesTo: string, extra: Doc = {}) =>
    (d.discounts[id] = { name, type, value, appliesTo, active: true, maxAmount: 0, validUntil: null, note: "", createdAt: now - 30 * 86_400_000, ...extra });
  disc("dc1", "Member 10%", "percent", 10, "all");
  disc("dc2", "Lansia 15%", "percent", 15, "service", { maxAmount: 75000, note: "Usia 60+, tunjukkan KTP" });
  disc("dc3", "Promo paket Rp 100.000", "flat", 100000, "package", { validUntil: addDays(today, 24) });
  disc("dc4", "Potongan kenalan Rp 25.000", "flat", 25000, "bill");

  d.meta.counters = { [`inv${new Date(now).getFullYear()}`]: inv, rm: 8 };
  const since = now - 90 * 86_400_000;
  d.access["admin@jadephysio.id"] = { role: "admin", name: "Admin Demo", addedAt: since };
  d.access["manajer@jadephysio.id"] = { role: "manager", name: "Manajer Demo", addedAt: since + 3_600_000 };
  d.access["kasir@jadephysio.id"] = { role: "admin", name: "Front Desk Demo", addedAt: since + 86_400_000 };
  d.access["cleaning@jadephysio.id"] = { role: "cleaning", name: "Pak Joko", addedAt: since + 86_400_000 };
  d.access["manajer@jadephysio.id"] ??= { role: "manager", name: "Manajer Demo", addedAt: since };
  d.access["andini@jadephysio.id"] = { role: "therapist", name: "Ft. Andini", staffId: "st1", addedAt: since + 2 * 86_400_000 };
  d.access["bagus@jadephysio.id"] = { role: "therapist", name: "Ft. Bagus", staffId: "st2", addedAt: since + 2 * 86_400_000 };
  return JSON.parse(JSON.stringify(d));
}
