"use client";

import { Pager, usePager } from "@/components/Pager";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardCopy, PackageCheck, PackagePlus, Pencil, ShoppingCart, Trash2, Truck, Undo2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  IconButton,
  Input,
  MoneyInput,
  PageHeader,
  Segmented,
  Select,
  Sheet,
  Spinner,
  Switch,
  cx,
  errorText,
  useToast,
} from "@/components/ui";
import { useCan, useUser } from "@/lib/auth";
import { useCollection } from "@/lib/hooks";
import { dateKey, fromDateKey, pad, rupiah, time } from "@/lib/format";
import { CATEGORIES, UNITS, orderRestock, receiveRestock, removeRestock, restockStatus, shoppingListText, submitRestock } from "@/lib/restock";
import type { Row } from "@/lib/store";
import type { Expense, RestockItem, RestockStatus } from "@/lib/types";

type Show = "semua" | RestockStatus;

const STATUS_LABEL: Record<RestockStatus, string> = {
  requested: "Diajukan",
  ordered: "Menunggu barang",
  received: "Diterima",
};

// What still needs doing first.
const STATUS_ORDER: Record<RestockStatus, number> = { requested: 0, ordered: 1, received: 2 };

const shortDay = (ms: number) => fromDateKey(dateKey(ms)).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

export default function RestockPage() {
  const user = useUser();
  const can = useCan();
  const toast = useToast();
  // The manager buys: corrects the request, records the price, and marks it ordered.
  const manager = can("restock.manage");
  const [month, setMonth] = useState(() => dateKey().slice(0, 7));
  const [show, setShow] = useState<Show>("semua");
  const [processing, setProcessing] = useState<Row<RestockItem> | null>(null);
  const d = fromDateKey(`${month}-01`);
  const first = `${month}-01`;
  const last = dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const { rows, loading } = useCollection<RestockItem>("restock", [
    ["dateKey", ">=", first],
    ["dateKey", "<=", last],
  ]);
  // Prices are only in the manager's expenses.
  const { rows: costs } = useCollection<Expense>(manager ? "expenses" : null, [["restockId", ">", ""]]);
  const priceOf = useMemo(() => new Map((costs ?? []).map((c) => [c.restockId!, c.amount])), [costs]);
  const all = useMemo(() => (rows ?? []).filter((r) => r.dateKey >= first && r.dateKey <= last), [rows, first, last]);
  const list = useMemo(
    () =>
      all
        .filter((r) => show === "semua" || restockStatus(r) === show)
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || Number(b.urgent) - Number(a.urgent) || b.createdAt - a.createdAt),
    [all, show],
  );
  const pager = usePager(list, "restock", 25);
  // One list per day, newest day first; what still needs doing on top within a day.
  const days = useMemo(() => {
    const m = new Map<string, Row<RestockItem>[]>();
    for (const r of pager.shown) m.set(r.dateKey, [...(m.get(r.dateKey) ?? []), r]);
    for (const items of m.values())
      items.sort(
        (a, b) => STATUS_ORDER[restockStatus(a)] - STATUS_ORDER[restockStatus(b)] || Number(b.urgent) - Number(a.urgent) || b.createdAt - a.createdAt,
      );
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [pager.shown]);
  const count = (s: RestockStatus) => all.filter((r) => restockStatus(r) === s).length;
  const requested = count("requested");
  const waiting = count("ordered");
  const spent = all.reduce((sum, r) => sum + (priceOf.get(r.id) ?? 0), 0);
  const label = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const shift = (n: number) => {
    const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
    setMonth(`${x.getFullYear()}-${pad(x.getMonth() + 1)}`);
  };

  async function copyList() {
    const text = shoppingListText(all, label);
    try {
      await navigator.clipboard.writeText(text);
      toast(`${requested} barang disalin sebagai daftar belanja`);
    } catch {
      window.prompt("Salin daftar belanja:", text);
    }
  }

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <PageHeader
        title="Restock barang"
        subtitle="Semua staf bisa mengajukan barang yang hampir habis. Manajer memesan, lalu staf mengonfirmasi saat barangnya datang."
      />
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
          <Badge tone={requested ? "amber" : "jade"}>{requested} diajukan</Badge>
          <Badge tone={waiting ? "amber" : "neutral"}>{waiting} menunggu barang</Badge>
          {manager && spent > 0 && <Badge tone="outline">{rupiah(spent)} dibelanjakan</Badge>}
          {manager && (
            <Button size="sm" variant="secondary" className="ml-auto" icon={<ClipboardCopy className="size-3.5" />} disabled={!requested} onClick={copyList}>
              Salin daftar belanja
            </Button>
          )}
        </div>

        <Segmented
          className="w-full md:w-auto"
          value={show}
          onChange={setShow}
          options={[
            { value: "semua", label: "Semua" },
            { value: "requested", label: `Diajukan (${requested})` },
            { value: "ordered", label: `Menunggu barang (${waiting})` },
            { value: "received", label: "Diterima" },
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
            const left = items.filter((i) => restockStatus(i) !== "received").length;
            return (
              <section key={key}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-2">
                  {fromDateKey(key).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                  {key === dateKey() && <Badge tone="jade">Hari ini</Badge>}
                  <span className="text-xs font-medium text-muted">
                    {items.length} barang{left ? `, ${left} belum diterima` : ", semua sudah diterima"}
                  </span>
                </h2>
                <Card className="divide-y divide-line-soft">
                  {items.map((r) => (
                    <RestockRow
                      key={r.id}
                      r={r}
                      manager={manager}
                      price={priceOf.get(r.id)}
                      canDelete={manager || (restockStatus(r) === "requested" && r.createdBy === user.email)}
                      onProcess={() => setProcessing(r)}
                    />
                  ))}
                </Card>
              </section>
            );
          })
        )}
        {!loading && list.length > 0 && <Pager pager={pager} label="barang" />}
      </div>
      {manager && <OrderSheet r={processing} price={processing ? priceOf.get(processing.id) : undefined} onClose={() => setProcessing(null)} />}
    </div>
  );
}

