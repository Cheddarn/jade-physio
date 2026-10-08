import { store, type Row } from "./store";
import { dateKey, remaining, voucherCode } from "./format";
import { discountAmount } from "./discounts";
import type {
  Booking,
  BookingStatus,
  Customer,
  Discount,
  Gender,
  Receipt,
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

/** A patient's basic data as the desk fills it in. */
export interface CustomerInput {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  gender?: Gender;
  birthDate?: string;
  nik?: string;
  address?: string;
}

/** Date of birth, KTP and address: the patient's own fields, else what an older registration form recorded. */
export const patientInfo = (c: Pick<Customer, "birthDate" | "nik" | "address" | "profile">) => ({
  birthDate: c.birthDate || c.profile?.birthDate || "",
  nik: c.nik || c.profile?.ktp || "",
  address: c.address || c.profile?.address || "",
});

const cleanNik = (nik?: string) => (nik ?? "").replace(/\s/g, "");

export async function createCustomer(input: CustomerInput) {
  const data: Customer = {
    name: input.name.trim(),
    nameLower: input.name.trim().toLowerCase(),
    phone: input.phone.trim(),
    email: input.email?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    gender: input.gender,
    birthDate: input.birthDate || undefined,
    nik: cleanNik(input.nik) || undefined,
    address: input.address?.trim() || undefined,
    createdAt: Date.now(),
    source: "klinik",
  };
  return store.add("customers", data);
}

export async function updateCustomer(id: string, input: CustomerInput) {
  await store.update("customers", id, {
    name: input.name.trim(),
    nameLower: input.name.trim().toLowerCase(),
    phone: input.phone.trim(),
    email: input.email?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    // Null clears it: "not filled in" is a real answer, as in the old system.
    gender: input.gender ?? null,
    birthDate: input.birthDate ?? "",
    nik: cleanNik(input.nik),
    address: input.address?.trim() ?? "",
  });
}

/* ---------------- Bookings ---------------- */

export interface BookingInput {
  customer: Row<Customer>;
  staff: Row<Staff>;
  service: Row<Service>;
  /** A package to sell with this session, or the patient's package to use. */
  pkg?: Row<Package> | null;
  voucher?: Row<Voucher> | null;
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
    packageId: input.pkg?.id ?? null,
    packageName: input.pkg?.name ?? null,
    voucherId: input.voucher?.id ?? null,
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
    packageId: input.pkg?.id ?? null,
    packageName: input.pkg?.name ?? null,
    voucherId: input.voucher?.id ?? null,
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
  /** Package lines: the staff member who sold it. */
  soldBy?: string;
  soldByName?: string;
  /** A discount the manager set up, applied to this line. */
  discountId?: string;
}

export interface CheckoutInput {
  customer: Row<Customer>;
  bookingId?: string;
  lines: CartLine[];
  /** Whole-bill discount: a preset, plus a manual amount (managers only). */
  billDiscountId?: string;
  manualDiscount?: number;
  discounts: Record<string, Row<Discount>>;
  paymentMethod: PaymentMethod | null;
  paymentRef?: string;
  packages: Record<string, Row<Package>>;
  createdBy: string;
  createdByName?: string;
}

/**
 * Line discounts come off each line first (not on voucher-paid lines), then the
 * bill discount comes off what is left to pay.
 */
export function cartTotals(
  lines: CartLine[],
  bill: { discountId?: string; manual?: number } = {},
  discounts: Record<string, Discount> = {},
) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const covered = lines.reduce((s, l) => s + (l.voucherId ? l.unitPrice * l.qty : 0), 0);
  const lineDiscounts: Record<string, number> = {};
  for (const l of lines)
    lineDiscounts[l.key] = l.voucherId || !l.discountId ? 0 : discountAmount(discounts[l.discountId], l.unitPrice * l.qty);
  const lineDiscount = Object.values(lineDiscounts).reduce((a, b) => a + b, 0);
  const payable = subtotal - covered - lineDiscount;
  const preset = bill.discountId ? discountAmount(discounts[bill.discountId], payable) : 0;
  const billDiscount = Math.max(0, Math.min(payable, preset + Math.max(0, bill.manual || 0)));
  return {
    subtotal,
    covered,
    lineDiscounts,
    lineDiscount,
    billDiscount,
    discount: lineDiscount + billDiscount,
    total: payable - billDiscount,
  };
}

