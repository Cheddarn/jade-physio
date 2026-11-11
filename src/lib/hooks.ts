"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { store, type Filter, type Row } from "./store";
import type { Customer, Package, Service, Staff } from "./types";

/* ---------------- Shared live queries ----------------
   Every component that asks for the same query shares one listener, and the result stays in memory
   for a while after the last one leaves. Moving between pages then shows data at once instead of a
   spinner, and the sidebar, alerts and page no longer each open their own copy of the same query. */

interface Entry {
  value: unknown;
  loaded: boolean;
  error: Error | null;
  /** Bumped on every change, so React knows when to re-render. */
  version: number;
  subs: Set<() => void>;
  stop: (() => void) | null;
  timer: ReturnType<typeof setTimeout> | null;
}

const cache = new Map<string, Entry>();
/** How long a query nobody is looking at stays live. */
const LINGER_MS = 90_000;

function retain(key: string, notify: () => void, start: (push: (value: unknown, error?: Error | null) => void) => () => void) {
  let e = cache.get(key);
  if (!e) {
    e = { value: null, loaded: false, error: null, version: 0, subs: new Set(), stop: null, timer: null };
    cache.set(key, e);
  }
  const entry = e;
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
  entry.subs.add(notify);
  if (!entry.stop) {
    let stop: (() => void) | null = null;
    stop = entry.stop = start((value, error = null) => {
      entry.value = value;
      entry.error = error;
      entry.loaded = true;
      entry.version++;
      // A listener that failed is over: whoever asks next starts a new one.
      if (error && entry.stop === stop) {
        queueMicrotask(() => stop?.());
        entry.stop = null;
      }
      entry.subs.forEach((n) => n());
    });
  }
  return () => {
    entry.subs.delete(notify);
    if (entry.subs.size || entry.timer) return;
    entry.timer = setTimeout(() => {
      entry.stop?.();
      if (cache.get(key) === entry) cache.delete(key);
    }, LINGER_MS);
  };
}

/** Drop everything held in memory, e.g. when someone signs out, so the next person never sees it. */
export function resetQueries() {
  for (const [key, e] of cache) {
    if (e.timer) clearTimeout(e.timer);
    e.stop?.();
    cache.delete(key);
    e.subs.forEach((n) => n());
  }
}

function useShared(key: string, start: (push: (value: unknown, error?: Error | null) => void) => () => void) {
  const subscribe = useCallback(
    (notify: () => void) => (key ? retain(key, notify, start) : () => {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  useSyncExternalStore(
    subscribe,
    () => (key ? (cache.get(key)?.version ?? -1) : -1),
    () => -1,
  );
  return key ? cache.get(key) : undefined;
}

export function useCollection<T>(col: string | null, filters: Filter[] = []) {
  const key = col ? JSON.stringify(["c", col, filters]) : "";
  const e = useShared(key, (push) =>
    store.watch<T>(
      col!,
      filters,
      (rows) => push(rows),
      // A query the rules refuse still answers, with nothing, so pages don't wait forever.
      (error) => push([], error),
    ),
  );
  const loaded = !!e?.loaded;
  return {
    rows: loaded ? (e!.value as Row<T>[]) : null,
    loading: col !== null && !loaded,
    error: e?.error ?? null,
  };
}

export function useDoc<T>(col: string, id: string | null | undefined) {
  const key = id ? JSON.stringify(["d", col, id]) : "";
  const e = useShared(key, (push) =>
    store.watchDoc<T>(
      col,
      id!,
      (row) => push(row),
      (error) => push(null, error),
    ),
  );
  const loaded = !!e?.loaded;
  return { row: loaded ? (e!.value as Row<T> | null) : null, loading: !!id && !loaded };
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
