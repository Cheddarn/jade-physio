"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Search } from "lucide-react";
import { Button, Field, Input, Sheet, cx, errorText, useToast } from "./ui";
import { useUser } from "@/lib/auth";
import { useCollection } from "@/lib/hooks";
import { archiveReports, lastMonth, restoreReports } from "@/lib/archive";
import { dateKey, longDate, shortDate } from "@/lib/format";
import type { TherapyReport } from "@/lib/types";

/*
  Arsip laporan: the desk archives reports by date range, and finds, opens or restores archived ones. Same file in both
  apps; `href` is where a report opens.
*/

const monthName = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};

export function ArchiveSheet({ open, onClose, href }: { open: boolean; onClose: () => void; href: (id: string) => string }) {
  const user = useUser();
  const toast = useToast();
  const today = dateKey();
  const [[from, to], setRange] = useState<[string, string]>(() => lastMonth(today));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<"archive" | "restore" | string | null>(null);
  const [progress, setProgress] = useState(0);

  const valid = !!from && !!to && from <= to;
  const { rows: inRange, loading } = useCollection<TherapyReport>(open && valid ? "reports" : null, [
    ["dateKey", ">=", from],
    ["dateKey", "<=", to],
  ]);
  const { rows: archivedRows } = useCollection<TherapyReport>(open ? "reports" : null, [["archivedAt", ">", 0]]);

  const toArchive = (inRange ?? []).filter((r) => !r.archivedAt);
  const archivedInRange = (inRange ?? []).filter((r) => r.archivedAt);

  // The archive, newest first, by month, narrowed by the name typed.
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = (archivedRows ?? [])
      .filter((r) => !t || r.customerName.toLowerCase().includes(t) || (r.staffName ?? "").toLowerCase().includes(t) || (r.condition ?? "").toLowerCase().includes(t))
      .sort((a, b) => b.sessionAt - a.sessionAt);
    const out: { month: string; rows: typeof list }[] = [];
    for (const r of list) {
      const m = r.dateKey.slice(0, 7);
      const g = out.find((x) => x.month === m);
      if (g) g.rows.push(r);
      else out.push({ month: m, rows: [r] });
    }
    return out;
  }, [archivedRows, q]);
  const archivedCount = archivedRows?.length ?? 0;

  async function archive() {
    setBusy("archive");
    setProgress(0);
    try {
      const n = await archiveReports(
        toArchive.map((r) => r.id),
        user.email,
        setProgress,
      );
      toast(`${n} laporan diarsipkan`);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(null);
    }
  }

  async function restore(ids: string[], key: string) {
    setBusy(key);
    setProgress(0);
    try {
      const n = await restoreReports(ids, setProgress);
      toast(n === 1 ? "Laporan dikembalikan dari arsip" : `${n} laporan dikembalikan dari arsip`);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(null);
    }
  }

  const quick: [string, [string, string]][] = [
    ["Bulan lalu", lastMonth(today)],
    ["Sebelum bulan ini", ["2000-01-01", lastMonth(today)[1]]],
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Arsip laporan">
      <div className="flex flex-col gap-6">
        <section aria-label="Arsipkan laporan" className="flex flex-col gap-3">
          <div>
            <h3 className="font-semibold">Arsipkan menurut tanggal</h3>
            <p className="mt-0.5 text-[13px] text-muted">
              Laporan yang diarsipkan tetap bisa dibuka, dicetak, dan masuk riwayat serta progres pasien, tetapi tidak bisa diubah sampai dikembalikan.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quick.map(([label, r]) => (
              <button
                key={label}
                type="button"
                aria-pressed={from === r[0] && to === r[1]}
                onClick={() => setRange(r)}
                className={cx(
                  "h-8 rounded-full border px-3 text-[13px] font-semibold transition-colors",
                  from === r[0] && to === r[1] ? "border-jade bg-jade-mist text-jade-deep" : "border-line text-ink-2 hover:border-ink-2/40",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dari" htmlFor="ar-from">
              <Input id="ar-from" type="date" value={from} max={to || undefined} onChange={(e) => setRange([e.target.value, to])} />
            </Field>
            <Field label="Sampai" htmlFor="ar-to">
              <Input id="ar-to" type="date" value={to} min={from || undefined} onChange={(e) => setRange([from, e.target.value])} />
            </Field>
          </div>
          <p className="text-sm" aria-live="polite">
            {!valid ? (
              <span className="text-danger">Tanggal &quot;Dari&quot; harus sebelum &quot;Sampai&quot;.</span>
            ) : loading ? (
              <span className="text-muted">Menghitung laporan…</span>
            ) : (
              <>
                <span className="tnum font-semibold">{toArchive.length}</span> laporan dari {from.startsWith("2000") ? "awal" : longDate(from)} sampai {longDate(to)} belum diarsipkan
                {archivedInRange.length > 0 && <span className="text-muted">, {archivedInRange.length} sudah</span>}.
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Archive className="size-4" />} disabled={!valid || !toArchive.length || !!busy} loading={busy === "archive"} onClick={archive}>
              {busy === "archive" ? `Mengarsipkan ${progress}/${toArchive.length}` : `Arsipkan ${toArchive.length} laporan`}
            </Button>
            {archivedInRange.length > 0 && (
              <Button
                variant="secondary"
                icon={<ArchiveRestore className="size-4" />}
                disabled={!!busy}
                loading={busy === "range"}
                onClick={() => restore(archivedInRange.map((r) => r.id), "range")}
              >
                Kembalikan {archivedInRange.length}
              </Button>
            )}
          </div>
        </section>

        <section aria-label="Laporan diarsipkan" className="flex flex-col gap-3 border-t border-line pt-5">
          <h3 className="font-semibold">
            Diarsipkan <span className="tnum font-normal text-muted">({archivedCount})</span>
          </h3>
          {archivedCount > 0 && (
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <Input aria-label="Cari di arsip" placeholder="Cari nama pasien, fisioterapis, kondisi" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </label>
          )}
          {!archivedCount && <p className="text-[13px] text-muted">Belum ada laporan yang diarsipkan.</p>}
          {archivedCount > 0 && !groups.length && <p className="text-[13px] text-muted">Tidak ada yang cocok dengan &quot;{q}&quot;.</p>}
          {groups.map((g) => (
            <div key={g.month}>
              <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-muted uppercase">
                {monthName(g.month)} <span className="tnum font-normal">· {g.rows.length}</span>
              </p>
              <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line">
                {g.rows.slice(0, 60).map((r) => (
                  <li key={r.id} className="flex items-center gap-2 px-3.5 py-2.5">
                    <Link href={href(r.id)} className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{r.customerName}</span>
                      <span className="block truncate text-[12px] text-muted">{[shortDate(r.sessionAt), r.staffName, r.condition].filter(Boolean).join(" · ")}</span>
                    </Link>
                    <Button size="sm" variant="ghost" icon={<ArchiveRestore className="size-3.5" />} disabled={!!busy} loading={busy === r.id} onClick={() => restore([r.id], r.id)}>
                      Kembalikan
                    </Button>
                  </li>
                ))}
              </ul>
              {g.rows.length > 60 && <p className="mt-1 text-[12px] text-muted">{g.rows.length - 60} lagi, cari nama untuk menemukannya.</p>}
            </div>
          ))}
        </section>
      </div>
    </Sheet>
  );
}
