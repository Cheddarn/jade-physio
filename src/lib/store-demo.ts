import type { Filter, Row, Store, Tx } from "./store";
import { addDays, atTime, dateKey } from "./format";

type Doc = Record<string, unknown>;
type Data = Record<string, Record<string, Doc>>;

const KEY = "jade-physio-demo-v2";
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

  const d: Data = { staff: {}, services: {}, packages: {}, customers: {}, bookings: {}, vouchers: {}, sales: {}, meta: {}, access: {} };
  const staff = [
    { id: "st1", name: "Ft. Andini", color: "jade" },
    { id: "st2", name: "Ft. Bagus", color: "sky" },
    { id: "st3", name: "Ft. Clara", color: "plum" },
    { id: "st4", name: "Ft. Dimas", color: "amber" },
  ];
  staff.forEach((x, i) => (d.staff[x.id] = { name: x.name, color: x.color, active: true, order: i + 1 }));

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
  ];
  packages.forEach((x) => (d.packages[x.id] = { ...x, id: undefined, active: true }));

  const names = [
    ["Rina Wulandari", "0812 8841 2290"],
    ["Budi Santoso", "0813 1120 4471"],
    ["Siti Rahmawati", "0857 2203 9910"],
    ["Agus Pratama", "0811 9087 3321"],
    ["Dewi Lestari", "0821 4410 7788"],
    ["Hendra Wijaya", "0812 7765 0012"],
    ["Maya Anggraini", "0878 3321 6654"],
    ["Fajar Nugroho", "0819 2208 1147"],
    ["Putri Ayu", "0813 5567 2201"],
    ["Yoga Firmansyah", "0822 9910 3345"],
    ["Lina Kusuma", "0812 3345 8870"],
    ["Rizky Hidayat", "0856 7712 0098"],
  ];
  const now = Date.now();
  const today = dateKey(now);
  const customers = names.map(([name, phone], i) => {
    const id = `cu${i + 1}`;
    d.customers[id] = { name, nameLower: name.toLowerCase(), phone, createdAt: now - (60 - i) * 86_400_000 };
    return { id, name, phone };
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

  d.meta.counters = { [`inv${new Date(now).getFullYear()}`]: inv };
  const since = now - 90 * 86_400_000;
  d.access["admin@jadephysio.id"] = { role: "admin", name: "Admin Demo", addedAt: since };
  d.access["kasir@jadephysio.id"] = { role: "staff", name: "Kasir Demo", addedAt: since + 86_400_000 };
  d.access["andini@jadephysio.id"] = { role: "therapist", name: "Ft. Andini", staffId: "st1", addedAt: since + 2 * 86_400_000 };
  d.access["bagus@jadephysio.id"] = { role: "therapist", name: "Ft. Bagus", staffId: "st2", addedAt: since + 2 * 86_400_000 };
  return JSON.parse(JSON.stringify(d));
}
