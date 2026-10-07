import { store } from "./store";
import { BUSINESS, dateKey, fromDateKey, time } from "./format";
import type { Booking } from "./types";

/** "besok", "hari ini" or the weekday and date, as patients would say it. */
export function dayWord(key: string, today = dateKey()) {
  const d = fromDateKey(key);
  const t = fromDateKey(today);
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  const date = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
  if (diff === 0) return `hari ini, ${date}`;
  if (diff === 1) return `besok, ${date}`;
  return date;
}

/** WhatsApp text reminding a patient of their appointment. */
export function reminderMessage(b: Booking, today = dateKey()) {
  const first = b.customerName.split(/\s+/)[0];
  return [
    `Halo ${first}, kami dari ${BUSINESS.name} ingin mengingatkan jadwal terapi Anda:`,
    "",
    `Hari: ${dayWord(b.dateKey, today)}`,
    `Jam: ${time(b.startAt)} (${b.durationMin} menit)`,
    `Layanan: ${b.serviceName}`,
    `Fisioterapis: ${b.staffName}`,
    "",
    "Mohon datang 10 menit lebih awal. Balas YA untuk konfirmasi, atau beri tahu kami jika perlu ganti jadwal.",
    "Terima kasih!",
  ].join("\n");
}

export const markReminded = (id: string, by: string) => store.update("bookings", id, { remindedAt: Date.now(), remindedBy: by });
