export type WithId<T> = T & { id: string };

export type Gender = "L" | "P"; // laki-laki / perempuan

export interface Staff {
  name: string;
  color: string; // key from STAFF_COLORS
  active: boolean;
  order: number;
  /** Male or female specialist, so the desk can call the right therapist. */
  gender?: Gender;
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
  gender?: Gender;
  /** Family and friends who are also patients. Kept on both people. */
  links?: CustomerLink[];
  /** Filled from the new-patient registration form (Formulir pasien baru). */
  profile?: PatientProfile;
  createdAt: number;
  /** When the desk last sent a "time for your next session" WhatsApp, and who sent it. */
  followedUpAt?: number | null;
  followedUpBy?: string | null;
}

/** How the linked person relates to this customer: "id is my <kind>". */
export type RelationKind = "pasangan" | "orang_tua" | "anak" | "saudara" | "kakek_nenek" | "cucu" | "teman" | "kerabat";

export interface CustomerLink {
  id: string;
  name: string;
  kind: RelationKind;
  at: number;
}

export type YesNo = "ya" | "tidak";

/** Paper form "Formulir pasien baru", sections A to F. */
export interface PatientProfile {
  medicalRecordNo: string; // No. Rekam Medis, e.g. RM-000123
  registeredAt: number;
  // A. Data pasien
  birthPlace?: string;
  birthDate?: string; // YYYY-MM-DD
  ktp?: string;
  address?: string;
  occupation?: string;
  heightCm?: number;
  weightKg?: number;
  firstVisit?: YesNo;
  insurance?: YesNo;
  insuranceName?: string;
  // B. Kontak darurat
  emergencyName?: string;
  emergencyRelation?: string;
  emergencyPhone?: string;
  // C. Informasi kesehatan
  complaint?: string;
  complaintSince?: string;
  injury?: YesNo;
  injuryDetail?: string;
  surgery?: YesNo;
  surgeryDetail?: string;
  conditions?: string[]; // keys of CONDITIONS
  conditionsOther?: string;
  drugAllergy?: YesNo;
  drugAllergyDetail?: string;
  routineMeds?: YesNo;
  routineMedsDetail?: string;
  // D. Dokumen penunjang
  documents?: string[]; // keys of DOCUMENTS
  documentsOther?: string;
  // E. Mengetahui Jade Physio dari
  sources?: string[]; // keys of SOURCES
  sourcesOther?: string;
  // F. Persetujuan
  consent?: boolean;
  consentAt?: number;
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
  /** Package picked at booking time: sold at checkout, and this session is its first. */
  packageId?: string | null;
  packageName?: string | null;
  /** The patient's existing package this session will use. */
  voucherId?: string | null;
  /** When the desk sent the WhatsApp appointment reminder. */
  remindedAt?: number | null;
  remindedBy?: string | null;
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
  /** Who sold the package (commission / follow-up). */
  soldBy?: string | null;
  soldByName?: string | null;
  /** Last time the patient was reminded the package is expiring. */
  remindedAt?: number | null;
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
  soldBy?: string;
  soldByName?: string;
  /** Discount taken off this line (already subtracted from `amount`). */
  discount?: number;
  discountName?: string;
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
  discount: number; // all discounts: per line + whole bill
  lineDiscount?: number;
  billDiscount?: number;
  billDiscountName?: string;
  /** Public receipt: /resi/{receiptToken} */
  receiptToken?: string;
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

/* ---------------- Patient flow ---------------- */

/** waiting: checked in, getting shoes/form/therapist. in_session: on the bed. finished: therapist done. */
export type VisitStage = "waiting" | "in_session" | "finished" | "cancelled";
export type ShoeState = "pending" | "changed" | "returned";

/** One walk-in visit, from the front door until the patient's shoes are back. */
export interface Visit {
  dateKey: string;
  arrivedAt: number;
  customerId: string;
  customerName: string;
  customerGender?: Gender;
  /** People who need clinic slippers (patient + companions), per gender. */
  peopleL: number;
  peopleP: number;
  /** Which specialist the patient needs: male, female, or either. */
  therapistGender?: Gender | null;
  complaint?: string;
  /** Registration form completed for this patient. */
  intakeDone: boolean;
  /** Patients who walked in together share one group id (the first patient's visit). */
  groupId?: string | null;
  /** For a relative: how they relate to the first patient of the group. */
  relation?: RelationKind | null;
  groupLeadName?: string | null;

