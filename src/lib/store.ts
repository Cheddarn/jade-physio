import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type WhereFilterOp,
} from "firebase/firestore";
import { db, DEMO_MODE } from "./firebase";
import { demoStore } from "./store-demo";

export type Op = "==" | ">=" | "<=" | "<" | ">";
export type Filter = [field: string, op: Op, value: unknown];
export type Row<T> = T & { id: string };

export interface Tx {
  get<T>(col: string, id: string): Promise<Row<T> | null>;
  set(col: string, id: string, data: object): void;
  update(col: string, id: string, data: object): void;
}

export interface Store {
  watch<T>(col: string, filters: Filter[], cb: (rows: Row<T>[]) => void, onError?: (e: Error) => void): () => void;
  watchDoc<T>(col: string, id: string, cb: (row: Row<T> | null) => void, onError?: (e: Error) => void): () => void;
  list<T>(col: string, filters?: Filter[]): Promise<Row<T>[]>;
  get<T>(col: string, id: string): Promise<Row<T> | null>;
  add(col: string, data: object): Promise<string>;
  set(col: string, id: string, data: object): Promise<void>;
  update(col: string, id: string, data: object): Promise<void>;
  remove(col: string, id: string): Promise<void>;
  newId(col: string): string;
  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
}

const q = (col: string, filters: Filter[]) =>
  query(collection(db(), col), ...filters.map(([f, op, v]) => where(f, op as WhereFilterOp, v)));

const firebaseStore: Store = {
  watch(col, filters, cb, onError) {
    return onSnapshot(
      q(col, filters),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as never)),
      (e) => onError?.(e),
    );
  },
  watchDoc(col, id, cb, onError) {
    return onSnapshot(
      doc(db(), col, id),
      (d) => cb(d.exists() ? ({ id: d.id, ...(d.data() as object) } as never) : null),
      (e) => onError?.(e),
    );
  },
  async list(col, filters = []) {
    const snap = await getDocs(q(col, filters));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as never);
  },
  async get(col, id) {
    const d = await getDoc(doc(db(), col, id));
    return d.exists() ? ({ id: d.id, ...(d.data() as object) } as never) : null;
  },
  async add(col, data) {
    const ref = await addDoc(collection(db(), col), data);
    return ref.id;
  },
  async set(col, id, data) {
    await setDoc(doc(db(), col, id), data);
  },
  async update(col, id, data) {
    await updateDoc(doc(db(), col, id), data as never);
  },
  async remove(col, id) {
    await deleteDoc(doc(db(), col, id));
  },
  newId(col) {
    return doc(collection(db(), col)).id;
  },
  transaction(fn) {
    return runTransaction(db(), (t) =>
      fn({
        async get(col, id) {
          const d = await t.get(doc(db(), col, id));
          return d.exists() ? ({ id: d.id, ...(d.data() as object) } as never) : null;
        },
        set(col, id, data) {
          t.set(doc(db(), col, id), data);
        },
        update(col, id, data) {
          t.update(doc(db(), col, id), data as never);
        },
      }),
    );
  },
};

export const store: Store = DEMO_MODE ? demoStore : firebaseStore;
