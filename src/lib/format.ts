import type { BookingStatus, PaymentMethod } from "./types";

export const BUSINESS = {
  name: "Jade Physio",
  address: "",
  phone: "",
  openHour: 8,
  closeHour: 21,
};

const rupiahFmt = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const numFmt = new Intl.NumberFormat("id-ID");

export const rupiah = (n: number) => rupiahFmt.format(Math.round(n || 0));
export const num = (n: number) => numFmt.format(n || 0);

/** Short money for tight spaces: 1,2 jt / 250 rb */
export function rupiahShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} rb`;
  return String(n);
}

export const pad = (n: number) => String(n).padStart(2, "0");

export function dateKey(d: Date | number = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function fromDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number) {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

export const time = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}.${pad(d.getMinutes())}`;
};

export const longDate = (d: Date | number | string) =>
  new Date(typeof d === "string" ? fromDateKey(d) : d).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const shortDate = (d: Date | number | string) =>
  new Date(typeof d === "string" ? fromDateKey(d) : d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const dayMonth = (d: Date | number | string) =>
  new Date(typeof d === "string" ? fromDateKey(d) : d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });

export const dateTime = (ms: number) => `${shortDate(ms)}, ${time(ms)}`;

export function duration(min: number) {
  if (min < 60) return `${min} mnt`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} j ${m} mnt` : `${h} jam`;
}

export const minutesOfDay = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

export function atTime(key: string, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = fromDateKey(key);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function roundedNow(step = 5) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / step) * step);
  return d.getTime();
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export const PAYMENT_LABEL: Record<PaymentMethod | "voucher", string> = {
  qris: "QRIS",
  transfer: "Transfer bank",
  card: "Kartu debit/kredit",
  voucher: "Voucher",
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  booked: "Menunggu",
  in_session: "Sedang sesi",
  paid: "Lunas",
  cancelled: "Dibatalkan",
};

/** Calendar colours for therapists: [block fill, block border/text] */
export const STAFF_COLORS: Record<string, { name: string; bg: string; fg: string; dot: string }> = {
  jade: { name: "Jade", bg: "#DDF1E8", fg: "#0B5A43", dot: "#1A8A66" },
  sky: { name: "Langit", bg: "#DDEBFA", fg: "#1D4E89", dot: "#3B7DD8" },
  plum: { name: "Plum", bg: "#EEE2F4", fg: "#5E2A7A", dot: "#9453B8" },
  amber: { name: "Kunyit", bg: "#FBEBCB", fg: "#7A4E06", dot: "#D2921B" },
  rose: { name: "Mawar", bg: "#FBE1E3", fg: "#8A2432", dot: "#D8506A" },
  slate: { name: "Batu", bg: "#E4E8EE", fg: "#33404F", dot: "#6B7A8C" },
  lime: { name: "Daun", bg: "#E8F3D2", fg: "#43600F", dot: "#78A22B" },
  coral: { name: "Karang", bg: "#FCE4D8", fg: "#8A3A16", dot: "#E0703F" },
};

export const staffColor = (key?: string) => STAFF_COLORS[key ?? ""] ?? STAFF_COLORS.slate;

export function voucherCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `JP-${s}`;
}

export const remaining = (v: { totalSessions: number; usedSessions: number }) =>
  Math.max(0, v.totalSessions - v.usedSessions);
