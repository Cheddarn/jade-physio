export type WithId<T> = T & { id: string };

export interface Staff {
  name: string;
  color: string; // key from STAFF_COLORS
  active: boolean;
  order: number;
}

/** A session type that can be booked and sold, e.g. "Fisioterapi 60 menit". */
export interface Service {
  name: string;
  durationMin: number;
  price: number;
  description?: string;
  active: boolean;
}

/** A prepaid bundle that is sold once and becomes a Voucher for the customer. */
export interface Package {
  name: string;
  sessions: number;
  price: number;
  serviceIds: string[]; // empty = valid for every service
  validityDays: number; // 0 = never expires
  active: boolean;
}

export interface Customer {
  name: string;
  nameLower: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: number;
}

export type BookingStatus = "booked" | "in_session" | "paid" | "cancelled";

export interface Booking {
  customerId: string;
  customerName: string;
  customerPhone?: string;
  staffId: string;
  staffName: string;
  serviceId: string;
  serviceName: string;
  price: number;
  startAt: number; // epoch ms
  durationMin: number;
  dateKey: string; // YYYY-MM-DD, local time
  status: BookingStatus;
  notes?: string;
  saleId?: string | null;
  invoiceNo?: string | null;
  createdAt: number;
}

export interface Redemption {
  saleId: string;
  invoiceNo: string;
  bookingId?: string;
  serviceName: string;
  staffName?: string;
  at: number;
}

export type VoucherStatus = "active" | "used" | "expired" | "void";

/** A customer's prepaid sessions. */
export interface Voucher {
  code: string;
  customerId: string;
  customerName: string;
  packageId?: string;
  name: string;
  serviceIds: string[];
  totalSessions: number;
  usedSessions: number;
  pricePaid: number;
  purchasedAt: number;
  expiresAt: number | null;
  status: VoucherStatus;
  source: "sale" | "manual";
  saleId?: string;
  invoiceNo?: string;
  note?: string;
  redemptions: Redemption[];
}

export type PaymentMethod = "qris" | "transfer" | "card";

export interface SaleItem {
  kind: "service" | "package";
  refId: string;
  name: string;
  qty: number;
  unitPrice: number;
  /** What the customer pays for this line (0 when covered by a voucher). */
  amount: number;
  staffId?: string;
  staffName?: string;
  bookingId?: string;
  voucherId?: string;
  voucherCode?: string;
  /** Vouchers created when a package line is sold. */
  issuedVoucherIds?: string[];
}

export interface Sale {
  invoiceNo: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  bookingId?: string;
  items: SaleItem[];
  subtotal: number; // list value of everything on the invoice
  voucherCovered: number; // list value paid by vouchers
  discount: number;
  total: number; // money received
  paymentMethod: PaymentMethod | "voucher";
  paymentRef?: string;
  status: "paid" | "void";
  voidReason?: string;
  voidedAt?: number;
  createdAt: number;
  dateKey: string;
  createdBy: string;
  createdByName?: string;
}

export interface Access {
  role: import("./roles").Role;
  name: string;
  addedAt: number;
  /** For therapists: which calendar column (staff doc) is theirs. */
  staffId?: string;
}
