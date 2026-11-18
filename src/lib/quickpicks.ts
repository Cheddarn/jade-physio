import { conditionByName } from "./conditions";

/*
  The report form's pick-lists: findings (Pemeriksaan / temuan), treatments (Tindakan) and advice (Saran), so a physio
  taps instead of types. Picks are written into the same text the physio can still edit; what was typed by hand is
  left as it is. Same file in both apps.
*/

/* ---------------- text editing ----------------
   The text is a list of items separated by commas or new lines ("Spasme: (+), Nyeri tekan: (+)"). Picks add, change
   or take out one item and keep everything else, separators included. */

const SPLIT = /(\s*,\s*|\s*\n\s*)/;
const low = (s: string) => s.trim().toLowerCase();

function items(text: string) {
  const parts = text.split(SPLIT);
  return { parts, idx: parts.map((_, i) => i).filter((i) => i % 2 === 0) };
}

function remove(parts: string[], i: number) {
  // Take out the item with the separator before it, or after it when it is the first.
  if (i > 0) parts.splice(i - 1, 2);
  else parts.splice(0, parts.length > 1 ? 2 : 1);
  return parts.join("").trim();
}

function append(text: string, item: string) {
  const t = text.replace(/\s+$/, "");
  if (!t) return item;
  return text.endsWith("\n") ? `${t}\n${item}` : `${t}, ${item}`;
}

/** The value of a "Label: value" item ("(+)", "4/5"), or null. */
export function valueOf(text: string | undefined, label: string): string | null {
  const { parts, idx } = items(text ?? "");
  const k = low(label);
  for (const i of idx) {
    const m = /^(.+?)\s*:\s*(.+)$/.exec(parts[i].trim());
    if (m && low(m[1]) === k) return m[2].trim();
  }
  return null;
}

/** Set or (with null) remove a "Label: value" item. */
export function setValue(text: string | undefined, label: string, value: string | null): string {
  const t = text ?? "";
  const { parts, idx } = items(t);
  const k = low(label);
  for (const i of idx) {
    const m = /^(.+?)\s*:\s*(.+)$/.exec(parts[i].trim());
    if (m && low(m[1]) === k) {
      if (value == null) return remove(parts, i);
      parts[i] = `${label}: ${value}`;
      return parts.join("");
    }
  }
  return value == null ? t : append(t, `${label}: ${value}`);
}

/** A plain item ("Hot pack") is in the text. */
export const hasPhrase = (text: string | undefined, phrase: string) => {
  const { parts, idx } = items(text ?? "");
  return idx.some((i) => low(parts[i]) === low(phrase));
};

/** Add or take out a plain item. */
export function togglePhrase(text: string | undefined, phrase: string): string {
  const t = text ?? "";
  const { parts, idx } = items(t);
  const i = idx.find((j) => low(parts[j]) === low(phrase));
  return i == null ? append(t, phrase) : remove(parts, i);
}

/* ---------------- findings ---------------- */

export const POS = "(+)";
export const NEG = "(-)";

/** Signs: tap once (+), twice (-), a third time to take it out. */
export const SIGNS = [
  "Spasme",
  "Nyeri tekan",
  "Edema",
  "Kemerahan",
  "Suhu lokal meningkat",
  "Krepitasi",
  "Trigger point",
  "Taut band",
  "Atrofi otot",
  "Deformitas",
  "Nyeri menjalar",
  "Parestesia",
  "Hipestesia",
  "Nyeri gerak aktif",
  "Nyeri gerak pasif",
  "Nyeri melawan tahanan",
];

/** One value each. */
export const SCALES: { label: string; values: string[] }[] = [
  { label: "ROM", values: ["penuh", "terbatas ringan", "terbatas sedang", "terbatas berat"] },
  { label: "Kekuatan otot (MMT)", values: ["1/5", "2/5", "3/5", "4/5", "5/5"] },
  { label: "End feel", values: ["normal", "keras", "kosong (nyeri)", "spasme"] },
  { label: "Pola jalan", values: ["normal", "antalgik", "pincang", "dengan alat bantu"] },
  { label: "Postur", values: ["normal", "antalgik", "forward head", "rounded shoulder", "hiperlordosis", "skoliosis"] },
  { label: "Keseimbangan", values: ["baik", "menurun"] },
];

