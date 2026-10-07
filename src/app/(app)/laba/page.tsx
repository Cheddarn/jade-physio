"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, PackagePlus, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Empty, Field, Input, MoneyInput, PageHeader, Sheet, Spinner, Textarea, cx, errorText, useToast } from "@/components/ui";
import { DateRangePicker, presetRange, type Range } from "@/components/DateRange";
import { useUser } from "@/lib/auth";
import { useCollection } from "@/lib/hooks";
import { dateKey, rupiah, shortDate } from "@/lib/format";
import { EXPENSE_KIND, profitOf, removeExpense, saveExpense, useExpenses } from "@/lib/expenses";
import type { Row } from "@/lib/store";
import type { Expense, Sale } from "@/lib/types";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function LabaPage() {
  const [range, setRange] = useState<Range>(() => presetRange("month"));
  const { rows: sales, loading } = useCollection<Sale>("sales", [
    ["dateKey", ">=", range.from],
    ["dateKey", "<=", range.to],
  ]);
  const { expenses, loading: costsLoading } = useExpenses(range);
  const [edit, setEdit] = useState<Row<Expense> | "new" | null>(null);
  const p = profitOf(sales ?? [], expenses);

  return (
    <div className="mx-auto max-w-5xl pb-10">
      <PageHeader
        title="Laba & biaya"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" />
            Hanya terlihat oleh manajer
          </span>
        }
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEdit("new")}>
            Biaya
          </Button>
        }
      />
      <div className="flex flex-col gap-6 px-4 md:px-8">
        <DateRangePicker value={range} onChange={setRange} />

        {loading || costsLoading ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <Kpi label="Pemasukan" value={rupiah(p.revenue)} sub="Faktur lunas" />
              <Kpi label="Modal / HPP" value={rupiah(p.hpp)} sub="Restock dan bahan" minus />
              <Kpi label="Laba kotor" value={rupiah(p.gross)} sub={`Margin ${pct(p.grossMargin)}`} strong negative={p.gross < 0} />
              <Kpi label="Biaya operasional" value={rupiah(p.operasional)} sub="Sewa, gaji, dan lain-lain" minus />
              <Kpi label="Laba bersih" value={rupiah(p.net)} sub={`Margin ${pct(p.netMargin)}`} strong negative={p.net < 0} className="col-span-2 xl:col-span-1" />
            </div>

            <section>
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-[13px] font-semibold text-ink-2">Biaya</h2>
                  <p className="text-[13px] text-muted">Harga restock masuk otomatis sebagai modal. Tambahkan biaya lain dengan tombol Biaya.</p>
                </div>
              </div>
              {expenses.length === 0 ? (
                <Card>
                  <Empty icon={<PackagePlus className="size-5" />} title="Belum ada biaya di rentang ini" body="Biaya restock muncul setelah manajer memproses pesanan." />
                </Card>
              ) : (
                <Card className="divide-y divide-line-soft">
                  {expenses.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{e.name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                          <span>{shortDate(e.dateKey)}</span>
                          <Badge tone={e.kind === "hpp" ? "amber" : "neutral"} className="!h-5 !px-2 !text-[11px]">
                            {EXPENSE_KIND[e.kind].label}
                          </Badge>
                          {e.note && <span className="truncate">{e.note}</span>}
                        </p>
                      </div>
                      <p className="tnum shrink-0 font-bold">{rupiah(e.amount)}</p>
                      {e.restockId ? (
                        <Link href="/restock" className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-semibold text-jade hover:bg-jade-mist">
                          Restock
                        </Link>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setEdit(e)}>
                          Ubah
                        </Button>
                      )}
                    </div>
                  ))}
                </Card>
              )}
            </section>
          </>
        )}
      </div>
      <ExpenseSheet value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  strong,
  minus,
  negative,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  strong?: boolean;
  minus?: boolean;
  negative?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border p-3.5 md:p-4",
        strong ? (negative ? "border-danger bg-danger text-white" : "border-jade-deep bg-jade-deep text-white") : "border-line bg-surface",
        className,
      )}
    >
      <p className={cx("text-[13px]", strong ? "text-white/75" : "text-muted")}>{label}</p>
      <p className="tnum mt-1 text-lg font-bold tracking-[-0.01em] whitespace-nowrap md:text-[22px] xl:text-lg">
        {minus && <span className="mr-0.5 text-muted">−</span>}
        {value}
      </p>
      {sub && <p className={cx("tnum mt-0.5 truncate text-xs md:text-[13px]", strong ? "text-white/75" : "text-muted")}>{sub}</p>}
    </div>
  );
}

/** Add or change a cost the manager enters by hand. */
function ExpenseSheet({ value, onClose }: { value: Row<Expense> | "new" | null; onClose: () => void }) {
  const user = useUser();
  const toast = useToast();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [day, setDay] = useState(dateKey());
  const [kind, setKind] = useState<Expense["kind"]>("hpp");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<unknown>(null);
  if (value !== openedFor) {
    setOpenedFor(value);
    const e = value && value !== "new" ? value : null;
    setName(e?.name ?? "");
    setAmount(e?.amount ?? 0);
    setDay(e?.dateKey ?? dateKey());
    setKind(e?.kind ?? "hpp");
    setNote(e?.note ?? "");
  }
  const editing = value && value !== "new" ? value : null;

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      toast(done);
      onClose();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={editing ? "Ubah biaya" : "Biaya baru"}
      footer={
        <div className="flex gap-2">
          {editing && (
            <Button variant="danger" size="lg" icon={<Trash2 className="size-4" />} disabled={busy} onClick={() => run(() => removeExpense(editing.id), "Biaya dihapus")}>
              Hapus
            </Button>
          )}
          <Button
            size="lg"
            block
            loading={busy}
            disabled={!name.trim() || amount <= 0 || !day}
            onClick={() => run(() => saveExpense(editing?.id ?? null, { dateKey: day, name, amount, kind, note }, user), "Biaya disimpan")}
          >
            Simpan
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Nama biaya" htmlFor="ex-name">
          <Input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Sewa ruko Oktober, listrik, iklan TikTok" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jumlah" htmlFor="ex-amount">
            <MoneyInput id="ex-amount" value={amount} onChange={setAmount} />
          </Field>
          <Field label="Tanggal" htmlFor="ex-day">
            <Input id="ex-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
        </div>
        <Field label="Jenis">
          <div className="grid gap-2">
            {(Object.keys(EXPENSE_KIND) as Expense["kind"][]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={cx(
                  "rounded-xl border px-3.5 py-3 text-left transition-colors",
                  kind === k ? "border-jade bg-jade-mist/50 ring-1 ring-jade" : "border-line hover:border-ink-2/30",
                )}
              >
                <span className="block text-sm font-semibold">{EXPENSE_KIND[k].label}</span>
                <span className="block text-[13px] text-muted">{EXPENSE_KIND[k].hint}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Catatan (opsional)" htmlFor="ex-note">
          <Textarea id="ex-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>
      </div>
    </Sheet>
  );
}
