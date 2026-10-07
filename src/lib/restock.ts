import { store } from "./store";
import { dateKey, longDate } from "./format";
import type { RestockItem } from "./types";
import type { Row } from "./store";

export const UNITS = ["pcs", "box", "pak", "botol", "roll", "lembar", "liter", "kg", "set", "tube"];
export const CATEGORIES = ["Alat terapi", "Medis & obat", "Kebersihan", "Linen & handuk", "ATK", "Pantry", "Lainnya"];

export async function submitRestock(
  input: Pick<RestockItem, "item" | "qty" | "unit" | "category" | "urgent" | "note">,
  by: { email: string; name: string },
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
    done: false,
    doneAt: null,
    doneBy: null,
    doneByName: null,
  };
  return store.add("restock", r);
}

export const setRestocked = (id: string, done: boolean, by: { email: string; name: string }) =>
  store.update("restock", id, done ? { done, doneAt: Date.now(), doneBy: by.email, doneByName: by.name } : { done, doneAt: null, doneBy: null, doneByName: null });

export const removeRestock = (id: string) => store.remove("restock", id);

/** Shopping list for whoever goes to buy: open items, urgent first, merged by name and unit. */
export function shoppingListText(items: Row<RestockItem>[], label: string) {
  const open = items.filter((i) => !i.done);
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
