export type Role = "admin" | "staff" | "therapist";

export const ROLES: Role[] = ["admin", "staff", "therapist"];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  staff: "Staf kasir",
  therapist: "Terapis",
};

export const ROLE_HINT: Record<Role, string> = {
  admin: "Semua menu, termasuk laporan, katalog, pembatalan faktur, dan pengaturan akses.",
  staff: "Kalender, pelanggan, checkout, voucher, dan faktur. Tidak bisa melihat laporan atau membatalkan faktur.",
  therapist: "Hanya jadwal sendiri dan data pasien. Bisa menandai sesi dimulai, tanpa akses ke uang.",
};

export type Cap =
  | "bookings.manage" // create, edit, cancel any booking
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
  | "money.view";

const ALL: Cap[] = [
  "bookings.manage",
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
];

const CAPS: Record<Role, Cap[]> = {
  admin: ALL,
  staff: ["bookings.manage", "checkout", "sales.view", "vouchers.view", "customers.edit", "money.view"],
  therapist: [],
};

export const can = (role: Role | undefined, cap: Cap) => !!role && CAPS[role].includes(cap);

/** Which capability a page needs. Pages not listed are open to every role. */
export const ROUTE_CAP: [prefix: string, cap: Cap][] = [
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

/** Starting / undoing a session: front desk for anyone, therapists only for their own patients. */
export const canRunSession = (u: { role: Role; staffId?: string }, b: { staffId: string }) =>
  can(u.role, "bookings.manage") || (u.role === "therapist" && !!u.staffId && u.staffId === b.staffId);