/** Special tests, by area. */
export const TESTS: Record<string, string[]> = {
  Leher: ["Spurling", "Distraksi", "ULTT", "Adson", "Roos"],
  Bahu: ["Neer", "Hawkins-Kennedy", "Empty can", "Drop arm", "Painful arc", "Speed", "Yergason", "Apprehension", "Cross-body adduction"],
  Siku: ["Cozen", "Mill", "Reverse Cozen", "Tinel siku"],
  Tangan: ["Phalen", "Tinel", "Finkelstein", "Froment"],
  Punggung: ["Lasegue (SLR)", "Bragard", "Slump", "Valsalva", "Kemp", "Patrick (FABER)", "Prone instability", "Gaenslen"],
  Panggul: ["FABER", "FADIR", "Thomas", "Trendelenburg", "Ober", "Log roll"],
  Lutut: ["Lachman", "Anterior drawer", "Posterior drawer", "McMurray", "Apley", "Valgus stress", "Varus stress", "Clarke", "Ballottement", "Noble"],
  Kaki: ["Anterior drawer ankle", "Talar tilt", "Thompson", "Windlass", "Squeeze", "Tinel tarsal"],
  Neuro: ["Romberg", "Babinski", "Klonus", "Finger to nose", "Tandem walk"],
};

/** The test area for a condition from the library, or null. */
export function testAreaOf(condition: string | null | undefined): string | null {
  const c = conditionByName(condition);
  if (!c) return null;
  const r = c.region;
  const n = c.name.toLowerCase();
  if (r === "Leher") return "Leher";
  if (r === "Bahu" || /shoulder|bahu/.test(n)) return "Bahu";
  if (r === "Siku") return "Siku";
  if (r === "Pergelangan tangan" || r === "Tangan") return "Tangan";
  if (/^punggung|tulang belakang/i.test(r) || /spine/.test(n)) return "Punggung";
  if (r === "Panggul" || r === "Paha" || /hip/.test(n)) return "Panggul";
  if (r === "Lutut" || /knee|acl|arthroscopy|meniscus/.test(n)) return "Lutut";
  if (r === "Pergelangan kaki" || r === "Kaki" || r === "Tungkai bawah") return "Kaki";
  if (r === "Neurologi" || r === "Anak") return "Neuro";
  return null;
}

/* ---------------- treatments and advice ---------------- */

export const TREATMENT_GROUPS: { name: string; items: string[] }[] = [
  {
    name: "Modalitas",
    items: [
      "TENS",
      "IFC",
      "Ultrasound",
      "Infrared",
      "SWD",
      "MWD",
      "Electrical stimulation (EMS)",
      "Shockwave (ESWT)",
      "Laser terapi",
      "Hot pack",
      "Cold pack",
      "Traksi lumbal",
      "Traksi servikal",
      "Parafin bath",
    ],
  },
  {
    name: "Manual",
    items: [
      "Manual terapi",
      "Mobilisasi sendi",
      "Massage",
      "Deep tissue massage",
      "Sports massage",
      "Pumping leg massage",
      "Lymphatic drainage (MLD)",
      "Myofascial release",
      "Trigger point release",
      "Muscle energy technique (MET)",
      "Mulligan (SNAG/MWM)",
      "Neural mobilisation",
      "IASTM",
      "Dry needling",
      "Cupping",
    ],
  },
  {
    name: "Latihan",
    items: [
      "Exercise terapi",
      "Stretching",
      "Penguatan otot",
      "Core stability",
      "Latihan ROM",
      "Latihan isometrik",
      "Closed kinetic chain",
      "Theraband exercise",
      "McKenzie exercise",
      "William flexion exercise",
      "Latihan keseimbangan",
      "Latihan proprioseptif",
      "Latihan jalan (gait training)",
      "PNF",
      "Bobath / NDT",
      "Breathing exercise",
      "Koreksi postur",
    ],
  },
  {
    name: "Lainnya",
    items: ["Kinesio taping", "Bracing / splint", "Edukasi pasien", "Program latihan di rumah", "Ergonomi kerja"],
  },
];

export const ADVICE = [
  "Kompres hangat 2x sehari 15 menit",
  "Kompres es 10 menit bila nyeri",
  "Latihan peregangan pagi dan sore",
  "Latihan di rumah sesuai contoh",
  "Hindari angkat beban berat",
  "Perbaiki posisi duduk",
  "Istirahat tiap 30 menit saat kerja",
  "Hindari menunduk lama",
  "Tidur dengan bantal penyangga",
  "Jalan kaki 20 menit sehari",
  "Kurangi naik turun tangga",
  "Pakai alas kaki empuk",
  "Pakai brace saat aktivitas",
  "Istirahat cukup",
];

/** Every built-in treatment, for telling a physio's own picks apart from them. */
export const ALL_TREATMENTS = TREATMENT_GROUPS.flatMap((g) => g.items);
