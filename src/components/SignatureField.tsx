"use client";

import { useRef, useState } from "react";
import { PenLine, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { Button, Field, cx, errorText, useToast } from "./ui";
import { useDoc } from "@/lib/hooks";
import { INK, cleanSignature, saveSignature, type CleanSignature, type InkColor } from "@/lib/signature";
import type { ReportOptions } from "@/lib/types";

/* The physio's signature on the report: upload a photo once, it is cleaned up and used on every report they sign.
   Same file in both apps. */

/** The signature as it sits on the report: above the line with the physio's name. */
export function SignaturePreview({ src, name, className }: { src: string; name: string; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center rounded-xl border border-line bg-white px-4 pt-3 pb-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`Tanda tangan ${name}`} className="h-16 max-w-[220px] object-contain" />
      <p className="mt-1 w-52 border-t border-ink/40 pt-1 text-center text-[13px] font-semibold text-ink">{name}</p>
    </div>
  );
}

export function SignatureField({ staffId, staffName, editable }: { staffId: string; staffName: string; editable: boolean }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const { row } = useDoc<ReportOptions>("reportOptions", staffId || null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [color, setColor] = useState<InkColor>("hitam");
  // Quarter turns clockwise, for a photo taken sideways or upside down.
  const [turns, setTurns] = useState(0);
  const [result, setResult] = useState<CleanSignature | null>(null);
  const [busy, setBusy] = useState<"read" | "save" | "remove" | null>(null);
  const [error, setError] = useState("");
  // What was just saved shows at once, without waiting for the database to send it back.
  const [justSaved, setJustSaved] = useState<{ staffId: string; src: string | null } | null>(null);
  const mine = justSaved?.staffId === staffId ? justSaved : null;
  const fromDb = row?.signature ?? null;
  const saved = mine && (fromDb ?? null) !== mine.src ? mine.src : fromDb;
  // Once the database has it, it speaks for itself again.
  if (mine && (fromDb ?? null) === mine.src) setJustSaved(null);

  if (!staffId || (!editable && !saved)) return null;

  async function read(f: File, c: InkColor, t: number) {
    setBusy("read");
    setError("");
    try {
      setResult(await cleanSignature(f, c, t));
    } catch (e) {
      setResult(null);
      setError(
        e instanceof Error && e.message.startsWith("Tanda tangan")
          ? e.message
          : /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)
            ? "Foto HEIC belum bisa dibaca di browser. Ubah format kamera ke JPG, atau kirim fotonya ke diri sendiri lewat WhatsApp lalu pilih dari sana."
            : "Foto tidak bisa dibaca. Coba foto lain (JPG atau PNG).",
      );
    } finally {
      setBusy(null);
    }
  }

  function pick(list: FileList | null) {
    const f = list?.[0];
    if (input.current) input.current.value = "";
    if (!f) return;
    // Some Android pickers give no file type; let the photo itself decide.
    if (f.type && !f.type.startsWith("image/")) return setError("Pilih foto (JPG atau PNG).");
    setPhoto(f);
    setTurns(0);
    void read(f, color, 0);
  }

  function recolor(c: InkColor) {
    setColor(c);
    if (photo) void read(photo, c, turns);
  }

  function rotate(by: number) {
    const t = (turns + by + 4) % 4;
    setTurns(t);
    if (photo) void read(photo, color, t);
  }

  function cancel() {
    setPhoto(null);
    setResult(null);
    setTurns(0);
    setError("");
  }

  async function save() {
    if (!result) return;
    setBusy("save");
    try {
      await saveSignature(staffId, result.dataUrl);
      setJustSaved({ staffId, src: result.dataUrl });
      toast("Tanda tangan disimpan");
      cancel();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await saveSignature(staffId, null);
      setJustSaved({ staffId, src: null });
      toast("Tanda tangan dihapus");
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(null);
    }
  }

  const choosing = !!photo;

  return (
    <Field
      label={`Tanda tangan ${staffName}`}
      hint={
        choosing
          ? "Latar kertas sudah dihapus dan ukurannya disesuaikan. Simpan bila sudah rapi."
          : saved
            ? "Muncul di laporan cetak dan PDF, di atas nama fisioterapis."
            : "Foto tanda tangan di kertas putih polos, dari dekat dengan cahaya terang. Latar kertas dihapus dan ukurannya disesuaikan otomatis."
      }
    >
      <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Foto tanda tangan" onChange={(e) => pick(e.target.files)} />

      {choosing ? (
        <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
          {busy === "read" ? (
            <p className="py-6 text-center text-sm text-muted">Merapikan tanda tangan…</p>
          ) : result ? (
            <SignaturePreview src={result.dataUrl} name={staffName} className="border-dashed" />
          ) : null}
          <div role="group" aria-label="Putar foto" className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted">Putar foto</span>
            <Button size="sm" variant="secondary" icon={<RotateCcw className="size-3.5" />} onClick={() => rotate(-1)} disabled={busy !== null}>
              Kiri
            </Button>
            <Button size="sm" variant="secondary" icon={<RotateCw className="size-3.5" />} onClick={() => rotate(1)} disabled={busy !== null}>
              Kanan
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted">Warna tinta</span>
            <div role="group" aria-label="Warna tinta" className="flex gap-1.5">
              {(Object.keys(INK) as InkColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={color === c}
                  onClick={() => recolor(c)}
                  className={cx(
                    "flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold",
                    color === c ? "border-jade bg-jade-mist text-jade-deep" : "border-line text-ink-2 hover:border-ink-2/40",
                  )}
                >
                  <span className="size-3 rounded-full" style={{ background: `rgb(${INK[c].rgb.join(",")})` }} />
                  {INK[c].label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={busy === "save"} disabled={!result || busy === "read"} onClick={save}>
              Simpan tanda tangan
            </Button>
            <Button size="sm" variant="secondary" onClick={() => input.current?.click()} disabled={busy === "save"}>
              Foto lain
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel} disabled={busy === "save"}>
              Batal
            </Button>
          </div>
        </div>
      ) : saved ? (
        <div className="flex flex-col gap-2">
          <SignaturePreview src={saved} name={staffName} className="self-start" />
          {editable && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={<PenLine className="size-3.5" />} onClick={() => input.current?.click()}>
                Ganti tanda tangan
              </Button>
              <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} loading={busy === "remove"} onClick={remove}>
                Hapus
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-jade/60 text-sm font-semibold text-jade hover:bg-jade-mist/40"
        >
          <PenLine className="size-4" />
          Unggah foto tanda tangan
        </button>
      )}
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </Field>
  );
}
