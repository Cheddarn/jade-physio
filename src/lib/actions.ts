import { store, type Row } from "./store";
import { dateKey, remaining, voucherCode } from "./format";
import type {
  Booking,
  BookingStatus,
  Customer,
  Package,
  PaymentMethod,
  Redemption,
  Sale,
  SaleItem,
  Service,
  Staff,
  Voucher,
} from "./types";

/* ---------------- Customers ---------------- */

export async function createCustomer(input: { name: string; phone: string; email?: string; notes?: string }) {
  const data: Customer = {
    name: input.name.trim(),
    nameLower: input.name.trim().toLowerCase(),
    phone: input.phone.trim(),
    email: input.email?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: Date.now(),
  };
  return store.add("customers", data);
}

export async function updateCustomer(id: string, input: { name: string; phone: string; email?: string; notes?: string }) {
  await store.update("customers", id, {
    name: input.name.trim(),
    nameLower: input.name.trim().toLowerCase(),
    phone: input.phone.trim(),
    email: input.email?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
  });
}

/* ---------------- Bookings ---------------- */

export interface BookingInput {
  customer: Row<Customer>;
  staff: Row<Staff>;
  service: Row<Service>;
  startAt: number;
  durationMin: number;
  notes?: string;
  status?: BookingStatus;
}

export async function createBooking(input: BookingInput) {
  const data: Booking = {
    customerId: input.customer.id,
    customerName: input.customer.name,
    customerPhone: input.customer.phone,
    staffId: input.staff.id,
    staffName: input.staff.name,
    serviceId: input.service.id,
    serviceName: input.service.name,
    price: input.service.price,
    startAt: input.startAt,
    durationMin: input.durationMin,
    dateKey: dateKey(input.startAt),
    status: input.status ?? "booked",
    notes: input.notes?.trim() || undefined,
    createdAt: Date.now(),
  };
  return store.add("bookings", data);
}

export async function updateBooking(id: string, input: BookingInput) {
  await store.update("bookings", id, {
    customerId: input.customer.id,
    customerName: input.customer.name,
    customerPhone: input.customer.phone,
    staffId: input.staff.id,
    staffName: input.staff.name,
    serviceId: input.service.id,
    serviceName: input.service.name,
    price: input.service.price,
    startAt: input.startAt,
    durationMin: input.durationMin,
    dateKey: dateKey(input.startAt),
    notes: input.notes?.trim() ?? "",
  });
}

export async function setBookingStatus(id: string, status: BookingStatus) {
  await store.update("bookings", id, { status });
}

/* ---------------- Vouchers ---------------- */

export const isExpired = (v: Voucher, at = Date.now()) => v.expiresAt != null && v.expiresAt < at;

export function voucherState(v: Voucher): "active" | "used" | "expired" | "void" {
  if (v.status === "void") return "void";
  if (remaining(v) === 0) return "used";
  if (isExpired(v)) return "expired";
  return "active";
}

export const voucherCovers = (v: Voucher, serviceId: string) =>
  v.serviceIds.length === 0 || v.serviceIds.includes(serviceId);

export async function issueVoucherManual(input: {
  customer: Row<Customer>;
  name: string;
  serviceIds: string[];
  totalSessions: number;
  usedSessions: number;
  pricePaid: number;
  expiresAt: number | null;
  note?: string;
}) {
  const v: Voucher = {
    code: voucherCode(),
    customerId: input.customer.id,
    customerName: input.customer.name,
    name: input.name.trim(),
    serviceIds: input.serviceIds,
    totalSessions: input.totalSessions,
    usedSessions: Math.min(input.usedSessions, input.totalSessions),
    pricePaid: input.pricePaid,
    purchasedAt: Date.now(),
    expiresAt: input.expiresAt,
    status: input.usedSessions >= input.totalSessions ? "used" : "active",
    source: "manual",
    note: input.note?.trim() || undefined,
    redemptions: [],
  };
  return store.add("vouchers", v);
}

export async function voidVoucher(id: string) {
  await store.update("vouchers", id, { status: "void" });
}

/* ---------------- Checkout ---------------- */

export interface CartLine {
  key: string;
  kind: "service" | "package";
  refId: string;
  name: string;
  unitPrice: number;
  qty: number;
  staffId?: string;
  staffName?: string;
  bookingId?: string;
  /** existing voucher id, or "new:<lineKey>" for a package bought in this same checkout */
  voucherId?: string;
}

export interface CheckoutInput {
  customer: Row<Customer>;
  bookingId?: string;
  lines: CartLine[];
  discount: number;
  paymentMethod: PaymentMethod | null;
  paymentRef?: string;
  packages: Record<string, Row<Package>>;
  createdBy: string;
  createdByName?: string;
}

export function cartTotals(lines: CartLine[], discount: number) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const covered = lines.reduce((s, l) => s + (l.voucherId ? l.unitPrice * l.qty : 0), 0);
  const payable = subtotal - covered;
  const disc = Math.max(0, Math.min(discount || 0, payable));
  return { subtotal, covered, discount: disc, total: payable - disc };
}

