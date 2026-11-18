"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Eraser, ShieldCheck } from "lucide-react";
import { Button, Card, Field, Input, Spinner, errorText, useToast } from "@/components/ui";
import { useCan, useUser } from "@/lib/auth";
import { CLEARED, KEPT, clearData, countCleared, type Step } from "@/lib/reset";

/* Bersihkan data: the admin deletes the test data before the clinic starts using the system for real. */

const CONFIRM = "HAPUS DATA";

export default function BersihkanDataPage() {
  const user = useUser();
  const can = useCan();
  const toast = useToast();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [typed, setTyped] = useState("");
  const [step, setStep] = useState<Step | null>(null);
  const [done, setDone] = useState<Record<string, number> | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [error, setError] = useState("");

  const allowed = can("data.reset");
  useEffect(() => {
    if (!allowed) return;
    countCleared()
      .then(setCounts)
      .catch((e) => setError(errorText(e)));
  }, [allowed]);

  if (!allowed) return <p className="p-8 text-sm text-muted">Halaman ini khusus admin.</p>;

  const total = counts ? Object.values(counts).reduce((a, b) => a + Math.max(0, b), 0) : 0;
  const ready = typed.trim().toUpperCase() === CONFIRM && !!counts && !step;

  async function run() {
    setError("");
    setStep({ label: "Memulai", done: 0, total: 0 });
    try {
      const { removed, failed } = await clearData(user.email.toLowerCase(), setStep);
      setDone(removed);
      setFailed(failed);
      setCounts(await countCleared());
      setTyped("");
      toast(failed.length ? "Sebagian data sudah dihapus" : "Data uji coba sudah dihapus");
    } catch (e) {
      setError(
        `${errorText(e)} Bila ini soal izin, pastikan aturan Firestore terbaru (firestore.rules) sudah dipasang di Firebase, lalu coba lagi. Data yang sudah terhapus tetap terhapus.`,
      );
    } finally {
      setStep(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-5 pb-16 md:px-8 md:pt-8">
      <h1 className="text-[22px] leading-tight font-bold tracking-[-0.01em] md:text-[26px]">Bersihkan data</h1>
      <p className="mt-1 text-sm text-muted">Hapus data uji coba sebelum klinik mulai memakai sistem, agar semuanya mulai dari nol.</p>

      {done && (
        <Card className="mt-5 flex items-start gap-3 border-jade/40 bg-jade-mist/50 px-4 py-3.5">
          <Check className="mt-0.5 size-5 shrink-0 text-jade" />
          <div className="text-sm">
            <p className="font-semibold text-jade-deep">{failed.length ? "Sebagian data sudah dihapus." : "Data uji coba sudah dihapus."}</p>
            <p className="mt-0.5 text-ink-2">
              {CLEARED.filter(({ col }) => col in done)
                .map(({ col, label }) => `${label} ${done[col]}`)
                .join(", ")}
              {done.files ? `, file laporan ${done.files}` : ""}.
            </p>
            {failed.length > 0 && (
              <p className="mt-1.5 text-danger">
                Belum bisa dihapus: {failed.join(", ")}. Pasang aturan Firestore terbaru (Firebase → Firestore Database → Rules, tempel isi
                firestore.rules, lalu Publish), kemudian jalankan Bersihkan data sekali lagi.
              </p>
            )}
            <Link href="/kalender" className="mt-1.5 inline-block font-semibold text-jade">
              Ke kalender
            </Link>
          </div>
        </Card>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Card className="px-4 py-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Eraser className="size-4 text-danger" />
            Akan dihapus
          </h2>
          {!counts ? (
            <div className="py-6">
              <Spinner />
            </div>
          ) : (
            <ul aria-label="Akan dihapus" className="mt-2 divide-y divide-line-soft text-sm">
              {CLEARED.map(({ col, label }) => (
                <li key={col} className="flex items-center justify-between gap-3 py-1.5">
                  <span>{label}</span>
                  {/* Costs and compensation are the manager's: the admin sees them only once clearing starts. */}
                  <span className="tnum font-semibold">{counts[col] < 0 ? "–" : counts[col]}</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 py-1.5">
                <span>File laporan yang diunggah, tautan struk, nomor faktur</span>
                <span className="text-muted">semua</span>
              </li>
            </ul>
          )}
        </Card>
        <Card className="px-4 py-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-4 text-jade" />
            Tetap ada
          </h2>
          <ul aria-label="Tetap ada" className="mt-2 divide-y divide-line-soft text-sm">
            {KEPT.map((k) => (
              <li key={k} className="py-1.5">
                {k}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4 flex flex-col gap-3 border-danger/30 px-4 py-4">
        <p className="flex items-start gap-2 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Data yang dihapus tidak bisa dikembalikan. Pastikan tidak ada data pasien sungguhan yang perlu disimpan
            {counts ? ` (${total} catatan akan dihapus)` : ""}.
          </span>
        </p>
        <Field label={`Ketik ${CONFIRM} untuk melanjutkan`} htmlFor="reset-confirm">
          <Input id="reset-confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={CONFIRM} disabled={!!step} />
        </Field>
        {step && (
          <p className="text-sm text-ink-2" aria-live="polite">
            Menghapus {step.label.toLowerCase()}
            {step.total ? ` ${step.done}/${step.total}` : "…"}
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button variant="danger" icon={<Eraser className="size-4" />} disabled={!ready} loading={!!step} onClick={run}>
          Hapus data sekarang
        </Button>
      </Card>
    </div>
  );
}
