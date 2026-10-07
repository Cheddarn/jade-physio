"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BadgePercent,
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageCircle,
  CreditCard,
  Landmark,
  Minus,
  Plus,
  QrCode,
  ReceiptText,
  Ticket,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  Field,
  Input,
  MoneyInput,
  Segmented,
  Select,
  Sheet,
  Spinner,
  cx,
  errorText,
  useToast,
} from "@/components/ui";
import { Beads, VoucherCard } from "@/components/Beads";
import { CustomerPicker, waLink } from "@/components/CustomerPicker";
import { useCollection, useCustomers, useDoc, usePackages, useServices, useStaff } from "@/lib/hooks";
import { cartTotals, checkout, voucherCovers, voucherState, type CartLine } from "@/lib/actions";
import { useCan, useUser } from "@/lib/auth";
import { discountAmount, discountValue, fits, useDiscounts } from "@/lib/discounts";
import { useSettings, useTeam } from "@/lib/settings";
import { waMessage } from "@/lib/templates";
import { PAYMENT_LABEL, duration, remaining, rupiah, shortDate, staffColor, time, validityText } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Booking, Customer, Package, PaymentMethod, Voucher } from "@/lib/types";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Checkout />
    </Suspense>
  );
}

const METHODS: { value: PaymentMethod; label: string; icon: typeof QrCode }[] = [
  { value: "qris", label: "QRIS", icon: QrCode },
  { value: "transfer", label: "Transfer bank", icon: Landmark },
  { value: "card", label: "Kartu", icon: CreditCard },
];

let keySeq = 0;
const newKey = () => `l${++keySeq}${Date.now().toString(36)}`;

