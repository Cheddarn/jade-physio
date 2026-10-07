import { useMemo } from "react";
import { store } from "./store";
import { useCollection } from "./hooks";
import type { Expense, Sale } from "./types";

/* The manager's costs and profit. Nobody else can read expenses (firestore.rules: managerOnly). */

type Who = { email: string; name: string };

export const EXPENSE_KIND: Record<Expense["kind"], { label: string; hint: string }> = {
  hpp: { label: "Modal / HPP", hint: "Barang dan bahan untuk layanan, termasuk restock. Mengurangi laba kotor." },
  operasional: { label: "Operasional", hint: "Sewa, listrik, gaji, iklan, dan biaya rutin lain. Mengurangi laba bersih." },
};

/** Costs dated within the range, newest first. */
export function useExpenses(range: { from: string; to: string }, enabled = true) {
  const { rows, loading } = useCollection<Expense>(enabled ? "expenses" : null, [
    ["dateKey", ">=", range.from],
    ["dateKey", "<=", range.to],
  ]);
  const expenses = useMemo(() => [...(rows ?? [])].sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.createdAt - a.createdAt), [rows]);
  return { expenses, loading };
}

/**
 * Pemasukan (paid sales) minus modal/HPP is laba kotor; minus operating costs on top is laba bersih.
 * Margins are a share of pemasukan.
 */
export function profitOf(sales: Sale[], expenses: Expense[]) {
  const revenue = sales.filter((s) => s.status === "paid").reduce((t, s) => t + s.total, 0);
  const hpp = expenses.filter((e) => e.kind === "hpp").reduce((t, e) => t + e.amount, 0);
  const operasional = expenses.filter((e) => e.kind === "operasional").reduce((t, e) => t + e.amount, 0);
  const gross = revenue - hpp;
  const net = gross - operasional;
  return { revenue, hpp, operasional, gross, net, grossMargin: revenue ? gross / revenue : 0, netMargin: revenue ? net / revenue : 0 };
}

export async function saveExpense(id: string | null, data: Pick<Expense, "dateKey" | "name" | "amount" | "kind" | "note">, by: Who) {
  const clean = { ...data, name: data.name.trim(), amount: Math.max(0, Math.round(data.amount) || 0), note: data.note?.trim() || "" };
  if (id) return store.update("expenses", id, clean);
  await store.add("expenses", { ...clean, restockId: null, createdBy: by.email, createdByName: by.name, createdAt: Date.now() } satisfies Expense);
}

export const removeExpense = (id: string) => store.remove("expenses", id);
