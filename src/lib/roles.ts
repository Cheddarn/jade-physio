export type Role = "admin" | "manager" | "therapist" | "cleaning" | "patient";

export const ROLES: Role[] = ["admin", "manager", "therapist", "cleaning", "patient"];
/** Roles that work at the clinic (everyone except patients). */
export const STAFF_ROLES: Role[] = ["admin", "manager", "therapist", "cleaning"];
export const isStaffRole = (r?: Role) => !!r && r !== "patient";

export const isRole = (r: unknown): r is Role => ROLES.includes(r as Role);

/** A role as stored. Front desk used to be its own role ("staff"); it is now Admin, and old records still say "staff". */
export const normalizeRole = (r: unknown): Role | undefined => (r === "staff" ? "admin" : isRole(r) ? r : undefined);

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  manager: "Manajer / supervisor",
  therapist: "Fisioterapis",
  cleaning: "Cleaning service",
  patient: "Pasien",
};

/** Short label for tight spaces such as the demo role switch. */
export const ROLE_SHORT: Record<Role, string> = {
  admin: "Admin",
  manager: "Manajer",
  therapist: "Terapis",
  cleaning: "Cleaning",
  patient: "Pasien",
};

export const ROLE_HINT: Record<Role, string> = {
  admin: "Front desk. Semua menu, termasuk laporan pemasukan, katalog, pembatalan faktur, dan pengaturan akses. Tidak melihat harga restock dan laba.",
  manager: "Semua menu operasional, laporan, katalog, dan pembatalan faktur, plus memproses restock dan melihat biaya serta laba. Tidak bisa mengatur akses login.",
  therapist: "Alur pasien dan jadwal sendiri, keluhan pasien. Memulai dan menyelesaikan sesi, tanpa akses ke uang.",
  cleaning: "Hanya tugas sepatu pasien di Alur pasien: ganti sepatu saat datang, kembalikan saat selesai.",
  patient: "Akun pasien: booking sendiri untuk dirinya dan keluarganya. Pasien biasanya mendaftar sendiri.",
};

export type Cap =
  | "bookings.manage" // create, edit, cancel any booking
  | "flow.manage" // check patients in, assign therapist and bed
  | "schedule.view"
  | "customers.view"
  | "checkout"
  | "sales.view"
  | "sales.void"
  | "reports"
  | "catalog"
  | "team"
  | "vouchers.view"
  | "vouchers.manual"
  | "vouchers.void"
  | "customers.edit"
  | "money.view"
  | "flow.view"
  | "attendance.manage" // shifts, opening hours, everyone's overtime
  | "reports.write" // therapy reports
  | "reports.view"
  | "requests.manage" // patient booking requests
  | "restock"
  | "discounts.manage" // create discounts, give a manual discount
  | "templates" // wording of WhatsApp messages to patients
  | "memos" // the desk's own dated reminders on the calendar
  | "restock.manage" // process restock requests: name, quantity, price, ordered
  | "profit" // costs, gross and net profit
  | "portal";

const ALL: Cap[] = [
  "bookings.manage",
  "flow.manage",
  "schedule.view",
  "customers.view",
  "checkout",
  "sales.view",
  "sales.void",
  "reports",
  "catalog",
  "team",
  "vouchers.view",
  "vouchers.manual",
  "vouchers.void",
  "customers.edit",
  "money.view",
  "flow.view",
  "attendance.manage",
  "reports.write",
  "reports.view",
  "requests.manage",
  "restock",
  "discounts.manage",
  "templates",
  "memos",
  "restock.manage",
  "profit",
];

/** Only the manager: buying stock, costs and profit. Admin, the front desk, does everything else. */
const MANAGER_ONLY: Cap[] = ["restock.manage", "profit"];

const CAPS: Record<Role, Cap[]> = {
  admin: ALL.filter((c) => !MANAGER_ONLY.includes(c)),
  manager: ALL.filter((c) => c !== "team"),
  therapist: ["schedule.view", "customers.view", "flow.view", "reports.write", "reports.view", "restock"],
  cleaning: ["flow.view", "restock"],
  patient: ["portal"],
};

export const can = (role: Role | undefined, cap: Cap) => !!role && !!CAPS[role]?.includes(cap);

/** Which capability a page needs. Pages not listed are open to every role. */
export const ROUTE_CAP: [prefix: string, cap: Cap][] = [
  ["/alur", "flow.view"],
  ["/portal", "portal"],
  ["/jadwal-kerja", "flow.view"],
  ["/laporan-terapi", "reports.view"],
  ["/restock", "restock"],
  ["/ringkasan", "reports"],
  ["/kalender", "schedule.view"],
  ["/pelanggan", "customers.view"],
  ["/checkout", "checkout"],
  ["/faktur", "sales.view"],
  ["/voucher", "vouchers.view"],
  ["/laporan", "reports"],
  ["/laba", "profit"],
  ["/katalog", "catalog"],
  ["/template-wa", "templates"],
  ["/pengingat", "memos"],
  ["/tim", "team"],
];

export function routeAllowed(role: Role | undefined, path: string) {
  const rule = ROUTE_CAP.find(([p]) => path === p || path.startsWith(p + "/"));
  return !rule || can(role, rule[1]);
}

/** Where everyone lands after signing in. */
export const HOME = "/alur";
export const homeFor = (role?: Role) => (role === "patient" ? "/portal" : HOME);

/** Starting / undoing a session: the desk (admin, manager) for anyone, therapists only for their own patients. */
export const canRunSession = (u: { role: Role; staffId?: string }, b: { staffId?: string }) =>
  can(u.role, "bookings.manage") || (u.role === "therapist" && !!u.staffId && u.staffId === b.staffId);
