import {
  BedDouble,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  FileText,
  Gauge,
  LayoutGrid,
  MessageSquareText,
  PackagePlus,
  ReceiptText,
  Ticket,
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
  { group: "tim", href: "/jadwal-kerja", label: "Jadwal kerja", icon: CalendarClock, cap: "flow.view", sub: "Absen, shift, lembur, jam buka" },
  { group: "tim", href: "/restock", label: "Restock", icon: PackagePlus, cap: "restock", sub: "Barang yang perlu dibeli lagi" },
  { group: "keuangan", href: "/ringkasan", label: "Ringkasan", icon: Gauge, cap: "reports", sub: "Semua yang terjadi di klinik" },
  { group: "keuangan", href: "/voucher", label: "Voucher", icon: Ticket, cap: "vouchers.view", sub: "Paket sesi pasien" },
  { group: "keuangan", href: "/faktur", label: "Faktur", icon: ReceiptText, cap: "sales.view", sub: "Riwayat transaksi" },
  { group: "keuangan", href: "/laporan", label: "Laporan", icon: ChartColumn, cap: "reports", sub: "Pemasukan, metode bayar, per terapis" },
  { group: "atur", href: "/katalog", label: "Katalog", icon: LayoutGrid, cap: "catalog", sub: "Layanan dan paket sesi" },
  { group: "atur", href: "/template-wa", label: "Template WhatsApp", icon: MessageSquareText, cap: "templates", sub: "Teks pesan ke pasien" },
  { group: "atur", href: "/tim", label: "Terapis & akses", icon: UserCog, cap: "team", sub: "Kolom kalender dan akun login" },
];
