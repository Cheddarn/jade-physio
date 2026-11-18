import { deleteObject, listAll, ref } from "firebase/storage";
import { store } from "./store";
import { DEMO_MODE, storage } from "./firebase";
import type { Sale, TherapyReport } from "./types";

/*
  Clearing the test data before the clinic starts for real (admin only). Patients and everything that happened to them
  goes; the set-up stays. Payments, vouchers, receipts and patient requests can't normally be deleted (they are the
  clinic's records), so the admin first opens a short reset window (meta/reset) that the Firestore rules check.
*/

export const CLEARED: { col: string; label: string }[] = [
  { col: "customers", label: "Pasien" },
  { col: "bookings", label: "Booking" },
  { col: "reports", label: "Laporan terapi" },
  { col: "visits", label: "Kunjungan (alur pasien)" },
  { col: "sales", label: "Transaksi dan faktur" },
  { col: "vouchers", label: "Voucher paket pasien" },
  { col: "requests", label: "Permintaan booking dari pasien" },
  { col: "memos", label: "Pengingat" },
  { col: "attendance", label: "Absensi" },
  { col: "restock", label: "Permintaan restock" },
  { col: "expenses", label: "Biaya" },
  { col: "payDays", label: "Kompensasi harian" },
];

export const KEPT = [
  "Akun login semua peran",
  "Fisioterapis, tim, dan shift",
  "Layanan, paket, dan diskon",
  "Jam buka, komisi, dan template WhatsApp",
  "Pilihan cepat dan tanda tangan fisioterapis",
];

/** How many documents each cleared collection holds now; -1 where this account can't look (the manager's costs). */
export async function countCleared(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    CLEARED.map(async ({ col }) => {
      try {
        out[col] = (await store.list(col)).length;
      } catch {
        out[col] = -1;
      }
    }),
  );
  return out;
}

async function removeAll(col: string, ids: string[], onDone: (n: number) => void) {
  for (let i = 0; i < ids.length; i += 25) {
    await Promise.all(ids.slice(i, i + 25).map((id) => store.remove(col, id)));
    onDone(Math.min(ids.length, i + 25));
  }
}

/** Uploaded report files (reports/{bookingId}/{file}): those the reports point to, then any left in the folder. */
async function removeReportFiles() {
  if (DEMO_MODE) return 0;
  let n = 0;
  const gone = async (path: string) => {
    try {
      await deleteObject(ref(storage(), path));
      n++;
    } catch {
      /* already gone, or not allowed */
    }
  };
  const reports = await store.list<TherapyReport>("reports");
  for (const r of reports) if (r.file?.path) await gone(r.file.path);
  try {
    const top = await listAll(ref(storage(), "reports"));
    const folders = await Promise.all(top.prefixes.map((p) => listAll(p)));
    for (const f of [...top.items, ...folders.flatMap((x) => x.items)]) await gone(f.fullPath);
  } catch {
    /* listing the folder isn't allowed: the files the reports pointed to are gone */
  }
  return n;
}

export type Step = { label: string; done: number; total: number };

/**
 * Delete the test data. `by` is the admin's sign-in, who opens the reset window. Each kind of record is deleted on its
 * own: if the Firestore rules for the reset window aren't published yet, patients, bookings, reports and the rest an
 * admin may always delete still go, and the ones that need the window are reported in `failed`.
 */
export async function clearData(by: string, onStep: (s: Step) => void): Promise<{ removed: Record<string, number>; failed: string[] }> {
  const removed: Record<string, number> = {};
  const failed: string[] = [];
  let windowOpen = false;
  try {
    await store.set("meta", "reset", { by, until: Date.now() + 20 * 60_000, startedAt: Date.now() });
    windowOpen = true;
  } catch {
    /* rules not published yet: carry on with what an admin may delete anyway */
  }
  try {
    // Public receipt links hang off the sales.
    try {
      const sales = await store.list<Sale>("sales");
      const tokens = sales.map((s) => s.receiptToken).filter((t): t is string => !!t);
      onStep({ label: "Tautan struk", done: 0, total: tokens.length });
      await removeAll("receipts", tokens, (d) => onStep({ label: "Tautan struk", done: d, total: tokens.length }));
    } catch {
      failed.push("Tautan struk");
    }

    onStep({ label: "File laporan", done: 0, total: 0 });
    try {
      removed.files = await removeReportFiles();
    } catch {
      removed.files = 0;
    }

    for (const { col, label } of CLEARED) {
      try {
        const ids = (await store.list(col)).map((d) => d.id);
        onStep({ label, done: 0, total: ids.length });
        await removeAll(col, ids, (d) => onStep({ label, done: d, total: ids.length }));
        removed[col] = ids.length;
      } catch {
        failed.push(label);
      }
    }

    // Invoice numbers start again from 1.
    try {
      await store.remove("meta", "counters");
    } catch {
      /* none yet */
    }
  } finally {
    if (windowOpen) await store.remove("meta", "reset").catch(() => {});
  }
  return { removed, failed };
}
