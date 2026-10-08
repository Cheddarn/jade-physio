"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button, Field, Input, Sheet, Textarea, cx, errorText, useToast } from "./ui";
import {
  CONDITIONS,
  DOCUMENTS,
  GENDER_LABEL,
  SOURCES,
  ageFrom,
  nextMedicalRecordNo,
  saveProfile,
} from "@/lib/flow";
import { patientInfo } from "@/lib/actions";
import { shortDate } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Customer, Gender, PatientProfile, YesNo } from "@/lib/types";

interface Base {
  name: string;
  phone: string;
  email: string;
  gender?: Gender;
}

const emptyProfile = (): PatientProfile => ({
  medicalRecordNo: "",
  registeredAt: Date.now(),
  conditions: [],
  documents: [],
  sources: [],
});

/** "Formulir pasien baru": the paper registration form, sections A to F. */
export function PatientForm({
  open,
  onClose,
  customer,
  visitId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  customer?: Row<Customer> | null;
  /** Ticks the form off on this visit in the patient flow. */
  visitId?: string;
  onSaved?: (customerId: string) => void;
}) {
  const toast = useToast();
  const [base, setBase] = useState<Base>({ name: "", phone: "", email: "" });
  const [p, setP] = useState<PatientProfile>(emptyProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openedFor, setOpenedFor] = useState<unknown>(null);
  const key = open ? (customer?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setBase({ name: customer?.name ?? "", phone: customer?.phone ?? "", email: customer?.email ?? "", gender: customer?.gender });
      // Date of birth, KTP and address may already be on the patient's basic data.
      const info = customer ? patientInfo(customer) : null;
      setP({
        ...emptyProfile(),
        ...(customer?.profile ?? {}),
        ...(info?.birthDate ? { birthDate: info.birthDate } : {}),
        ...(info?.nik ? { ktp: info.nik } : {}),
        ...(info?.address ? { address: info.address } : {}),
      });
      setError("");
    }
  }

  const set = <K extends keyof PatientProfile>(k: K, v: PatientProfile[K]) => setP((x) => ({ ...x, [k]: v }));
  const text = (k: keyof PatientProfile) => ({
    value: (p[k] as string | undefined) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
  });
  const age = ageFrom(p.birthDate);

  async function save() {
    setError("");
    if (!base.name.trim()) return setError("Nama lengkap wajib diisi.");
    if (!base.gender) return setError("Pilih jenis kelamin.");
    if (!p.consent) return setError("Pasien perlu menyetujui pernyataan di bagian F.");
    setBusy(true);
    try {
      const medicalRecordNo = p.medicalRecordNo.trim() || (await nextMedicalRecordNo());
      const id = await saveProfile(
        customer?.id ?? null,
        base,
        { ...p, medicalRecordNo, consentAt: p.consentAt ?? Date.now() },
        visitId,
      );
      toast(`Formulir ${base.name.trim()} tersimpan, ${medicalRecordNo}`);
      onSaved?.(id);
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title="Formulir pasien"
      footer={
        <div className="flex flex-col gap-3">
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button size="lg" block loading={busy} onClick={save}>
            Simpan formulir
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-2 gap-3">
          <Field label="No. rekam medis" htmlFor="pf-rm" hint={p.medicalRecordNo ? undefined : "Otomatis saat disimpan"}>
            <Input id="pf-rm" {...text("medicalRecordNo")} placeholder="RM-000000" />
          </Field>
          <Field label="Tanggal pendaftaran">
            <div className="flex h-11 items-center rounded-[10px] bg-canvas px-3 text-sm font-medium md:h-10">{shortDate(p.registeredAt)}</div>
          </Field>
        </div>

        <Section letter="A" title="Data pasien">
          <Field label="Nama lengkap" htmlFor="pf-name">
            <Input id="pf-name" value={base.name} onChange={(e) => setBase({ ...base, name: e.target.value })} />
          </Field>
          <Field label="Jenis kelamin">
            <Choice
              value={base.gender}
              onChange={(gender) => setBase({ ...base, gender })}
              options={[
                ["L", GENDER_LABEL.L],
                ["P", GENDER_LABEL.P],
              ]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tempat lahir" htmlFor="pf-bp">
              <Input id="pf-bp" {...text("birthPlace")} />
            </Field>
            <Field label="Tanggal lahir" htmlFor="pf-bd" hint={age != null ? `Usia ${age} tahun` : undefined}>
              <Input id="pf-bd" type="date" {...text("birthDate")} />
            </Field>
          </div>
          <Field label="No. KTP" htmlFor="pf-ktp">
            <Input id="pf-ktp" inputMode="numeric" {...text("ktp")} />
          </Field>
          <Field label="Alamat" htmlFor="pf-addr">
            <Textarea id="pf-addr" className="min-h-16" {...text("address")} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="No. HP / WhatsApp" htmlFor="pf-phone">
              <Input id="pf-phone" inputMode="tel" value={base.phone} onChange={(e) => setBase({ ...base, phone: e.target.value })} placeholder="0812 3456 7890" />
            </Field>
            <Field label="Email" htmlFor="pf-email">
              <Input id="pf-email" type="email" value={base.email} onChange={(e) => setBase({ ...base, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Pekerjaan" htmlFor="pf-job">
            <Input id="pf-job" {...text("occupation")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tinggi badan (cm)" htmlFor="pf-h">
              <Input id="pf-h" type="number" inputMode="numeric" value={p.heightCm ?? ""} onChange={(e) => set("heightCm", e.target.value ? Number(e.target.value) : undefined)} />
            </Field>
            <Field label="Berat badan (kg)" htmlFor="pf-w">
              <Input id="pf-w" type="number" inputMode="numeric" value={p.weightKg ?? ""} onChange={(e) => set("weightKg", e.target.value ? Number(e.target.value) : undefined)} />
            </Field>
          </div>
          <Field label="Kunjungan pertama ke Jade Physio?">
            <YesNoChoice value={p.firstVisit} onChange={(v) => set("firstVisit", v)} />
          </Field>
          <Field label="Memiliki asuransi?">
            <YesNoChoice value={p.insurance} onChange={(v) => set("insurance", v)} />
          </Field>
          {p.insurance === "ya" && (
            <Field label="Nama asuransi" htmlFor="pf-ins">
              <Input id="pf-ins" {...text("insuranceName")} />
            </Field>
          )}
        </Section>

        <Section letter="B" title="Kontak darurat">
          <Field label="Nama" htmlFor="pf-en">
            <Input id="pf-en" {...text("emergencyName")} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Hubungan dengan pasien" htmlFor="pf-er">
              <Input id="pf-er" {...text("emergencyRelation")} placeholder="mis. Suami, anak" />
            </Field>
            <Field label="No. HP" htmlFor="pf-ep">
              <Input id="pf-ep" inputMode="tel" {...text("emergencyPhone")} />
            </Field>
          </div>
        </Section>

        <Section letter="C" title="Informasi kesehatan">
          <Field label="Keluhan utama" htmlFor="pf-cc" hint="Terapis melihat keluhan ini sebelum sesi dimulai.">
            <Textarea id="pf-cc" {...text("complaint")} />
          </Field>
          <Field label="Sejak kapan keluhan dirasakan?" htmlFor="pf-since">
            <Input id="pf-since" {...text("complaintSince")} placeholder="mis. 2 minggu lalu" />
          </Field>
          <Field label="Pernah mengalami cedera terkait keluhan ini?">
            <YesNoChoice value={p.injury} onChange={(v) => set("injury", v)} />
          </Field>
          {p.injury === "ya" && (
            <Field label="Jelaskan cedera" htmlFor="pf-inj">
              <Textarea id="pf-inj" className="min-h-16" {...text("injuryDetail")} />
            </Field>
          )}
          <Field label="Pernah menjalani operasi?">
            <YesNoChoice value={p.surgery} onChange={(v) => set("surgery", v)} />
          </Field>
          {p.surgery === "ya" && (
            <Field label="Jelaskan operasi" htmlFor="pf-surg">
              <Textarea id="pf-surg" className="min-h-16" {...text("surgeryDetail")} />
            </Field>
          )}
          <Field label="Riwayat penyakit">
            <Checks options={CONDITIONS} value={p.conditions ?? []} onChange={(v) => set("conditions", v)} />
          </Field>
          <Field label="Penyakit lainnya" htmlFor="pf-co">
            <Input id="pf-co" {...text("conditionsOther")} />
          </Field>
          <Field label="Alergi obat">
            <Choice
              value={p.drugAllergy}
              onChange={(v) => set("drugAllergy", v)}
              options={[
                ["tidak", "Tidak ada"],
                ["ya", "Ada"],
              ]}
            />
          </Field>
          {p.drugAllergy === "ya" && (
            <Field label="Alergi obat apa?" htmlFor="pf-al">
              <Input id="pf-al" {...text("drugAllergyDetail")} />
            </Field>
          )}
          <Field label="Sedang mengonsumsi obat rutin?">
            <YesNoChoice value={p.routineMeds} onChange={(v) => set("routineMeds", v)} />
          </Field>
          {p.routineMeds === "ya" && (
            <Field label="Obat apa?" htmlFor="pf-med">
              <Input id="pf-med" {...text("routineMedsDetail")} />
            </Field>
          )}
        </Section>

        <Section letter="D" title="Dokumen penunjang">
          <Field label="Membawa hasil pemeriksaan?">
            <Checks options={DOCUMENTS} value={p.documents ?? []} onChange={(v) => set("documents", v)} />
          </Field>
          <Field label="Lainnya" htmlFor="pf-do">
            <Input id="pf-do" {...text("documentsOther")} />
          </Field>
        </Section>

        <Section letter="E" title="Mengetahui Jade Physio dari">
          <Checks options={SOURCES} value={p.sources ?? []} onChange={(v) => set("sources", v)} />
          <Field label="Lainnya" htmlFor="pf-so">
            <Input id="pf-so" {...text("sourcesOther")} />
          </Field>
        </Section>

        <Section letter="F" title="Persetujuan">
          <button
            type="button"
            onClick={() => set("consent", !p.consent)}
            aria-pressed={!!p.consent}
            className={cx(
              "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors",
              p.consent ? "border-jade bg-jade-mist/50 ring-1 ring-jade" : "border-line hover:border-ink-2/30",
            )}
          >
            <Box on={!!p.consent} />
            <span>
              Saya menyatakan bahwa seluruh informasi yang saya berikan adalah benar dan dapat digunakan untuk keperluan
              pelayanan fisioterapi serta rekam medis di Jade Physio.
            </span>
          </button>
          <p className="text-[13px] text-muted">Tanda tangan pasien tetap di formulir kertas bila diperlukan.</p>
        </Section>
      </div>
    </Sheet>
  );
}

function Section({ letter, title, children }: { letter: string; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2.5 rounded-full bg-jade-deep py-1.5 pr-4 pl-1.5 text-sm font-bold tracking-wide text-white uppercase">
        <span className="flex size-6 items-center justify-center rounded-full bg-white text-xs text-jade-deep">{letter}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Box({ on }: { on: boolean }) {
  return (
    <span
      className={cx(
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2",
        on ? "border-jade bg-jade text-white" : "border-line",
      )}
    >
      {on && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  );
}

export function Choice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | undefined | null;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cx(
            "h-11 rounded-xl border px-2 text-sm font-semibold transition-colors",
            value === v ? "border-jade bg-jade-mist/50 text-jade-deep ring-1 ring-jade" : "border-line hover:border-ink-2/30",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function YesNoChoice({ value, onChange }: { value?: YesNo; onChange: (v: YesNo) => void }) {
  return (
    <Choice
      value={value}
      onChange={onChange}
      options={[
        ["ya", "Ya"],
        ["tidak", "Tidak"],
      ]}
    />
  );
}

function Checks({ options, value, onChange }: { options: [string, string][]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([k, label]) => {
        const on = value.includes(k);
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}
            aria-pressed={on}
            className={cx(
              "flex h-10 items-center gap-2 rounded-full border pr-3.5 pl-2.5 text-sm font-semibold transition-colors",
              on ? "border-jade bg-jade-mist/60 text-jade-deep" : "border-line hover:border-ink-2/30",
            )}
          >
            <Box on={on} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