export async function checkout(input: CheckoutInput) {
  const now = Date.now();
  const year = new Date(now).getFullYear();
  const totals = cartTotals(input.lines, input.discount);
  if (totals.total > 0 && !input.paymentMethod) throw new Error("Pilih metode pembayaran.");

  const saleId = store.newId("sales");
  // Pre-allocate ids for vouchers bought in this checkout.
  const newVoucherIds: Record<string, string[]> = {};
  for (const l of input.lines) {
    if (l.kind === "package") newVoucherIds[l.key] = Array.from({ length: l.qty }, () => store.newId("vouchers"));
  }

  return store.transaction(async (tx) => {
    // ---- reads (all reads must happen before writes) ----
    const counters: Record<string, unknown> = (await tx.get<Record<string, number>>("meta", "counters")) ?? {};
    const usedExisting = new Map<string, number>();
    for (const l of input.lines) {
      if (l.voucherId && !l.voucherId.startsWith("new:")) {
        usedExisting.set(l.voucherId, (usedExisting.get(l.voucherId) ?? 0) + l.qty);
      }
    }
    const vouchers = new Map<string, Row<Voucher>>();
    for (const id of usedExisting.keys()) {
      const v = await tx.get<Voucher>("vouchers", id);
      if (!v) throw new Error("Voucher tidak ditemukan.");
      if (voucherState(v) !== "active") throw new Error(`Voucher ${v.code} sudah tidak aktif.`);
      if (remaining(v) < usedExisting.get(id)!) throw new Error(`Sisa sesi voucher ${v.code} tidak cukup.`);
      vouchers.set(id, v);
    }
    const bookingIds = [...new Set(input.lines.map((l) => l.bookingId).filter(Boolean))] as string[];
    for (const id of bookingIds) {
      const b = await tx.get<Booking>("bookings", id);
      if (b?.status === "paid") throw new Error("Booking ini sudah dibayar.");
    }

    // ---- writes ----
    const n = (Number(counters[`inv${year}`]) || 0) + 1;
    const invoiceNo = `INV/${year}/${String(n).padStart(5, "0")}`;
    const { id: _omit, ...counterData } = counters;
    tx.set("meta", "counters", { ...counterData, [`inv${year}`]: n });

    // New vouchers from packages sold now
    const newVoucherUse = new Map<string, Redemption[]>();
    for (const l of input.lines) {
      if (l.voucherId?.startsWith("new:")) {
        const pkgKey = l.voucherId.slice(4);
        const vid = newVoucherIds[pkgKey]?.[0];
        if (!vid) throw new Error("Paket untuk voucher baru tidak ada di keranjang.");
        const list = newVoucherUse.get(vid) ?? [];
        for (let i = 0; i < l.qty; i++)
          list.push({ saleId, invoiceNo, bookingId: l.bookingId, serviceName: l.name, staffName: l.staffName, at: now });
        newVoucherUse.set(vid, list);
      }
    }

    const items: SaleItem[] = input.lines.map((l) => {
      let voucherId = l.voucherId;
      let voucherCode: string | undefined;
      if (voucherId?.startsWith("new:")) voucherId = newVoucherIds[voucherId.slice(4)]?.[0];
      if (voucherId && vouchers.has(voucherId)) voucherCode = vouchers.get(voucherId)!.code;
      return {
        kind: l.kind,
        refId: l.refId,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        amount: l.voucherId ? 0 : l.unitPrice * l.qty,
        staffId: l.staffId,
        staffName: l.staffName,
        bookingId: l.bookingId,
        voucherId,
        voucherCode,
        issuedVoucherIds: l.kind === "package" ? newVoucherIds[l.key] : undefined,
      };
    });

    for (const l of input.lines) {
      if (l.kind !== "package") continue;
      const pkg = input.packages[l.refId];
      if (!pkg) throw new Error("Paket tidak ditemukan.");
      for (const vid of newVoucherIds[l.key]) {
        const used = newVoucherUse.get(vid) ?? [];
        const code = voucherCode();
        const item = items.find((i) => i.voucherId === vid);
        if (item) item.voucherCode = code;
        const v: Voucher = {
          code,
          customerId: input.customer.id,
          customerName: input.customer.name,
          packageId: pkg.id,
          name: pkg.name,
          serviceIds: pkg.serviceIds,
          totalSessions: pkg.sessions,
          usedSessions: used.length,
          pricePaid: l.unitPrice,
          purchasedAt: now,
          expiresAt: pkg.validityDays > 0 ? now + pkg.validityDays * 86_400_000 : null,
          status: used.length >= pkg.sessions ? "used" : "active",
          source: "sale",
          saleId,
          invoiceNo,
          redemptions: used,
        };
        tx.set("vouchers", vid, v);
      }
    }

    for (const [id, v] of vouchers) {
      const uses = input.lines
        .filter((l) => l.voucherId === id)
        .flatMap((l) =>
          Array.from({ length: l.qty }, () => ({
            saleId,
            invoiceNo,
            bookingId: l.bookingId,
            serviceName: l.name,
            staffName: l.staffName,
            at: now,
          })),
        );
      const usedSessions = v.usedSessions + uses.length;
      tx.update("vouchers", id, {
        usedSessions,
        redemptions: [...(v.redemptions ?? []), ...uses],
        status: usedSessions >= v.totalSessions ? "used" : "active",
      });
    }

    const sale: Sale = {
      invoiceNo,
      customerId: input.customer.id,
      customerName: input.customer.name,
      customerPhone: input.customer.phone,
      bookingId: input.bookingId,
      items,
      subtotal: totals.subtotal,
      voucherCovered: totals.covered,
      discount: totals.discount,
      total: totals.total,
      paymentMethod: totals.total > 0 ? input.paymentMethod! : totals.covered > 0 ? "voucher" : input.paymentMethod ?? "qris",
      paymentRef: input.paymentRef?.trim() || undefined,
      status: "paid",
      createdAt: now,
      dateKey: dateKey(now),
      createdBy: input.createdBy,
      createdByName: input.createdByName,
    };
    tx.set("sales", saleId, sale);

    for (const id of bookingIds) tx.update("bookings", id, { status: "paid", saleId, invoiceNo });

    return { saleId, invoiceNo };
  });
}

