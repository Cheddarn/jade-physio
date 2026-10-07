import { store } from "./store";
import { dateKey, fromDateKey, time } from "./format";
import { waMessage } from "./templates";
import type { Booking, Settings } from "./types";

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

/** WhatsApp text reminding a patient of their appointment, in the admin's wording. */
export function reminderMessage(b: Booking, settings: Pick<Settings, "templates">, today = dateKey()) {
  return waMessage(settings, "appointment", {
    nama: b.customerName.split(/\s+/)[0],
    hari: dayWord(b.dateKey, today),
    jam: time(b.startAt),
    durasi: b.durationMin,
    layanan: b.serviceName,
    terapis: b.staffName,
  });
}

export const markReminded = (id: string, by: string) => store.update("bookings", id, { remindedAt: Date.now(), remindedBy: by });
