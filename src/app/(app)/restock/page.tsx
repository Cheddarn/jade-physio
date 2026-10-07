"use client";

import { Pager, usePager } from "@/components/Pager";
import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ClipboardCopy, PackagePlus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Empty, Field, IconButton, Input, PageHeader, Segmented, Select, Spinner, Switch, cx, errorText, useToast } from "@/components/ui";
import { useCan, useUser } from "@/lib/auth";
import { useCollection } from "@/lib/hooks";
import { dateKey, fromDateKey, pad, time } from "@/lib/format";
import { CATEGORIES, UNITS, removeRestock, setRestocked, shoppingListText, submitRestock } from "@/lib/restock";
import type { Row } from "@/lib/store";
import type { RestockItem } from "@/lib/types";

type Show = "semua" | "belum" | "sudah";

export default function RestockPage() {
  const user = useUser();
  const can = useCan();
  const toast = useToast();
  const [month, setMonth] = useState(() => dateKey().slice(0, 7));
  const [show, setShow] = useState<Show>("semua");
  const d = fromDateKey(`${month}-01`);
  const first = `${month}-01`;
  const last = dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const { rows, loading } = useCollection<RestockItem>("restock", [
    ["dateKey", ">=", first],
    ["dateKey", "<=", last],
  ]);
  const all = useMemo(() => (rows ?? []).filter((r) => r.dateKey >= first && r.dateKey <= last), [rows, first, last]);
  const list = useMemo(
    () =>
      all
        .filter((r) => (show === "belum" ? !r.done : show === "sudah" ? r.done : true))
        .sort(
          (a, b) =>
            b.dateKey.localeCompare(a.dateKey) || Number(a.done) - Number(b.done) || Number(b.urgent) - Number(a.urgent) || b.createdAt - a.createdAt,
        ),
    [all, show],
  );
  const pager = usePager(list, "restock", 25);
  // One list per day, newest day first; open and urgent items on top within a day.
  const days = useMemo(() => {
    const m = new Map<string, Row<RestockItem>[]>();
    for (const r of pager.shown) m.set(r.dateKey, [...(m.get(r.dateKey) ?? []), r]);
    for (const items of m.values())
      items.sort((a, b) => Number(a.done) - Number(b.done) || Number(b.urgent) - Number(a.urgent) || b.createdAt - a.createdAt);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [pager.shown]);
  const open = all.filter((r) => !r.done).length;
  const label = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const shift = (n: number) => {
    const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
    setMonth(`${x.getFullYear()}-${pad(x.getMonth() + 1)}`);
  };

  async function copyList() {
    const text = shoppingListText(all, label);
    try {
      await navigator.clipboard.writeText(text);
      toast(`${open} barang disalin sebagai daftar belanja`);
    } catch {
      window.prompt("Salin daftar belanja:", text);
    }
  }

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <PageHeader title="Restock barang" subtitle="Semua staf bisa mengajukan barang yang hampir habis. Centang setelah dibeli." />
      <div className="flex flex-col gap-5 px-4 md:px-8">
        <RestockForm items={all} />

        <div className="flex flex-wrap items-center gap-2">
          <IconButton label="Bulan sebelumnya" onClick={() => shift(-1)}>
            <ChevronLeft className="size-5" />
          </IconButton>
          <p className="min-w-36 text-center font-bold">{label}</p>
          <IconButton label="Bulan berikutnya" onClick={() => shift(1)}>
            <ChevronRight className="size-5" />
          </IconButton>
          <Badge tone={open ? "amber" : "jade"}>{open} belum di-restock</Badge>
          <Badge>{all.length} permintaan</Badge>
          <Button size="sm" variant="secondary" className="ml-auto" icon={<ClipboardCopy className="size-3.5" />} disabled={!open} onClick={copyList}>
            Salin daftar belanja
          </Button>
        </div>

        <Segmented
          className="w-full md:w-auto"
          value={show}
          onChange={setShow}
          options={[
            { value: "semua", label: "Semua" },
            { value: "belum", label: `Belum (${open})` },
            { value: "sudah", label: "Sudah di-restock" },
          ]}
        />

        {loading ? (
          <Spinner />
        ) : days.length === 0 ? (
          <Card>
            <Empty icon={<PackagePlus className="size-5" />} title={all.length ? "Tidak ada di filter ini" : `Belum ada permintaan restock di ${label}`} />
          </Card>
        ) : (
          days.map(([key, items]) => {
            const left = items.filter((i) => !i.done).length;
            return (
              <section key={key}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-2">
                  {fromDateKey(key).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                  {key === dateKey() && <Badge tone="jade">Hari ini</Badge>}
                  <span className="text-xs font-medium text-muted">
                    {items.length} barang{left ? `, ${left} belum` : ", semua beres"}
                  </span>
                </h2>
                <Card className="divide-y divide-line-soft">
                  {items.map((r) => (
                    <RestockRow key={r.id} r={r} canDelete={(!r.done && r.createdBy === user.email) || can("attendance.manage")} />
                  ))}
                </Card>
              </section>
            );
          })
        )}
        {!loading && list.length > 0 && <Pager pager={pager} label="barang" />}
      </div>
    </div>
  );
}

function RestockRow({ r, canDelete }: { r: Row<RestockItem>; canDelete: boolean }) {
  const user = useUser();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      await setRestocked(r.id, !r.done, user);
      if (!r.done) toast(`${r.item} sudah di-restock`);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={cx("flex items-start gap-3 px-4 py-3", r.done && "bg-canvas/50")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={r.done}
        aria-label={`Tandai ${r.item} sudah di-restock`}
        disabled={busy}
        onClick={toggle}
        className={cx(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          r.done ? "border-jade bg-jade text-white" : "border-line hover:border-jade",
        )}
      >
        {r.done && <Check className="size-4" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cx("font-semibold", r.done && "text-muted line-through decoration-1")}>
          {r.item}
          <span className="tnum ml-2 font-bold text-ink">
            {r.qty} {r.unit}
          </span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
          <span className="rounded-full bg-line-soft px-2 py-0.5 font-semibold text-ink-2">{r.category}</span>
          {r.urgent && !r.done && <span className="rounded-full bg-danger-mist px-2 py-0.5 font-bold text-danger">Urgent</span>}
          <span>
            Diajukan {r.createdByName}, {time(r.createdAt)}
          </span>
          {r.done && r.doneAt && (
            <span className="font-semibold text-jade-deep">
              Di-restock {r.doneByName}, {fromDateKey(dateKey(r.doneAt)).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} {time(r.doneAt)}
            </span>
          )}
        </p>
        {r.note && <p className="mt-1 text-[13px] text-ink-2">{r.note}</p>}
      </div>
      {canDelete && (
        <IconButton
          label={`Hapus ${r.item}`}
          className="-my-1 size-9 hover:bg-danger-mist hover:text-danger"
          onClick={async () => {
            try {
              await removeRestock(r.id);
              toast("Permintaan dihapus");
            } catch (e) {
              toast(errorText(e), "error");
            }
          }}
        >
          <Trash2 className="size-4" />
        </IconButton>
      )}
    </div>
  );
}

function RestockForm({ items }: { items: Row<RestockItem>[] }) {
  const user = useUser();
  const toast = useToast();
  const [item, setItem] = useState("");
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState("pcs");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [urgent, setUrgent] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Suggest names already used, so the same item is spelled the same way.
  const known = useMemo(() => [...new Set(items.map((i) => i.item))].sort(), [items]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!item.trim()) return;
    setBusy(true);
    try {
      await submitRestock({ item, qty, unit, category, urgent, note }, user);
      toast(`${item.trim()} diajukan untuk restock`);
      setItem("");
      setQty(1);
      setNote("");
      setUrgent(false);
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-[2fr_90px_110px_1.3fr]">
        <Field label="Barang" htmlFor="rs-item">
          <Input
            id="rs-item"
            list="rs-known"
            value={item}
            onChange={(e) => {
              setItem(e.target.value);
              const prev = items.find((i) => i.item.toLowerCase() === e.target.value.trim().toLowerCase());
              if (prev) {
                setUnit(prev.unit);
                setCategory(prev.category);
              }
            }}
            placeholder="mis. Gel USG, tisu, handuk kecil"
            required
          />
          <datalist id="rs-known">
            {known.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </Field>
        <Field label="Jumlah" htmlFor="rs-qty">
          <Input id="rs-qty" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
        </Field>
        <Field label="Satuan" htmlFor="rs-unit">
          <Select id="rs-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </Select>
        </Field>
        <Field label="Kategori" htmlFor="rs-cat">
          <Select id="rs-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Catatan (opsional)" htmlFor="rs-note" className="md:col-span-2">
          <Input id="rs-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. merek biasa, tinggal 1 botol" />
        </Field>
        <div className="flex items-end gap-3 md:col-span-2">
          <div className="flex h-11 items-center md:h-10">
            <Switch checked={urgent} onChange={setUrgent} label="Urgent" />
          </div>
          <Button type="submit" loading={busy} icon={<PackagePlus className="size-4" />} className="flex-1">
            Ajukan restock
          </Button>
        </div>
      </form>
    </Card>
  );
}
