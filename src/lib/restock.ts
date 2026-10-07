import { store } from "./store";
import { dateKey, longDate } from "./format";
import type { Expense, RestockItem, RestockStatus } from "./types";
import type { Row } from "./store";

type Who = { email: string; name: string };

export const UNITS = ["pcs", "box", "pak", "botol", "roll", "lembar", "liter", "kg", "set", "tube"];
export const CATEGORIES = ["Alat terapi", "Medis & obat", "Kebersihan", "Linen & handuk", "ATK", "Pantry", "Lainnya"];

export async function submitRestock(
  input: Pick<RestockItem, "item" | "qty" | "unit" | "category" | "urgent" | "note">,
  by: Who,
) {
  const now = Date.now();
  const r: RestockItem = {
    item: input.item.trim(),
    qty: Math.max(1, Math.round(input.qty) || 1),
    unit: input.unit,
    category: input.category,
    urgent: input.urgent,
    note: input.note?.trim() || undefined,
    dateKey: dateKey(now),
    createdAt: now,
    createdBy: by.email,
    createdByName: by.name,
    status: "requested",
    orderedAt: null,
    orderedBy: null,
    orderedByName: null,
    done: false,
    doneAt: null,
    doneBy: null,
    doneByName: null,
  };
  return store.add("restock", r);
}

export const restockStatus = (r: RestockItem): RestockStatus => r.status ?? (r.done ? "received" : "requested");

/** The price of a restock order sits in the manager-only expenses, under this id. */
export const restockExpenseId = (restockId: string) => `restock_${restockId}`;

/**
 * Manager: correct the request, record what it cost, and mark it ordered (waiting to be received).
 * Also used to change an order later; the cost keeps the date it was first ordered.
 */
export async function orderRestock(
  r: Row<RestockItem>,
  input: Pick<RestockItem, "item" | "qty" | "unit" | "note"> & { price: number },
  by: Who,
) {
  const now = Date.now();
  const item = input.item.trim();
  const qty = Math.max(1, Math.round(input.qty) || 1);
  const first = restockStatus(r) === "requested";
  await store.transaction(async (tx) => {
    const cost = await tx.get<Expense>("expenses", restockExpenseId(r.id));
    tx.update("restock", r.id, {
      item,
      qty,
      unit: input.unit,
      note: input.note?.trim() || "",
      ...(first ? { status: "ordered", orderedAt: now, orderedBy: by.email, orderedByName: by.name } : {}),
    });
    tx.set("expenses", restockExpenseId(r.id), {
      dateKey: cost?.dateKey ?? dateKey(now),
      name: `Restock: ${item} (${qty} ${input.unit})`,
      amount: Math.max(0, Math.round(input.price) || 0),
      kind: "hpp",
      note: "",
      restockId: r.id,
      createdBy: cost?.createdBy ?? by.email,
      createdByName: cost?.createdByName ?? by.name,
      createdAt: cost?.createdAt ?? now,
    } satisfies Expense);
  });
}

/** Anyone: the ordered item has arrived (or undo that). */
export const receiveRestock = (id: string, received: boolean, by: Who) =>
  store.update(
    "restock",
    id,
    received
      ? { status: "received", done: true, doneAt: Date.now(), doneBy: by.email, doneByName: by.name }
      : { status: "ordered", done: false, doneAt: null, doneBy: null, doneByName: null },
  );

/** The manager removing an ordered item also drops its cost. */
export async function removeRestock(id: string, withCost: boolean) {
  await store.remove("restock", id);
  if (withCost) await store.remove("expenses", restockExpenseId(id)).catch(() => {});
}

/** Shopping list for whoever goes to buy: requested items not ordered yet, urgent first, merged by name and unit. */
export function shoppingListText(items: Row<RestockItem>[], label: string) {
  const open = items.filter((i) => restockStatus(i) === "requested");
  const merged = new Map<string, { item: string; qty: number; unit: string; urgent: boolean; category: string }>();
  for (const i of open) {
    const key = `${i.item.toLowerCase()}|${i.unit}`;
    const m = merged.get(key) ?? { item: i.item, qty: 0, unit: i.unit, urgent: false, category: i.category };
    m.qty += i.qty;
    m.urgent ||= i.urgent;
    merged.set(key, m);
  }
  const rows = [...merged.values()].sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.category.localeCompare(b.category));
  return [
    `Daftar restock ${label}`,
    "",
    ...rows.map((r, i) => `${i + 1}. ${r.item}: ${r.qty} ${r.unit}${r.urgent ? " (URGENT)" : ""} [${r.category}]`),
    "",
    `Dibuat ${longDate(Date.now())}`,
  ].join("\n");
}