function Checkout() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const bookingId = params.get("booking");
  const customerParam = params.get("customer");
  const packageParam = params.get("package");

  const { row: booking, loading: bookingLoading } = useDoc<Booking>("bookings", bookingId);
  const { customers } = useCustomers();
  const { services } = useServices(true);
  const { packages } = usePackages(true);
  const { staff } = useStaff();
  const { team } = useTeam();
  // Anyone at the clinic can be credited with a package sale; the cashier by default.
  const sellers = team.filter((t) => t.role !== "cleaning");

  const [customer, setCustomer] = useState<Row<Customer> | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [billDiscountId, setBillDiscountId] = useState("");
  const [manualDiscount, setManualDiscount] = useState(0);
  const can = useCan();
  const { discounts } = useDiscounts();
  const discountMap = useMemo(() => Object.fromEntries(discounts.map((d) => [d.id, d])), [discounts]);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ saleId: string; invoiceNo: string; receiptToken: string; total: number; method: string } | null>(null);
  const manual = useRef(new Set<string>());
  const initialised = useRef(false);

  // Initialise the cart from the booking or query params once.
  useEffect(() => {
    if (initialised.current) return;
    if (bookingId) {
      if (bookingLoading || !booking) return;
      if (booking.packageId && packages.length === 0) return;
      initialised.current = true;
      setCustomer(
        customers.find((c) => c.id === booking.customerId) ?? {
          id: booking.customerId,
          name: booking.customerName,
          nameLower: booking.customerName.toLowerCase(),
          phone: booking.customerPhone ?? "",
          createdAt: 0,
        },
      );
      // Package picked when booking: sell it here and pay this session with it.
      const pkg = booking.status !== "paid" ? packages.find((p) => p.id === booking.packageId) : undefined;
      const pkgKey = newKey();
      setLines([
        {
          key: newKey(),
          kind: "service",
          refId: booking.serviceId,
          name: booking.serviceName,
          unitPrice: booking.price,
          qty: 1,
          staffId: booking.staffId,
          staffName: booking.staffName,
          bookingId: booking.id,
          voucherId: pkg ? `new:${pkgKey}` : undefined,
        },
        ...(pkg ? [{ key: pkgKey, kind: "package" as const, refId: pkg.id, name: pkg.name, unitPrice: pkg.price, qty: 1, soldBy: user.email, soldByName: user.name }] : []),
      ]);
      return;
    }
    if (customerParam && customers.length === 0) return;
    if (packageParam && packages.length === 0) return;
    initialised.current = true;
    if (customerParam) setCustomer(customers.find((c) => c.id === customerParam) ?? null);
    const pkg = packages.find((p) => p.id === packageParam);
    if (pkg) setLines([{ key: newKey(), kind: "package", refId: pkg.id, name: pkg.name, unitPrice: pkg.price, qty: 1, soldBy: user.email, soldByName: user.name }]);
  }, [bookingId, booking, bookingLoading, customers, packages, customerParam, packageParam]);

  const { rows: voucherRows } = useCollection<Voucher>(customer ? "vouchers" : null, [
    ["customerId", "==", customer?.id ?? ""],
  ]);
  const vouchers = useMemo(
    () =>
      (voucherRows ?? [])
        .filter((v) => voucherState(v) === "active")
        .sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity)),
    [voucherRows],
  );
  const pkgById = useMemo(() => Object.fromEntries(packages.map((p) => [p.id, p])), [packages]);

  /** Voucher options for a line, respecting sessions already claimed by other lines. */
  function optionsFor(line: CartLine, all: CartLine[]) {
    if (line.kind !== "service") return [];
    const claimed = (id: string) =>
      all.filter((l) => l.key !== line.key && l.voucherId === id).reduce((s, l) => s + l.qty, 0);
    const existing = vouchers
      .filter((v) => voucherCovers(v, line.refId) && remaining(v) - claimed(v.id) >= line.qty)
      .map((v) => ({ id: v.id, label: v.name, left: remaining(v) - claimed(v.id), total: v.totalSessions, used: v.usedSessions + claimed(v.id), isNew: false }));
    const fresh = all
      .filter((l) => l.kind === "package" && pkgById[l.refId])
      .filter((l) => {
        const p = pkgById[l.refId];
        return (p.serviceIds.length === 0 || p.serviceIds.includes(line.refId)) && p.sessions - claimed(`new:${l.key}`) >= line.qty;
      })
      .map((l) => {
        const p = pkgById[l.refId];
        return { id: `new:${l.key}`, label: `${p.name} (baru)`, left: p.sessions - claimed(`new:${l.key}`), total: p.sessions, used: claimed(`new:${l.key}`), isNew: true };
      });
    return [...existing, ...fresh];
  }

  // Auto-apply a voucher to service lines the admin hasn't decided on yet.
  useEffect(() => {
    setLines((prev) => {
      let changed = false;
      const next = prev.map((l) => ({ ...l }));
      for (const l of next) {
        if (l.kind !== "service" || manual.current.has(l.key)) continue;
        const opts = optionsFor(l, next);
        if (l.voucherId && !opts.some((o) => o.id === l.voucherId)) {
          l.voucherId = undefined;
          changed = true;
        }
        if (!l.voucherId && opts.length) {
          // The package chosen when booking wins over the soonest-expiring one.
          const wanted = l.bookingId && l.bookingId === booking?.id ? booking.voucherId : null;
          l.voucherId = (opts.find((o) => o.id === wanted) ?? opts[0]).id;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vouchers, booking?.voucherId, lines.length, lines.map((l) => `${l.key}:${l.qty}:${l.refId}`).join(",")]);

  const totals = cartTotals(lines, { discountId: billDiscountId, manual: manualDiscount }, discountMap);
  const needsMethod = totals.total > 0;
  const alreadyPaid = booking?.status === "paid";

  function updateLine(key: string, patch: Partial<CartLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError("");
    if (!customer) return setError("Pilih pelanggan dulu.");
    if (lines.length === 0) return setError("Keranjang masih kosong.");
    if (needsMethod && !method) return setError("Pilih metode pembayaran.");
    setBusy(true);
    try {
      const res = await checkout({
        customer,
        bookingId: booking?.id,
        lines,
        billDiscountId: billDiscountId || undefined,
        manualDiscount: can("discounts.manage") ? manualDiscount : 0,
        discounts: discountMap,
        paymentMethod: needsMethod ? method : null,
        paymentRef,
        packages: pkgById as Record<string, Row<Package>>,
        createdBy: user.email,
        createdByName: user.name,
      });
      setDone({ ...res, total: totals.total, method: needsMethod ? PAYMENT_LABEL[method!] : "Voucher" });
      toast(`Checkout selesai, ${res.invoiceNo}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (done && customer) return <Done done={done} customer={customer} />;
  if (bookingId && bookingLoading) return <Spinner />;
  if (bookingId && !booking)
    return (
      <div className="p-8 text-center text-muted">
        Booking tidak ditemukan. <Link href="/kalender" className="font-semibold text-jade">Kembali ke kalender</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 pb-40 md:px-8 md:pt-8 md:pb-10">
      <div className="mb-5 flex items-center gap-2">
        <button onClick={() => router.back()} className="-ml-2 flex size-10 items-center justify-center rounded-[10px] text-ink-2 hover:bg-line-soft" aria-label="Kembali">
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-[22px] leading-tight font-bold tracking-[-0.01em] md:text-[26px]">Checkout</h1>
          {booking && (
            <p className="text-sm text-muted">
              Booking {time(booking.startAt)}, {shortDate(booking.startAt)}
            </p>
          )}
        </div>
      </div>

      {alreadyPaid && (
        <div className="mb-5 rounded-xl bg-jade-mist px-4 py-3 text-sm text-jade-deep">
          Booking ini sudah lunas dengan faktur {booking?.invoiceNo}.{" "}
          <Link className="font-semibold underline" href={`/faktur/${booking?.saleId}`}>
            Lihat faktur
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <section>
            <h2 className="mb-2 text-[13px] font-semibold text-ink-2">Pelanggan</h2>
            {booking ? (
              customer && (
                <Card className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{customer.name}</p>
                    <p className="text-[13px] text-muted">{customer.phone}</p>
                  </div>
                  {vouchers.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-jade-mist px-2.5 py-1 text-xs font-semibold text-jade-deep">
                      <Ticket className="size-3.5" />
                      {vouchers.length} voucher aktif
                    </span>
                  )}
                </Card>
              )
            ) : (
              <CustomerPicker
                value={customer}
                onChange={(c) => {
                  setCustomer(c);
                  manual.current.clear();
                  setLines((ls) => ls.map((l) => ({ ...l, voucherId: undefined })));
                }}
              />
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-ink-2">Item</h2>
              <Button size="sm" variant="quiet" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
                Tambah item
              </Button>
            </div>
            <Card className="divide-y divide-line-soft">
              {lines.length === 0 && (
                <button onClick={() => setAdding(true)} className="w-full px-4 py-8 text-center text-sm text-muted hover:text-ink">
                  Tambahkan layanan atau paket sesi
                </button>
              )}
              {lines.map((l) => {
                const opts = optionsFor(l, lines);
                const pkg = l.kind === "package" ? pkgById[l.refId] : undefined;
                const svc = l.kind === "service" ? services.find((s) => s.id === l.refId) : undefined;
                const covered = !!l.voucherId;
                const lineDisc = totals.lineDiscounts[l.key] ?? 0;
                return (
                  <div key={l.key} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {l.kind === "package" && (
                            <span className="rounded-md bg-jade-mist px-1.5 py-0.5 text-[11px] font-bold text-jade-deep">Paket</span>
                          )}
                          <p className="truncate font-semibold">{l.name}</p>
                        </div>
                        <p className="mt-0.5 text-[13px] text-muted">
                          {svc && duration(svc.durationMin)}
                          {pkg && `${pkg.sessions} sesi${pkg.validityDays ? `, berlaku ${validityText(pkg.validityDays)}` : ""}`}
                          {l.staffName && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <span
                                className="size-2 rounded-full"
                                style={{ background: staffColor(staff.find((s) => s.id === l.staffId)?.color).dot }}
                              />
                              {l.staffName}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cx("tnum font-semibold", (covered || lineDisc > 0) && "text-muted line-through decoration-1")}>
                          {rupiah(l.unitPrice * l.qty)}
                        </p>
                        {covered && <p className="tnum text-sm font-bold text-jade-deep">Rp 0</p>}
                        {!covered && lineDisc > 0 && <p className="tnum text-sm font-bold text-jade-deep">{rupiah(l.unitPrice * l.qty - lineDisc)}</p>}
                      </div>
                      {!l.bookingId && (
                        <button
                          aria-label={`Hapus ${l.name}`}
                          onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key && x.voucherId !== `new:${l.key}`).map((x) => (x.voucherId === `new:${l.key}` ? { ...x, voucherId: undefined } : x)))}
                          className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-line-soft hover:text-ink"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>

                    {!l.bookingId && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <div className="flex items-center rounded-[10px] border border-line">
                          <button aria-label="Kurangi" className="flex size-9 items-center justify-center text-ink-2" onClick={() => updateLine(l.key, { qty: Math.max(1, l.qty - 1) })}>
                            <Minus className="size-4" />
                          </button>
                          <span className="tnum w-8 text-center text-sm font-semibold">{l.qty}</span>
                          <button aria-label="Tambah" className="flex size-9 items-center justify-center text-ink-2" onClick={() => updateLine(l.key, { qty: l.qty + 1 })}>
                            <Plus className="size-4" />
                          </button>
                        </div>
                        {l.kind === "package" && (
                          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
                            Dijual oleh
                            <Select
                              aria-label="Dijual oleh"
                              className="!h-9 max-w-52 text-sm"
                              value={l.soldBy ?? user.email}
                              onChange={(e) => {
                                const t = sellers.find((x) => x.id === e.target.value);
                                updateLine(l.key, { soldBy: e.target.value, soldByName: t?.name ?? user.name });
                              }}
                            >
                              {!sellers.some((t) => t.id === user.email) && <option value={user.email}>{user.name}</option>}
                              {sellers.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </Select>
                          </label>
                        )}
                        {l.kind === "service" && (
                          <Select
                            aria-label="Terapis"
                            className="!h-9 max-w-52 text-sm"
                            value={l.staffId ?? ""}
                            onChange={(e) => {
                              const s = staff.find((x) => x.id === e.target.value);
                              updateLine(l.key, { staffId: s?.id, staffName: s?.name });
                            }}
                          >
                            <option value="">Terapis (opsional)</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </div>
                    )}

                    {!l.voucherId && discounts.some((d) => fits(d, l.kind)) && (
                      <div className="mt-3 flex items-center gap-2">
                        <BadgePercent className={cx("size-4 shrink-0", l.discountId ? "text-jade" : "text-muted")} />
                        <Select
                          aria-label={`Diskon ${l.name}`}
                          className={cx("!h-9 max-w-72 text-sm", l.discountId && "!border-jade font-semibold !text-jade-deep")}
                          value={l.discountId ?? ""}
                          onChange={(e) => updateLine(l.key, { discountId: e.target.value || undefined })}
                        >
                          <option value="">Tanpa diskon</option>
                          {discounts
                            .filter((d) => fits(d, l.kind))
                            .map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({discountValue(d)}), −{rupiah(discountAmount(d, l.unitPrice * l.qty))}
                              </option>
                            ))}
                        </Select>
                      </div>
                    )}

                    {l.kind === "service" && (opts.length > 0 || covered) && (
                      <div className="mt-3 rounded-xl bg-canvas p-2">
                        <p className="px-1.5 pt-0.5 pb-2 text-xs font-semibold text-ink-2">Bayar dengan voucher</p>
                        <div className="flex flex-col gap-1.5">
                          {opts.map((o) => {
                            const on = l.voucherId === o.id;
                            return (
                              <button
                                key={o.id}
                                onClick={() => {
                                  manual.current.add(l.key);
                                  updateLine(l.key, { voucherId: on ? undefined : o.id });
                                }}
                                className={cx(
                                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                                  on ? "border-jade bg-surface ring-1 ring-jade" : "border-transparent bg-surface hover:border-line",
                                )}
                              >
                                <span
                                  className={cx(
                                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                                    on ? "border-jade bg-jade" : "border-line",
                                  )}
                                >
                                  {on && <span className="size-1.5 rounded-full bg-white" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold">{o.label}</span>
                                  <Beads total={o.total} used={o.used} pending={on ? l.qty : 0} size={9} className="mt-1.5" />
                                </span>
                                <span className="tnum shrink-0 text-right text-xs text-muted">
                                  sisa
                                  <span className="block text-base leading-tight font-bold text-jade-deep">{on ? o.left - l.qty : o.left}</span>
                                </span>
                              </button>
                            );
                          })}
                          <button
                            onClick={() => {
                              manual.current.add(l.key);
                              updateLine(l.key, { voucherId: undefined });
                            }}
                            className={cx(
                              "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                              !covered ? "border-jade bg-surface ring-1 ring-jade" : "border-transparent bg-surface text-ink-2 hover:border-line",
                            )}
                          >
                            <span className={cx("flex size-5 shrink-0 items-center justify-center rounded-full border-2", !covered ? "border-jade bg-jade" : "border-line")}>
                              {!covered && <span className="size-1.5 rounded-full bg-white" />}
                            </span>
                            Tidak pakai voucher, bayar normal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          </section>
        </div>

        {/* Summary & payment */}
        <aside className="min-w-0 lg:sticky lg:top-8">
          <Card className="p-5">
            <h2 className="text-[15px] font-bold">Pembayaran</h2>
            <dl className="mt-4 flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tnum font-medium">{rupiah(totals.subtotal)}</dd>
              </div>
              {totals.covered > 0 && (
                <div className="flex justify-between text-jade-deep">
                  <dt>Dibayar dengan voucher</dt>
                  <dd className="tnum font-semibold">−{rupiah(totals.covered)}</dd>
                </div>
              )}
              {totals.lineDiscount > 0 && (
                <div className="flex justify-between text-jade-deep">
                  <dt>Diskon item</dt>
                  <dd className="tnum font-semibold">−{rupiah(totals.lineDiscount)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Diskon transaksi</dt>
                <dd className="tnum font-semibold text-jade-deep">{totals.billDiscount ? `−${rupiah(totals.billDiscount)}` : ""}</dd>
              </div>
            </dl>
            <div className="mt-2.5 flex flex-col gap-2 text-sm">
              <Select aria-label="Diskon transaksi" className="!h-9 text-sm" value={billDiscountId} onChange={(e) => setBillDiscountId(e.target.value)}>
                <option value="">Tanpa diskon</option>
                {discounts
                  .filter((d) => fits(d, "bill"))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}, {discountValue(d)}
                    </option>
                  ))}
              </Select>
              {can("discounts.manage") && (
                <label className="flex items-center justify-between gap-3 text-[13px] text-muted">
                  Diskon manual (manajer)
                  <MoneyInput value={manualDiscount} onChange={setManualDiscount} className="w-36 [&_input]:!h-9 [&_input]:text-right" />
                </label>
              )}
            </div>
            <div className="mt-4 flex items-baseline justify-between border-t border-line-soft pt-4">
              <span className="font-semibold">Total dibayar</span>
              <span className="tnum text-[26px] font-bold tracking-[-0.02em]">{rupiah(totals.total)}</span>
            </div>

            {needsMethod ? (
              <div className="mt-5">
                <p className="mb-2 text-[13px] font-semibold text-ink-2">Metode pembayaran</p>
                <div className="grid grid-cols-3 gap-2">
                  {METHODS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setMethod(value)}
                      aria-pressed={method === value}
                      className={cx(
                        "flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold transition-colors",
                        method === value ? "border-jade bg-jade-mist text-jade-deep ring-1 ring-jade" : "border-line text-ink-2 hover:border-ink-2/30",
                      )}
                    >
                      <Icon className="size-5" />
                      {label}
                    </button>
                  ))}
                </div>
                {method && (
                  <Field label="No. referensi (opsional)" htmlFor="ref" className="mt-4">
                    <Input
                      id="ref"
                      placeholder={method === "transfer" ? "Nama bank / no. transaksi" : method === "card" ? "4 digit terakhir / approval code" : "ID transaksi QRIS"}
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                    />
                  </Field>
                )}
              </div>
            ) : (
              totals.covered > 0 && (
                <p className="mt-4 flex items-center gap-2 rounded-xl bg-jade-mist px-3.5 py-3 text-sm font-medium text-jade-deep">
                  <Ticket className="size-4 shrink-0" />
                  Lunas dengan voucher, tidak ada pembayaran tambahan.
                </p>
              )
            )}

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}
            <div className="mt-5 hidden lg:block">
              <Button size="lg" block loading={busy} disabled={alreadyPaid} onClick={submit}>
                {needsMethod ? `Bayar ${rupiah(totals.total)}` : "Selesaikan dengan voucher"}
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      {/* Phone/tablet pay bar */}
      <div className="fixed inset-x-0 bottom-[calc(64px+var(--safe-bottom))] z-20 border-t border-line bg-surface px-4 py-3 md:bottom-0 md:left-[232px] lg:hidden">
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        <Button size="lg" block loading={busy} disabled={alreadyPaid} onClick={submit}>
          {needsMethod ? `Bayar ${rupiah(totals.total)}` : "Selesaikan dengan voucher"}
        </Button>
      </div>

      <AddItemSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(line) => {
          setLines((ls) => [...ls, line]);
          setAdding(false);
        }}
      />
    </div>
  );
}

function AddItemSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (l: CartLine) => void }) {
  const [tab, setTab] = useState<"layanan" | "paket">("layanan");
  const { services } = useServices();
  const { packages } = usePackages();
  return (
    <Sheet open={open} onClose={onClose} title="Tambah item">
      <Segmented
        className="mb-4 w-full"
        value={tab}
        onChange={setTab}
        options={[
          { value: "layanan", label: "Layanan" },
          { value: "paket", label: "Paket sesi" },
        ]}
      />
      <div className="grid gap-2">
        {tab === "layanan" &&
          services.map((s) => (
            <button
              key={s.id}
              onClick={() => onAdd({ key: newKey(), kind: "service", refId: s.id, name: s.name, unitPrice: s.price, qty: 1 })}
              className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-left hover:border-jade/50"
            >
              <span>
                <span className="block text-sm font-semibold">{s.name}</span>
                <span className="text-[13px] text-muted">{duration(s.durationMin)}</span>
              </span>
              <span className="tnum text-sm font-semibold">{rupiah(s.price)}</span>
            </button>
          ))}
        {tab === "paket" &&
          packages.map((p) => (
            <button
              key={p.id}
              onClick={() => onAdd({ key: newKey(), kind: "package", refId: p.id, name: p.name, unitPrice: p.price, qty: 1 })}
              className="rounded-xl border border-line px-4 py-3 text-left hover:border-jade/50"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{p.name}</span>
                <span className="tnum text-sm font-semibold">{rupiah(p.price)}</span>
              </span>
              <Beads total={p.sessions} used={0} size={9} className="mt-2" />
              <span className="mt-2 block text-[13px] text-muted">
                {rupiah(Math.round(p.price / p.sessions))} per sesi
                {p.validityDays ? `, berlaku ${validityText(p.validityDays)}` : ""}
              </span>
            </button>
          ))}
        {tab === "paket" && packages.length === 0 && <p className="text-sm text-muted">Belum ada paket. Buat di menu Katalog.</p>}
      </div>
    </Sheet>
  );
}

function Done({
  done,
  customer,
}: {
  done: { saleId: string; invoiceNo: string; receiptToken: string; total: number; method: string };
  customer: Row<Customer>;
}) {
  const toast = useToast();
  const link = typeof window !== "undefined" ? `${window.location.origin}/resi/${done.receiptToken}` : "";
  const { settings } = useSettings();
  const wa = waLink(
    customer.phone,
    waMessage(settings, "receipt", { nama: customer.name.split(" ")[0], faktur: done.invoiceNo, total: rupiah(done.total), link }),
  );
  const { rows } = useCollection<Voucher>("vouchers", [["customerId", "==", customer.id]]);
  const touched = (rows ?? []).filter(
    (v) => v.saleId === done.saleId || v.redemptions?.some((r) => r.saleId === done.saleId),
  );
  return (
    <div className="mx-auto flex max-w-lg flex-col px-4 pt-10 pb-10 md:pt-16">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-jade-mist text-jade">
          <CheckCircle2 className="size-9" />
        </span>
        <h1 className="mt-4 text-2xl font-bold">Checkout selesai</h1>
        <p className="mt-1 text-sm text-muted">
          {customer.name}, faktur <span className="font-semibold text-ink">{done.invoiceNo}</span>
        </p>
        <p className="tnum mt-5 text-[34px] font-bold tracking-[-0.02em]">{rupiah(done.total)}</p>
        <p className="text-sm text-muted">{done.method}</p>
      </div>

      {touched.length > 0 && (
        <div className="mt-8">
          <p className="mb-2 text-[13px] font-semibold text-ink-2">Saldo voucher sekarang</p>
          <div className="grid gap-2">
            {touched.map((v) => (
              <VoucherCard key={v.id} v={v} compact />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 rounded-xl border border-line bg-surface p-4">
        <p className="text-[13px] font-semibold text-ink-2">Resi online untuk pasien</p>
        <p className="mt-1 truncate font-mono text-[13px] text-jade-deep">{link}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            icon={<Copy className="size-4" />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                toast("Link resi disalin");
              } catch {
                window.prompt("Salin link resi:", link);
              }
            }}
          >
            Salin link
          </Button>
          {wa ? (
            <a href={wa} target="_blank" rel="noreferrer">
              <Button block icon={<MessageCircle className="size-4" />}>
                Kirim WA
              </Button>
            </a>
          ) : (
            <a href={`/resi/${done.receiptToken}`} target="_blank" rel="noreferrer">
              <Button block variant="secondary" icon={<ExternalLink className="size-4" />}>
                Buka resi
              </Button>
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <Link href={`/faktur/${done.saleId}`}>
          <Button size="lg" block icon={<ReceiptText className="size-4" />}>
            Lihat &amp; cetak faktur
          </Button>
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/kalender">
            <Button size="lg" block variant="secondary">
              Ke kalender
            </Button>
          </Link>
          <a href="/checkout">
            <Button size="lg" block variant="secondary">
              Transaksi baru
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