  shoes: ShoeState;
  shoeRack?: string;
  shoesChangedAt?: number | null;
  shoesChangedBy?: string | null;
  shoesReturnedAt?: number | null;
  shoesReturnedBy?: string | null;

  staffId?: string | null;
  staffName?: string | null;
  bedId?: string | null;
  serviceName?: string | null;
  bookingId?: string | null;
  assignedAt?: number | null;

  stage: VisitStage;
  startedAt?: number | null;
  endedAt?: number | null;
  /** Shoes returned after the session: the visit leaves the board. */
  closedAt?: number | null;
  createdBy: string;
}

/* ---------------- Discounts ---------------- */

/** A discount the manager sets up; the front desk can only pick from these. */
export interface Discount {
  name: string;
  type: "percent" | "flat";
  /** 10 = 10% for percent, rupiah for flat. */
  value: number;
  /** Cap for a percent discount (0 = no cap). */
  maxAmount?: number;
  /** Which lines it can go on; "bill" = whole transaction only. */
  appliesTo: "all" | "service" | "package" | "bill";
  active: boolean;
  validUntil?: string | null; // YYYY-MM-DD, inclusive
  note?: string;
  createdAt: number;
}

/** Public copy of an invoice, readable by anyone with the link. Doc id = random token. */
export interface Receipt {
  saleId: string;
  invoiceNo: string;
  customerName: string;
  items: { name: string; qty: number; unitPrice: number; amount: number; discount?: number; discountName?: string; voucher?: boolean; staffName?: string; kind: "service" | "package" }[];
  subtotal: number;
  voucherCovered: number;
  discount: number;
  billDiscountName?: string;
  total: number;
  paymentMethod: string;
  status: "paid" | "void";
  createdAt: number;
}

/* ---------------- Settings, team, attendance ---------------- */

/** "HH:MM" open and close, or null when closed that day. */
export interface DayHours {
  start: string;
  end: string;
}
/** Keys "0" (Minggu) to "6" (Sabtu), like Date.getDay(). */
export type Week = Record<string, DayHours | null>;

/**
 * A reminder the desk sets for a date, like a calendar app: it pops up on that day (from the time, if set)
 * until someone confirms they have seen it. One confirmation clears it for everyone.
 */
export interface Memo {
  dateKey: string;
  /** "HH:MM", or null to show from the start of the day. */
  time: string | null;
  text: string;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  seenAt: number | null;
  seenBy: string | null;
  seenByName: string | null;
}

export interface Settings {
  hours: Week;
  /** Remind patients this many days before a package expires. */
  reminderDays: number;
  /** Follow up patients whose last session was at least this many days ago and who have nothing booked. */
  followUpDays: number;
  /** WhatsApp wording the admin changed. Missing keys use the built-in text. */
  templates: Partial<Record<import("./templates").TemplateKey, string>>;
  /** Nudges for the admin every so often while the clinic is open, e.g. "reply to TikTok DMs". */
  routines: Routine[];
}

/** A repeating reminder: pops up for admins every `everyMin` minutes from opening time until closing. */
export interface Routine {
  /** Stable key: each device remembers when it last confirmed this routine. */
  id: string;
  text: string;
  everyMin: number;
  on: boolean;
}

/** Everyone who works here (not patients), with their weekly shift. Doc id = email. */
export interface TeamMember {
  name: string;
  role: import("./roles").Role;
  staffId?: string;
  active: boolean;
  /** Shift per weekday. A day missing or null = day off. */
  schedule?: Week;
}

/** One person's working day. Doc id = `${email}_${dateKey}`. */
export interface Attendance {
  email: string;
  name: string;
  role: string;
  dateKey: string;
  inAt: number;
  outAt: number | null;
  /** The shift that applied that day, frozen at clock-in. */
  shiftStart: string | null;
  shiftEnd: string | null;
  overtimeMin: number;
  closing: "normal" | "overtime" | null;
  note?: string;
}

/* ---------------- Therapy reports ---------------- */

export interface ReportFile {
  name: string;
  size: number;
  type: string;
  url: string;
  path?: string;
}

/** The physio's report after a session. Doc id = booking id. */
export interface TherapyReport {
  bookingId: string;
  visitId?: string | null;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  staffId: string;
  staffName: string;
  serviceName: string;
  dateKey: string;
  sessionAt: number;
  complaint?: string;
  assessment?: string;
  treatment?: string;
  advice?: string;
  nextVisit?: string;
  file?: ReportFile | null;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  sentAt?: number | null;
  sentBy?: string | null;
}

/* ---------------- Patient portal ---------------- */

/** Someone the account holder books for (themself, a child, a parent...). */
export interface PortalPerson {
  id: string;
  name: string;
  phone: string;
  gender?: Gender;
  /** How this person relates to the account holder ("self" = the holder). */
  relation?: RelationKind | "self";
  note?: string;
}

/** A patient login. Doc id = email. */
export interface PortalAccount {
  name: string;
  persons: PortalPerson[];
  createdAt: number;
}

export type RequestStatus = "pending" | "confirmed" | "rejected" | "cancelled";

/** A booking a patient asked for; the front desk confirms it into a real booking. */
export interface BookingRequest {
  accountEmail: string;
  accountName: string;
  /** Requests made together in one go share this. */
  batchId: string;
  personId: string;
  personName: string;
  phone: string;
  gender?: Gender;
  relation?: RelationKind | "self" | null;
  /** The account holder's phone, to link family on confirm. */
  holderPhone?: string | null;
  complaint: string;
  serviceId: string;
  serviceName: string;
  durationMin: number;
  /** Preferred physio, or null for anyone. */
  staffId: string | null;
  staffName: string | null;
  startAt: number;
  dateKey: string;
  status: RequestStatus;
  createdAt: number;
  // Filled when the desk confirms or rejects
  bookingId?: string | null;
  customerId?: string | null;
  confirmedStaffName?: string | null;
  confirmedStartAt?: number | null;
  reason?: string | null;
  handledBy?: string | null;
  handledAt?: number | null;
}

/* ---------------- Restock ---------------- */

/** Requested by anyone, ordered by the manager, received by whoever is there when it arrives. */
export type RestockStatus = "requested" | "ordered" | "received";

/** An item someone noticed is running low. The price lives in the manager's expenses, not here. */
export interface RestockItem {
  item: string;
  qty: number;
  unit: string;
  category: string;
  urgent: boolean;
  note?: string;
  dateKey: string;
  createdAt: number;
  createdBy: string;
  createdByName: string;
  /** Missing on requests from before the manager step: then `done` means received. */
  status?: RestockStatus;
  orderedAt?: number | null;
  orderedBy?: string | null;
  orderedByName?: string | null;
  /** Received: kept as done/doneAt/doneBy so older requests read the same. */
  done: boolean;
  doneAt?: number | null;
  doneBy?: string | null;
  doneByName?: string | null;
}

/** Money going out, for the manager's profit report. Only the manager can read these. */
export interface Expense {
  dateKey: string;
  name: string;
  amount: number;
  /** "hpp": cost of what is used or sold, lowers gross profit. "operasional": running costs, lowers net profit. */
  kind: "hpp" | "operasional";
  note?: string;
  /** Set when it comes from a restock order (doc id is then `restock_<id>`). */
  restockId?: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: number;
}

export interface Access {
  role: import("./roles").Role;
  name: string;
  addedAt: number;
  /** For therapists: which calendar column (staff doc) is theirs. */
  staffId?: string;
}
