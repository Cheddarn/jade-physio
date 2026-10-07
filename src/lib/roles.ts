export type Role = "admin" | "manager" | "staff" | "therapist" | "cleaning" | "patient";

export const ROLES: Role[] = ["admin", "manager", "staff", "therapist", "cleaning", "patient"];
/** Roles that work at the clinic (everyone except patients). */
export const STAFF_ROLES: Role[] = ["admin", "manager", "staff", "therapist", "cleaning"];
export const isStaffRole = (r?: Role) => !!r && r !== "patient";

export const isRole = (r: unknown): r is Role => ROLES.includes(r as Role);

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  manager: "Manajer / supervisor",
  staff: "Front desk",
  therapist: "Fisioterapis",
  cleaning: "Cleaning service",
  patient: "Pasien",
};

/** Short label for tight spaces such as the demo role switch. */
export const ROLE_SHORT: Record<Role, string> = {
  admin: "Admin",
  manager: "Manajer",
  staff: "Front desk",
  therapist: "Terapis",
  cleaning: "Cleaning",
  patient: "Pasien",
};

export const ROLE_HINT: Record<Role, string> = {
  admin: "Semua menu, termasuk laporan, katalog, pembatalan faktur, dan pengaturan akses.",
  manager: "Semua menu operasional, laporan, katalog, dan pembatalan faktur. Tidak bisa mengatur akses login.",
  staff: "Alur pasien, pendaftaran, kalender, pelanggan, checkout, voucher, dan faktur. Tidak bisa melihat laporan atau membatalkan faktur.",
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
];

const CAPS: Record<Role, Cap[]> = {
  admin: ALL,
  manager: ALL.filter((c) => c !== "team"),
  staff: [
    "bookings.manage",
    "flow.manage",
    "schedule.view",
    "customers.view",
    "checkout",
    "sales.view",
    "vouchers.view",
    "customers.edit",
    "money.view",
    "flow.view",
    "reports.view",
    "requests.manage",
    "restock",
  ],
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
  ["/katalog", "catalog"],
  ["/tim", "team"],
];

export function routeAllowed(role: Role | undefined, path: string) {
  const rule = ROUTE_CAP.find(([p]) => path === p || path.startsWith(p + "/"));
  return !rule || can(role, rule[1]);
}

/** Where everyone lands after signing in. */
export const HOME = "/alur";
export const homeFor = (role?: Role) => (role === "patient" ? "/portal" : HOME);

/** Starting / undoing a session: front desk for anyone, therapists only for their own patients. */
export const canRunSession = (u: { role: Role; staffId?: string }, b: { staffId?: string }) =>
  can(u.role, "bookings.manage") || (u.role === "therapist" && !!u.staffId && u.staffId === b.staffId);