/** Cancel an invoice and put vouchers/bookings back the way they were. */
export async function voidSale(saleId: string, reason: string) {
  return store.transaction(async (tx) => {
    const sale = await tx.get<Sale>("sales", saleId);
    if (!sale) throw new Error("Faktur tidak ditemukan.");
    if (sale.status === "void") throw new Error("Faktur sudah dibatalkan.");

    const issued = sale.items.flatMap((i) => i.issuedVoucherIds ?? []);
    const redeemedIds = [...new Set(sale.items.map((i) => i.voucherId).filter(Boolean))] as string[];
    const all = [...new Set([...issued, ...redeemedIds])];
    const vouchers = new Map<string, Row<Voucher>>();
    for (const id of all) {
      const v = await tx.get<Voucher>("vouchers", id);
      if (v) vouchers.set(id, v);
    }
    for (const id of issued) {
      const v = vouchers.get(id);
      const usedElsewhere = (v?.redemptions ?? []).some((r) => r.saleId !== saleId);
      if (usedElsewhere) throw new Error(`Voucher ${v!.code} dari faktur ini sudah dipakai di kunjungan lain.`);
    }

    for (const id of issued) {
      if (vouchers.has(id)) tx.update("vouchers", id, { status: "void" });
    }
    for (const id of redeemedIds) {
      if (issued.includes(id)) continue;
      const v = vouchers.get(id);
      if (!v) continue;
      const kept = (v.redemptions ?? []).filter((r) => r.saleId !== saleId);
      tx.update("vouchers", id, {
        redemptions: kept,
        usedSessions: Math.max(0, v.usedSessions - ((v.redemptions ?? []).length - kept.length)),
        status: v.status === "void" ? "void" : "active",
      });
    }
    const bookingIds = [...new Set(sale.items.map((i) => i.bookingId).filter(Boolean))] as string[];
    for (const id of bookingIds) tx.update("bookings", id, { status: "booked", saleId: null, invoiceNo: null });

    tx.update("sales", saleId, { status: "void", voidReason: reason.trim(), voidedAt: Date.now() });
  });
}

/* ---------------- Catalog ---------------- */

export async function saveService(id: string | null, s: Service) {
  if (id) await store.update("services", id, { ...s });
  else await store.add("services", s);
}

export async function savePackage(id: string | null, p: Package) {
  if (id) await store.update("packages", id, { ...p });
  else await store.add("packages", p);
}

export async function saveStaff(id: string | null, s: Staff) {
  if (id) await store.update("staff", id, { ...s });
  else await store.add("staff", s);
}

/** Starter catalogue so a fresh project isn't empty. */
export async function seedCatalog() {
  const staff: Staff[] = [
    { name: "Ft. Andini", color: "jade", active: true, order: 1 },
    { name: "Ft. Bagus", color: "sky", active: true, order: 2 },
    { name: "Ft. Clara", color: "plum", active: true, order: 3 },
  ];
  for (const s of staff) await store.add("staff", s);
  const services: Service[] = [
    { name: "Fisioterapi 60 menit", durationMin: 60, price: 300000, active: true, description: "Asesmen dan terapi" },
    { name: "Terapi nyeri punggung", durationMin: 60, price: 350000, active: true },
    { name: "Sports massage", durationMin: 45, price: 250000, active: true },
    { name: "Terapi pasca-cedera", durationMin: 90, price: 450000, active: true },
  ];
  const ids: string[] = [];
  for (const s of services) ids.push(await store.add("services", s));
  const packages: Package[] = [
    { name: "Paket 5 sesi fisioterapi", sessions: 5, price: 1350000, serviceIds: [ids[0], ids[1]], validityDays: 90, active: true },
    { name: "Paket 10 sesi fisioterapi", sessions: 10, price: 2500000, serviceIds: [ids[0], ids[1]], validityDays: 180, active: true },
  ];
  for (const p of packages) await store.add("packages", p);
}

