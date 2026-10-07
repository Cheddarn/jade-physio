"use client";

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Badge, Button, Card, PageHeader, Spinner, Textarea, cx, errorText, useToast } from "@/components/ui";
import { saveSettings, useSettings } from "@/lib/settings";
import { TEMPLATES, TEMPLATE_KEYS, sampleMessage, templateText, type TemplateKey } from "@/lib/templates";
import type { Settings } from "@/lib/types";

const EMOJIS = ["👋", "😊", "🙏", "💚", "💪", "✨", "📅", "⏰", "🩺", "🧑‍⚕️", "📋", "📄", "🧾", "🏠", "⏳", "🎉", "👍", "❤️"];

export default function TemplateWaPage() {
  const { settings, loading } = useSettings();
  return (
    <div className="mx-auto max-w-5xl pb-10">
      <PageHeader
        title="Template WhatsApp"
        subtitle="Kata-kata pesan WhatsApp ke pasien. Isian dalam {kurung kurawal} diganti otomatis saat dikirim."
      />
      <div className="flex flex-col gap-4 px-4 md:px-8">
        {loading ? <Spinner /> : TEMPLATE_KEYS.map((key) => <TemplateCard key={key} id={key} settings={settings} />)}
      </div>
    </div>
  );
}

function TemplateCard({ id, settings }: { id: TemplateKey; settings: Settings }) {
  const toast = useToast();
  const def = TEMPLATES[id];
  const saved = templateText(settings, id);
  const [draft, setDraft] = useState(saved);
  const [base, setBase] = useState(saved);
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  // Someone else saved meanwhile: follow it, unless there are unsaved edits here.
  if (saved !== base) {
    setBase(saved);
    if (draft === base) setDraft(saved);
  }
  const dirty = draft !== saved;
  const custom = id in settings.templates;
  const unknown = [...new Set([...draft.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].filter((k) => !(k in def.vars));

  function insert(token: string) {
    const el = area.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    setDraft(draft.slice(0, start) + token + draft.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    setBusy(true);
    try {
      // Only store wording that differs from the built-in text, so improvements to the default still reach everyone else.
      const { [id]: _old, ...rest } = settings.templates;
      await saveSettings({ templates: draft.trim() === def.text ? rest : { ...rest, [id]: draft } });
      toast(`Template ${def.title} disimpan`);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-bold">{def.title}</h2>
          <p className="text-[13px] text-muted">Dikirim dari: {def.where}</p>
        </div>
        {custom && <Badge tone="jade">Diubah</Badge>}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Textarea
            ref={area}
            aria-label={`Teks ${def.title}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            className="text-sm leading-relaxed"
          />
          <div>
            <p className="mb-1 text-[12px] font-semibold text-muted">Isian (ketuk untuk menyisipkan)</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(def.vars).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  title={`${v.label}, contoh: ${v.example}`}
                  onClick={() => insert(`{${k}}`)}
                  className="rounded-md border border-line bg-canvas px-2 py-0.5 font-mono text-[12px] text-ink-2 hover:border-jade hover:text-jade-deep"
                >
                  {`{${k}}`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[12px] font-semibold text-muted">Emoji</p>
            <div className="flex flex-wrap gap-0.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-label={`Sisipkan ${e}`}
                  onClick={() => insert(e)}
                  className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-line-soft"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          {unknown.length > 0 && (
            <p className="text-[13px] font-semibold text-danger">
              {unknown.map((k) => `{${k}}`).join(", ")} tidak dikenal dan akan terkirim apa adanya.
            </p>
          )}
        </div>

        <div className="min-w-0">
          <p className="mb-1 text-[12px] font-semibold text-muted">Contoh di WhatsApp</p>
          <div className="rounded-xl bg-[#efeae2] p-3">
            <div className="ml-auto max-w-[95%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13.5px] leading-snug whitespace-pre-wrap break-words text-[#111b21] shadow-sm">
              <WaText text={sampleMessage(id, draft)} />
            </div>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            *teks* jadi tebal dan _teks_ jadi miring di WhatsApp. Baris yang isiannya kosong (misalnya tidak ada PDF) tidak ikut terkirim.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line-soft pt-4">
        {draft.trim() !== def.text && (
          <Button variant="ghost" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => setDraft(def.text)}>
            Kembalikan ke bawaan
          </Button>
        )}
        {dirty && (
          <Button variant="secondary" size="sm" onClick={() => setDraft(saved)}>
            Batal
          </Button>
        )}
        <Button size="sm" loading={busy} disabled={!dirty || !draft.trim()} onClick={save}>
          Simpan
        </Button>
      </div>
    </Card>
  );
}

/** WhatsApp's own formatting in the preview: *tebal*, _miring_, ~coret~. */
function WaText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return (
    <>
      {parts.map((p, i) => {
        const wrapped = p.length > 2 && p[0] === p[p.length - 1];
        if (wrapped && p[0] === "*") return <strong key={i}>{p.slice(1, -1)}</strong>;
        if (wrapped && p[0] === "_") return <em key={i}>{p.slice(1, -1)}</em>;
        if (wrapped && p[0] === "~") return <s key={i}>{p.slice(1, -1)}</s>;
        return <span key={i} className={cx(!p && "hidden")}>{p}</span>;
      })}
    </>
  );
}
