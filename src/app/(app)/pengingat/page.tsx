"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Repeat } from "lucide-react";
import { Button, Card, PageHeader, Switch, cx, errorText, useToast } from "@/components/ui";
import { MemoRow, MemoSheet, RoutineSheet, type MemoDraft } from "@/components/Memos";
import { useFlowAlerts } from "@/components/FlowAlerts";
import { useUser } from "@/lib/auth";
import { useNow } from "@/lib/hooks";
import { dateKey, time } from "@/lib/format";
import { everyText, memoDue, useUpcomingMemos } from "@/lib/memos";
import { dot, hoursOn, saveSettings, useSettings } from "@/lib/settings";
import type { Routine } from "@/lib/types";

export default function PengingatPage() {
  const user = useUser();
  const toast = useToast();
  const now = useNow(30_000);
  const today = dateKey(now);
  const { settings } = useSettings();
  const { memos: due, routines: dueRoutines, confirmRoutine } = useFlowAlerts();
  const upcoming = useUpcomingMemos(true);
  const [edit, setEdit] = useState<MemoDraft | null>(null);
  const [routine, setRoutine] = useState<Routine | "new" | null>(null);
  const hours = hoursOn(settings, today);

  const later = upcoming.filter((m) => !m.seenAt && !memoDue(m, now));
  const seen = upcoming.filter((m) => m.seenAt).sort((a, b) => b.seenAt! - a.seenAt!);

  async function toggle(r: Routine, on: boolean) {
    try {
      await saveSettings({ routines: settings.routines.map((x) => (x.id === r.id ? { ...x, on } : x)) });
    } catch (e) {
      toast(errorText(e), "error");
    }
  }

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <PageHeader
        title="Pengingat"
        subtitle="Muncul di pojok kanan bawah untuk admin pada waktunya, sampai ditandai sudah dilihat"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEdit({ dateKey: today })}>
            Pengingat baru
          </Button>
        }
      />
      <div className="flex flex-col gap-8 px-4 md:px-8">
        <Section title="Perlu dilihat" count={due.length + dueRoutines.length}>
          {due.length + dueRoutines.length === 0 ? (
            <p className="text-sm text-muted">Tidak ada yang perlu dilihat sekarang.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {dueRoutines.map((r) => (
                <div key={r.id} className="flex items-start gap-2.5 rounded-xl border border-amber/40 bg-amber-mist px-3 py-2 text-[13px]">
                  <Repeat className="mt-0.5 size-4 shrink-0 text-amber" />
                  <p className="min-w-0 flex-1">
                    <span className="font-semibold text-amber">{time(r.at)}</span>
                    <span className="ml-1.5 text-ink">{r.text}</span>
                  </p>
                  <Button size="sm" variant="secondary" icon={<Check className="size-3.5" />} onClick={() => confirmRoutine(r.id)} className="shrink-0">
                    Sudah dilihat
                  </Button>
                </div>
              ))}
              {due.map((m) => (
                <MemoRow key={m.id} m={m} now={now} onEdit={setEdit} showDay />
              ))}
            </div>
          )}
        </Section>

        <Section title="Akan datang" count={later.length}>
          {later.length === 0 ? (
            <p className="text-sm text-muted">Belum ada. Tekan Pengingat baru, atau tambahkan dari Kalender di hari yang dipilih.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {later.map((m) => (
                <MemoRow key={m.id} m={m} now={now} onEdit={setEdit} showDay />
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Pengingat rutin"
          hint={
            hours
              ? `Muncul untuk admin selama jam buka hari ini, ${dot(hours.start)}–${dot(hours.end)}.`
              : "Klinik tutup hari ini, jadi pengingat rutin tidak muncul."
          }
          action={
            <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => setRoutine("new")}>
              Tambah
            </Button>
          }
        >
          {settings.routines.length === 0 ? (
            <p className="text-sm text-muted">Belum ada pengingat rutin.</p>
          ) : (
            <Card className="divide-y divide-line-soft">
              {settings.routines.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <Repeat className={cx("size-4 shrink-0", r.on ? "text-jade" : "text-muted")} />
                  <div className="min-w-0 flex-1">
                    <p className={cx("font-semibold break-words", !r.on && "text-muted")}>{r.text}</p>
                    <p className="text-[13px] text-muted">{everyText(r.everyMin)} selama jam buka</p>
                  </div>
                  <Switch checked={r.on} onChange={(on) => toggle(r, on)} label={r.on ? "Aktif" : "Mati"} />
                  <button
                    type="button"
                    onClick={() => setRoutine(r)}
                    aria-label={`Ubah ${r.text}`}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-line-soft hover:text-ink"
                  >
                    <Pencil className="size-4" />
                  </button>
                </div>
              ))}
            </Card>
          )}
          {user.role !== "admin" && (
            <p className="mt-2 text-[13px] text-muted">Pengingat rutin hanya muncul untuk akun Admin.</p>
          )}
        </Section>

        {seen.length > 0 && (
          <Section title="Sudah dilihat" count={seen.length}>
            <div className="flex flex-col gap-1.5">
              {seen.map((m) => (
                <MemoRow key={m.id} m={m} now={now} onEdit={setEdit} showDay />
              ))}
            </div>
          </Section>
        )}
      </div>
      <MemoSheet value={edit} onClose={() => setEdit(null)} />
      <RoutineSheet value={routine} onClose={() => setRoutine(null)} />
    </div>
  );
}

function Section({
  title,
  count,
  hint,
  action,
  children,
}: {
  title: string;
  count?: number;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
            {title}
            {!!count && <span className="tnum rounded-full bg-line-soft px-2 text-xs">{count}</span>}
          </h2>
          {hint && <p className="text-[13px] text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
