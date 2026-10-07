import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { store } from "./store";
import { DEMO_MODE, storage } from "./firebase";
import { BUSINESS, longDate, time } from "./format";
import { waMessage } from "./templates";
import type { Booking, ReportFile, Settings, TherapyReport } from "./types";
import type { Row } from "./store";

export const REPORT_TYPES = "application/pdf,image/jpeg,image/png";
export const MAX_REPORT_MB = 10;
const DEMO_MAX_MB = 2;

/** Store the physio's file. Demo mode keeps it inside the browser. */
export async function uploadReportFile(bookingId: string, file: File): Promise<ReportFile> {
  if (!/^(application\/pdf|image\/(jpeg|png))$/.test(file.type)) throw new Error("File harus PDF, JPG, atau PNG.");
  if (file.size > MAX_REPORT_MB * 1024 * 1024) throw new Error(`Ukuran file maksimal ${MAX_REPORT_MB} MB.`);
  if (DEMO_MODE) {
    if (file.size > DEMO_MAX_MB * 1024 * 1024) throw new Error(`Mode demo: file maksimal ${DEMO_MAX_MB} MB.`);
    const url = await new Promise<string>((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => fail(new Error("File tidak bisa dibaca."));
      r.readAsDataURL(file);
    });
    return { name: file.name, size: file.size, type: file.type, url };
  }
  const path = `reports/${bookingId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const r = ref(storage(), path);
  await uploadBytes(r, file, { contentType: file.type });
  return { name: file.name, size: file.size, type: file.type, url: await getDownloadURL(r), path };
}

export async function removeReportFile(f?: ReportFile | null) {
  if (!f?.path || DEMO_MODE) return;
  try {
    await deleteObject(ref(storage(), f.path));
  } catch {
    /* already gone */
  }
}

export async function saveReport(
  booking: Row<Booking>,
  fields: Pick<TherapyReport, "complaint" | "assessment" | "treatment" | "advice" | "nextVisit">,
  file: ReportFile | null,
  by: string,
  existing?: TherapyReport | null,
  visitId?: string | null,
) {
  const now = Date.now();
  const r: TherapyReport = {
    bookingId: booking.id,
    visitId: visitId ?? existing?.visitId ?? null,
    customerId: booking.customerId,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone ?? "",
    staffId: booking.staffId,
    staffName: booking.staffName,
    serviceName: booking.serviceName,
    dateKey: booking.dateKey,
    sessionAt: booking.startAt,
    ...fields,
    file,
    createdAt: existing?.createdAt ?? now,
    createdBy: existing?.createdBy ?? by,
    updatedAt: now,
    sentAt: existing?.sentAt ?? null,
    sentBy: existing?.sentBy ?? null,
  };
  await store.set("reports", booking.id, r);
}

export const markReportSent = (id: string, by: string) => store.update("reports", id, { sentAt: Date.now(), sentBy: by });

/**
 * A report is owed once the session is over: paid, or the physio pressed "Sesi selesai".
 * It can already be written while the patient is still on the bed.
 */
export const reportOwed = (b: Booking, finishedBookingIds: Set<string>, id: string) => b.status === "paid" || finishedBookingIds.has(id);
export const reportWritable = (b: Booking, finishedBookingIds: Set<string>, id: string) =>
  reportOwed(b, finishedBookingIds, id) || b.status === "in_session";

export function reportMessage(r: TherapyReport, settings: Pick<Settings, "templates">) {
  return waMessage(settings, "report", {
    nama: r.customerName.split(" ")[0],
    tanggal: longDate(r.sessionAt),
    terapis: r.staffName,
    tindakan: r.treatment,
    saran: r.advice,
    kunjungan: r.nextVisit,
    // A demo file lives only in this browser; only real uploads have a link to share.
    pdf: r.file?.url && !r.file.url.startsWith("data:") ? r.file.url : "",
  });
}

/** Plain-text list of a day's patients, for pasting into WhatsApp groups or notes. */
export function dayListText(
  day: string,
  rows: { b: Booking; report?: TherapyReport | null }[],
  opts: { phone: boolean; status: Record<string, string> },
) {
  const out = [`Pasien ${BUSINESS.name}, ${longDate(day)}`, ""];
  rows.forEach(({ b, report }, i) => {
    const parts = [`${i + 1}. ${time(b.startAt)} ${b.customerName}`];
    if (opts.phone && b.customerPhone) parts[0] += ` (${b.customerPhone})`;
    parts.push(b.serviceName, b.staffName, opts.status[b.status] ?? b.status, report ? "laporan ada" : "laporan belum");
    out.push(parts.join(" - "));
    if (b.notes) out.push(`   Keluhan: ${b.notes}`);
  });
  const done = rows.filter((r) => r.report).length;
  out.push("", `Total ${rows.length} pasien, laporan ${done}/${rows.length}`);
  return out.join("\n");
}

/** Browsers won't preview or download big data: URLs (demo mode); turn them into blob: URLs. */
export function toBlobUrl(url: string) {
  if (!url.startsWith("data:")) return url;
  const [head, body] = url.split(",", 2);
  const type = head.slice(5).split(";")[0];
  const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type }));
}