function RestockRow({
  r,
  manager,
  price,
  canDelete,
  onProcess,
}: {
  r: Row<RestockItem>;
  manager: boolean;
  price?: number;
  canDelete: boolean;
  onProcess: () => void;
}) {
  const user = useUser();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const status = restockStatus(r);

  async function receive(received: boolean) {
    setBusy(true);
    try {
      await receiveRestock(r.id, received, user);
      if (received) toast(`${r.item} sudah diterima`);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cx("flex flex-wrap items-start gap-3 px-4 py-3 sm:flex-nowrap", status === "received" && "bg-canvas/50")}>
      <span
        className={cx(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
          status === "requested" ? "bg-amber-mist text-amber" : status === "ordered" ? "bg-line-soft text-ink-2" : "bg-jade-mist text-jade-deep",
        )}
        aria-hidden
      >
        {status === "requested" ? <ShoppingCart className="size-4" /> : status === "ordered" ? <Truck className="size-4" /> : <PackageCheck className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx("font-semibold", status === "received" && "text-muted")}>
          {r.item}
          <span className="tnum ml-2 font-bold text-ink">
            {r.qty} {r.unit}
          </span>
          {manager && price != null && <span className="tnum ml-2 text-[13px] font-semibold text-ink-2">{rupiah(price)}</span>}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
          <span
            className={cx(
              "rounded-full px-2 py-0.5 font-bold",
              status === "requested" ? "bg-amber-mist text-amber" : status === "ordered" ? "bg-line-soft text-ink-2" : "bg-jade-mist text-jade-deep",
            )}
          >
            {STATUS_LABEL[status]}
          </span>
          <span className="rounded-full bg-line-soft px-2 py-0.5 font-semibold text-ink-2">{r.category}</span>
          {r.urgent && status !== "received" && <span className="rounded-full bg-danger-mist px-2 py-0.5 font-bold text-danger">Urgent</span>}
          <span>
            Diajukan {r.createdByName}, {time(r.createdAt)}
          </span>
          {r.orderedAt && (
            <span>
              Dipesan {r.orderedByName}, {shortDay(r.orderedAt)}
            </span>
          )}
          {status === "received" && r.doneAt && (
            <span className="font-semibold text-jade-deep">
              Diterima {r.doneByName}, {shortDay(r.doneAt)} {time(r.doneAt)}
            </span>
          )}
        </p>
        {r.note && <p className="mt-1 text-[13px] text-ink-2">{r.note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1 max-sm:w-full max-sm:justify-end">
        {status === "requested" &&
          (manager ? (
            <Button size="sm" icon={<ShoppingCart className="size-3.5" />} onClick={onProcess}>
              Proses
            </Button>
          ) : (
            <span className="text-[12px] text-muted">Menunggu manajer</span>
          ))}
        {status === "ordered" && (
          <>
            {manager && (
              <IconButton label={`Ubah pesanan ${r.item}`} className="size-9" onClick={onProcess}>
                <Pencil className="size-4" />
              </IconButton>
            )}
            <Button size="sm" icon={<PackageCheck className="size-3.5" />} loading={busy} onClick={() => receive(true)}>
              Barang datang
            </Button>
          </>
        )}
        {status === "received" && (
          <IconButton label={`Batalkan diterima ${r.item}`} className="size-9" disabled={busy} onClick={() => receive(false)}>
            <Undo2 className="size-4" />
          </IconButton>
        )}
        {canDelete && (
          <IconButton
            label={`Hapus ${r.item}`}
            className="size-9 hover:bg-danger-mist hover:text-danger"
            onClick={async () => {
              try {
                await removeRestock(r.id, manager);
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
    </div>
  );
}

/** Manager: correct the request, enter what it cost, and order it. */
function OrderSheet({ r, price, onClose }: { r: Row<RestockItem> | null; price?: number; onClose: () => void }) {
  const user = useUser();
  const toast = useToast();
  const [item, setItem] = useState("");
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState("pcs");
  const [cost, setCost] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<unknown>(null);
  if (r !== openedFor) {
    setOpenedFor(r);
    if (r) {
      setItem(r.item);
      setQty(r.qty);
      setUnit(r.unit);
      setCost(price ?? 0);
      setNote(r.note ?? "");
    }
  }
  const first = !!r && restockStatus(r) === "requested";

  async function save() {
    if (!r) return;
    setBusy(true);
    try {
      await orderRestock(r, { item, qty, unit, note, price: cost }, user);
      toast(first ? `${item.trim()} dipesan, menunggu barang datang` : "Pesanan diperbarui");
      onClose();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={!!r}
      onClose={onClose}
      title={first ? "Proses restock" : "Ubah pesanan"}
      footer={
        <Button size="lg" block loading={busy} disabled={!item.trim()} icon={<Truck className="size-4" />} onClick={save}>
          {first ? "Konfirmasi pesanan" : "Simpan"}
        </Button>
      }
    >
      {r && (
        <div className="flex flex-col gap-5">
          <p className="rounded-xl bg-canvas px-4 py-3 text-[13px] text-ink-2">
            Diajukan {r.createdByName}: <span className="font-semibold">{r.item}</span>, {r.qty} {r.unit}
            {r.urgent ? " (urgent)" : ""}
          </p>
          <Field label="Nama barang" htmlFor="ro-item">
            <Input id="ro-item" value={item} onChange={(e) => setItem(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jumlah" htmlFor="ro-qty">
              <Input id="ro-qty" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
            </Field>
            <Field label="Satuan" htmlFor="ro-unit">
              <Select id="ro-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {[...new Set([...UNITS, unit])].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field
            label="Harga total"
            htmlFor="ro-price"
            hint={cost > 0 && qty > 1 ? `${rupiah(Math.round(cost / qty))} per ${unit}` : "Hanya terlihat oleh manajer, dan masuk ke laporan laba sebagai modal (HPP)."}
          >
            <MoneyInput id="ro-price" value={cost} onChange={setCost} />
          </Field>
          <Field label="Catatan (opsional)" htmlFor="ro-note">
            <Input id="ro-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. dibeli di Toko Medika, sampai 2 hari lagi" />
          </Field>
          {first && <p className="text-[13px] text-muted">Setelah dikonfirmasi, staf menekan Barang datang saat barangnya sampai.</p>}
        </div>
      )}
    </Sheet>
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
