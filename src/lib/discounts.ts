"use client";

import { useMemo } from "react";
import { store, type Row } from "./store";
import { useCollection } from "./hooks";
import { dateKey, rupiah } from "./format";
import type { Discount } from "./types";

export function useDiscounts(includeInactive = false) {
  const { rows, loading } = useCollection<Discount>("discounts");
  const list = useMemo(() => {
    const today = dateKey();
    return (rows ?? [])
      .filter((d) => includeInactive || usable(d, today))
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "id"));
  }, [rows, includeInactive]);
  return { discounts: list, loading };
}

export const usable = (d: Discount, today = dateKey()) => d.active && (!d.validUntil || d.validUntil >= today);

/** Can this discount go on a line of this kind (or on the whole bill)? */
export const fits = (d: Discount, where: "service" | "package" | "bill") =>
  d.appliesTo === "all" || d.appliesTo === where;

/** Rupiah taken off `base`; never more than the base. */
export function discountAmount(d: Discount | null | undefined, base: number) {
  if (!d || base <= 0) return 0;
  let a = d.type === "percent" ? Math.round((base * d.value) / 100) : d.value;
  if (d.type === "percent" && d.maxAmount) a = Math.min(a, d.maxAmount);
  return Math.max(0, Math.min(Math.round(a), base));
}

export const discountValue = (d: Pick<Discount, "type" | "value" | "maxAmount">) =>
  d.type === "percent" ? `${d.value}%${d.maxAmount ? ` (maks ${rupiah(d.maxAmount)})` : ""}` : rupiah(d.value);

export const APPLIES_LABEL: Record<Discount["appliesTo"], string> = {
  all: "Semua item & total transaksi",
  service: "Layanan saja",
  package: "Paket sesi saja",
  bill: "Total transaksi saja",
};

export async function saveDiscount(id: string | null, d: Discount) {
  if (id) await store.update("discounts", id, { ...d });
  else await store.add("discounts", d);
}

export type DiscountMap = Record<string, Row<Discount>>;
