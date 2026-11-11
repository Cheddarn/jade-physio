import {
  AlarmClock,
  BedDouble,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  FileText,
  Gauge,
  HandCoins,
  LayoutGrid,
  MessageSquareText,
  PackagePlus,
  ReceiptText,
  Ticket,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";
import type { Cap } from "./roles";

export type NavGroup = "harian" | "tim" | "keuangan" | "atur";

/** Section titles in the sidebar and on Lainnya, in order. */
export const NAV_GROUPS: { id: NavGroup; label: string }[] = [
  { id: "harian", label: "Operasional" },
  { id: "tim", label: "Tim & klinik" },
  { id: "keuangan", label: "Keuangan & laporan" },
  { id: "atur", label: "Pengaturan" },
];

export const NAV: { group: NavGroup; href: string; label: string; icon: typeof CalendarDays; cap?: Cap; sub?: string }[] = [
  { group: "harian", href: "/alur", label: "Alur pasien", icon: BedDouble, cap: "flow.view" },
  { group: "harian", href: "/portal", label: "Booking saya", icon: ClipboardList, cap: "portal" },
  { group: "harian", href: "/kalender", label: "Kalender", icon: CalendarDays, cap: "schedule.view" },
  { group: "harian", href: "/pelanggan", label: "Pelanggan", icon: Users, cap: "customers.view" },
  { group: "harian", href: "/laporan-terapi", label: "Laporan terapi", icon: FileText, cap: "reports.view", sub: "Laporan fisioterapis, PDF, kirim ke pasien" },
  { group: "harian", href: "/pengingat", label: "Pengingat", icon: AlarmClock, cap: "memos", sub: "Pengingat bertanggal dan rutin untuk admin" },
  { group: "tim", href: "/jadwal-kerja", label: "Jadwal kerja", icon: CalendarClock, cap: "flow.view", sub: "Absen, shift, lembur, jam buka" },
  { group: "tim", href: "/komisi", label: "Komisi", icon: HandCoins, cap: "commission", sub: "Komisi per sesi dan kompensasi harian" },
  { group: "tim", href: "/restock", label: "Restock", icon: PackagePlus, cap: "restock", sub: "Barang yang perlu dibeli lagi" },
  { group: "keuangan", href: "/ringkasan", label: "Dasbor", icon: Gauge, cap: "reports", sub: "Pasien baru dan lama, sesi, pemasukan, laporan" },
  { group: "keuangan", href: "/voucher", label: "Voucher", icon: Ticket, cap: "vouchers.view", sub: "Paket sesi pasien" },
  { group: "keuangan", href: "/faktur", label: "Faktur", icon: ReceiptText, cap: "sales.view", sub: "Riwayat transaksi" },
  { group: "keuangan", href: "/laporan", label: "Laporan", icon: ChartColumn, cap: "reports", sub: "Pemasukan, metode bayar, per terapis" },
  { group: "keuangan", href: "/laba", label: "Laba & biaya", icon: TrendingUp, cap: "profit", sub: "Laba kotor, laba bersih, biaya lain" },
  { group: "atur", href: "/katalog", label: "Katalog", icon: LayoutGrid, cap: "catalog", sub: "Layanan dan paket sesi" },
  { group: "atur", href: "/template-wa", label: "Template WhatsApp", icon: MessageSquareText, cap: "templates", sub: "Teks pesan ke pasien" },
  { group: "atur", href: "/tim", label: "Terapis & akses", icon: UserCog, cap: "team", sub: "Kolom kalender dan akun login" },
];

/** The four links on the phone's bottom bar; the rest sit under Lainnya. The manager gets the dashboard first. */
export function mobileTabs<T extends { href: string }>(role: string, visible: T[]): T[] {
  const first = role === "manager" ? ["/ringkasan", "/alur", "/kalender", "/pelanggan"] : [];
  const picked = first.map((h) => visible.find((n) => n.href === h)).filter((n): n is T => !!n);
  return [...picked, ...visible.filter((n) => !picked.includes(n))].slice(0, 4);
}
