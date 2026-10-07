import { BUSINESS } from "./format";
import type { Settings } from "./types";

/* WhatsApp messages to patients. Admins can reword them on Template WhatsApp; {placeholders} are filled in when sending. */

export type TemplateKey = "appointment" | "followUp" | "packageExpiry" | "receipt" | "report";

export interface TemplateDef {
  title: string;
  /** Where in the app this message is sent from. */
  where: string;
  /** Placeholders this message can use, with an example value for the preview. {klinik} works in every message. */
  vars: Record<string, { label: string; example: string }>;
  text: string;
}

const klinik = { label: "Nama klinik", example: BUSINESS.name };
const nama = { label: "Nama depan pasien", example: "Rina" };

export const TEMPLATES: Record<TemplateKey, TemplateDef> = {
  appointment: {
    title: "Pengingat jadwal",
    where: "Kalender, Pengingat jadwal (H-1)",
    vars: {
      nama,
      klinik,
      hari: { label: "Hari dan tanggal", example: "besok, Kamis, 8 Oktober" },
      jam: { label: "Jam mulai", example: "10.00" },
      durasi: { label: "Durasi (menit)", example: "60" },
      layanan: { label: "Layanan", example: "Fisioterapi 60 menit" },
      terapis: { label: "Fisioterapis", example: "Ft. Andini" },
    },
    text: [
      "Halo {nama} 👋",
      "Kami dari {klinik} ingin mengingatkan jadwal terapi Anda:",
      "",
      "📅 Hari: {hari}",
      "⏰ Jam: {jam} ({durasi} menit)",
      "🩺 Layanan: {layanan}",
      "🧑‍⚕️ Fisioterapis: {terapis}",
      "",
      "Mohon datang 10 menit lebih awal ya 🙏",
      "Balas *YA* untuk konfirmasi, atau beri tahu kami jika perlu ganti jadwal.",
      "Terima kasih! 😊",
    ].join("\n"),
  },
  followUp: {
    title: "Follow-up pasien",
    where: "Pelanggan, filter Perlu follow-up",
    vars: {
      nama,
      klinik,
      lama: { label: "Sudah berapa lama", example: "3 minggu" },
      terakhir: { label: "Tanggal sesi terakhir", example: "16 Sep" },
      layanan: { label: "Layanan terakhir", example: "Fisioterapi 60 menit" },
      terapis: { label: "Fisioterapis terakhir", example: "Ft. Andini" },
    },
    text: [
      "Halo {nama} 👋",
      "",
      "Sudah {lama} sejak sesi terakhir Anda di {klinik} ({terakhir}). Bagaimana kabarnya? Semoga keluhannya sudah membaik 🙏",
      "",
      "Supaya hasil terapinya maksimal, yuk jadwalkan sesi berikutnya bersama {terapis} 💪",
      "Balas pesan ini untuk booking, kami bantu carikan waktu yang pas 📅",
      "",
      "Salam sehat,",
      "{klinik} 💚",
    ].join("\n"),
  },
  packageExpiry: {
    title: "Paket hampir kedaluwarsa",
    where: "Pelanggan, filter Paket hampir kedaluwarsa",
    vars: {
      nama,
      klinik,
      paket: { label: "Daftar paket, sisa sesi, dan tanggal berakhir", example: "• Paket 5 sesi: sisa 2 sesi, berlaku sampai 20 Okt" },
    },
    text: [
      "Halo {nama} 👋",
      "Kami dari {klinik} ingin mengingatkan paket sesi Anda akan segera berakhir ⏳",
      "",
      "{paket}",
      "",
      "Yuk jadwalkan sesi berikutnya supaya sesinya tidak hangus 💪",
      "Balas pesan ini untuk booking 📅",
      "Terima kasih! 🙏",
    ].join("\n"),
  },
  receipt: {
    title: "Resi pembayaran",
    where: "Checkout selesai, Kirim WA",
    vars: {
      nama,
      klinik,
      faktur: { label: "Nomor faktur", example: "INV-2026-0142" },
      total: { label: "Total bayar", example: "Rp 350.000" },
      link: { label: "Link resi online", example: "https://…/resi/x7k2" },
    },
    text: [
      "Halo {nama} 👋",
      "Terima kasih sudah berkunjung ke {klinik} 🙏",
      "",
      "🧾 Resi pembayaran {faktur} ({total}) bisa dilihat di:",
      "{link}",
      "",
      "Semoga lekas pulih! 💚",
    ].join("\n"),
  },
  report: {
    title: "Laporan terapi",
    where: "Laporan terapi, Kirim WA",
    vars: {
      nama,
      klinik,
      tanggal: { label: "Tanggal sesi", example: "Rabu, 7 Oktober 2026" },
      terapis: { label: "Fisioterapis", example: "Ft. Andini" },
      tindakan: { label: "Tindakan", example: "TENS, manual therapy" },
      saran: { label: "Saran & latihan di rumah", example: "Kompres hangat 2x sehari" },
      kunjungan: { label: "Kunjungan berikutnya", example: "3 hari lagi" },
      pdf: { label: "Link laporan PDF", example: "https://…/laporan.pdf" },
    },
    text: [
      "Halo {nama} 👋",
      "Berikut laporan terapi Anda di {klinik}, {tanggal} bersama {terapis} 📋",
      "",
      "🩺 Tindakan: {tindakan}",
      "🏠 Saran & latihan di rumah: {saran}",
      "📅 Kunjungan berikutnya: {kunjungan}",
      "",
      "📄 Laporan lengkap (PDF): {pdf}",
      "",
      "Semoga lekas pulih. Terima kasih! 🙏",
    ].join("\n"),
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[];

export const templateText = (s: Pick<Settings, "templates">, key: TemplateKey) => s.templates[key] ?? TEMPLATES[key].text;

type Values = Record<string, string | number | null | undefined>;

/**
 * Fills {placeholders}. A line with a placeholder that has nothing to say (no PDF, no advice) is dropped,
 * so optional details don't leave "Saran:" hanging. Unknown placeholders stay as typed, so a typo shows in the preview.
 */
export function fillTemplate(text: string, values: Values) {
  const all: Values = { klinik: BUSINESS.name, ...values };
  const lines = text.split("\n").flatMap((line) => {
    let empty = false;
    const out = line.replace(/\{(\w+)\}/g, (m, k: string) => {
      if (!(k in all)) return m;
      const v = all[k];
      if (v == null || v === "") {
        empty = true;
        return "";
      }
      return String(v);
    });
    return empty ? [] : [out];
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** The message as the admin worded it, filled in for one patient. */
export const waMessage = (s: Pick<Settings, "templates">, key: TemplateKey, values: Values) => fillTemplate(templateText(s, key), values);

/** The preview on Template WhatsApp: the message with each placeholder's example. */
export const sampleMessage = (key: TemplateKey, text: string) =>
  fillTemplate(text, Object.fromEntries(Object.entries(TEMPLATES[key].vars).map(([k, v]) => [k, v.example])));
