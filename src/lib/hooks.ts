"use client";

import { useEffect, useMemo, useState } from "react";
import { store, type Filter, type Row } from "./store";
import type { Customer, Package, Service, Staff } from "./types";

export function useCollection<T>(col: string | null, filters: Filter[] = []) {
  const key = JSON.stringify([col, filters]);
  const [state, setState] = useState<{ key: string; rows: Row<T>[] | null; error: Error | null }>({
    key,
    rows: null,
    error: null,
  });

  useEffect(() => {
    if (!col) return;
    const unsub = store.watch<T>(
      col,
      filters,
      (rows) => setState({ key, rows, error: null }),
      (error) => setState({ key, rows: [], error }),
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const stale = state.key !== key;
  return {
    rows: stale ? null : state.rows,
    loading: col !== null && (stale || state.rows === null),
    error: stale ? null : state.error,
  };
}

export function useDoc<T>(col: string, id: string | null | undefined) {
  const [state, setState] = useState<{ id: string | null | undefined; row: Row<T> | null; loaded: boolean }>({
    id,
    row: null,
    loaded: false,
  });
  useEffect(() => {
    if (!id) return;
    return store.watchDoc<T>(col, id, (row) => setState({ id, row, loaded: true }));
  }, [col, id]);
  const stale = state.id !== id;
  return { row: stale ? null : state.row, loading: !!id && (stale || !state.loaded) };
}

const byOrder = (a: Row<Staff>, b: Row<Staff>) => a.order - b.order || a.name.localeCompare(b.name);
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, "id");

export function useStaff(includeInactive = false) {
  const { rows, loading } = useCollection<Staff>("staff");
  const list = useMemo(
    () => (rows ?? []).filter((s) => includeInactive || s.active).sort(byOrder),
    [rows, includeInactive],
  );
  return { staff: list, loading };
}

export function useServices(includeInactive = false) {
  const { rows, loading } = useCollection<Service>("services");
  const list = useMemo(
    () => (rows ?? []).filter((s) => includeInactive || s.active).sort(byName),
    [rows, includeInactive],
  );
  return { services: list, loading };
}

export function usePackages(includeInactive = false) {
  const { rows, loading } = useCollection<Package>("packages");
  const list = useMemo(
    () => (rows ?? []).filter((s) => includeInactive || s.active).sort((a, b) => a.price - b.price),
    [rows, includeInactive],
  );
  return { packages: list, loading };
}

export function useCustomers() {
  const { rows, loading } = useCollection<Customer>("customers");
  const list = useMemo(() => (rows ?? []).slice().sort(byName), [rows]);
  return { customers: list, loading };
}

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useMediaQuery(q: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [q]);
  return match;
}