/** Unguessable id for the public receipt link. */
export function receiptToken() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const rnd = new Uint32Array(20);
  crypto.getRandomValues(rnd);
  for (const n of rnd) s += chars[n % chars.length];
  return s;
}

export function receiptFrom(saleId: string, sale: Sale): Receipt {
  return {
    saleId,
    invoiceNo: sale.invoiceNo,
    customerName: sale.customerName,
    items: sale.items.map((i) => ({
      name: i.name,
      qty: i.qty,
      unitPrice: i.unitPrice,
      amount: i.amount,
      discount: i.discount ?? 0,
      discountName: i.discountName ?? "",
      voucher: !!i.voucherId,
      staffName: i.staffName ?? "",
      kind: i.kind,
    })),
    subtotal: sale.subtotal,
    voucherCovered: sale.voucherCovered,
    discount: sale.discount,
    billDiscountName: sale.billDiscountName ?? "",
    total: sale.total,
    paymentMethod: sale.paymentMethod,
    status: sale.status,
    createdAt: sale.createdAt,
  };
}

/** For invoices made before receipts existed: create the public link on demand. */
export async function ensureReceipt(saleId: string, sale: Sale) {
  if (sale.receiptToken) return sale.receiptToken;
  const token = receiptToken();
  await store.set("receipts", token, receiptFrom(saleId, sale));
  await store.update("sales", saleId, { receiptToken: token });
  return token;
}

export async function checkout(input: CheckoutInput) {
  const now = Date.now();
  const year = new Date(now).getFullYear();
  const totals = cartTotals(input.lines, { discountId: input.billDiscountId, manual: input.manualDiscount }, input.discounts);
  const token = receiptToken();
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
      const disc = totals.lineDiscounts[l.key] ?? 0;
      return {
        kind: l.kind,
        refId: l.refId,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        amount: l.voucherId ? 0 : l.unitPrice * l.qty - disc,
        discount: disc || undefined,
        discountName: disc && l.discountId ? input.discounts[l.discountId]?.name : undefined,
        staffId: l.staffId,
        staffName: l.staffName,
        bookingId: l.bookingId,
        voucherId,
        voucherCode,
        issuedVoucherIds: l.kind === "package" ? newVoucherIds[l.key] : undefined,
        soldBy: l.kind === "package" ? l.soldBy || input.createdBy : undefined,
        soldByName: l.kind === "package" ? l.soldByName || input.createdByName : undefined,
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
          // What the patient actually paid per package, after its discount.
          pricePaid: Math.round((l.unitPrice * l.qty - (totals.lineDiscounts[l.key] ?? 0)) / l.qty),
          purchasedAt: now,
          expiresAt: pkg.validityDays > 0 ? now + pkg.validityDays * 86_400_000 : null,
          status: used.length >= pkg.sessions ? "used" : "active",
          source: "sale",
          saleId,
          invoiceNo,
          redemptions: used,
          soldBy: l.soldBy || input.createdBy,
          soldByName: l.soldByName || input.createdByName || null,
          remindedAt: null,
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
      lineDiscount: totals.lineDiscount,
      billDiscount: totals.billDiscount,
      billDiscountName:
        totals.billDiscount > 0
          ? [input.billDiscountId ? input.discounts[input.billDiscountId]?.name : "", input.manualDiscount ? "Diskon manual" : ""].filter(Boolean).join(" + ")
          : undefined,
      receiptToken: token,
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
    tx.set("receipts", token, receiptFrom(saleId, sale));

    for (const id of bookingIds) tx.update("bookings", id, { status: "paid", saleId, invoiceNo });

    return { saleId, invoiceNo, receiptToken: token };
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
    // The patient's online receipt shows it was cancelled.
    if (sale.receiptToken) tx.update("receipts", sale.receiptToken, { status: "void" });
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

