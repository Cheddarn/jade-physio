"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Link2, Plus, Unlink, Users } from "lucide-react";
import { Button, Card, Confirm, Field, Select, Sheet, cx, errorText, useToast } from "./ui";
import { CustomerPicker } from "./CustomerPicker";
import { useFlowAlerts } from "./FlowAlerts";
import { useCan } from "@/lib/auth";
import { useCustomers } from "@/lib/hooks";
import { initials } from "@/lib/format";
import { isOpen } from "@/lib/flow";
import { linkCustomers, relationGraph, relationLabel, relationOptions, unlinkCustomers, type GraphNode } from "@/lib/relations";
import type { Row } from "@/lib/store";
import type { Customer, Gender, RelationKind } from "@/lib/types";

const W = 600;
const H = 500;
const CX = W / 2;
const CY = H / 2;
const R1 = 128;
const R2 = 222;
const SIZE = { 0: 36, 1: 27, 2: 20 } as const;

const TONE: Record<Gender | "x", { bg: string; fg: string }> = {
  L: { bg: "#DDEBFA", fg: "#1D4E89" },
  P: { bg: "#FBE1E3", fg: "#8A2432" },
  x: { bg: "#E4E8EE", fg: "#33404F" },
};

interface Placed extends GraphNode {
  x: number;
  y: number;
  angle: number;
}

/** Radial layout: the patient in the middle, family around, their family further out. */
function layout(nodes: GraphNode[]): Placed[] {
  const out: Placed[] = [];
  const center = nodes.find((n) => n.depth === 0);
  if (!center) return out;
  out.push({ ...center, x: CX, y: CY, angle: 0 });
  const l1 = nodes.filter((n) => n.depth === 1);
  l1.forEach((n, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(l1.length, 1);
    out.push({ ...n, x: CX + R1 * Math.cos(angle), y: CY + R1 * Math.sin(angle), angle });
  });
  for (const parent of out.filter((n) => n.depth === 1)) {
    const kids = nodes.filter((n) => n.depth === 2 && n.parent === parent.id);
    const spread = Math.min(0.9, (2 * Math.PI) / Math.max(l1.length, 1) / 1.6);
    kids.forEach((n, i) => {
      const angle = parent.angle + (kids.length === 1 ? 0 : -spread / 2 + (i * spread) / (kids.length - 1));
      out.push({ ...n, x: CX + R2 * Math.cos(angle), y: CY + R2 * Math.sin(angle), angle });
    });
  }
  return out;
}

export function RelationGraph({ customer }: { customer: Row<Customer> }) {
  const router = useRouter();
  const can = useCan();
  const toast = useToast();
  const { customers } = useCustomers();
  const { visits } = useFlowAlerts();
  const [adding, setAdding] = useState(false);
  const links0 = customer.links ?? [];
  const [open, setOpenState] = useState(links0.length > 0);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("jade-physio-relasi-open");
      if (saved) setOpenState(saved === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const setOpen = (v: boolean) => {
    setOpenState(v);
    try {
      window.localStorage.setItem("jade-physio-relasi-open", v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);

  const byId = useMemo(() => {
    const m = new Map(customers.map((c) => [c.id, c]));
    m.set(customer.id, customer); // freshest copy of this patient
    return m;
  }, [customers, customer]);
  const { nodes, extra } = useMemo(() => relationGraph(customer.id, byId), [customer.id, byId]);
  const placed = useMemo(() => layout(nodes), [nodes]);
  const at = (id: string) => placed.find((p) => p.id === id);
  const inClinic = useMemo(() => new Set((visits ?? []).filter(isOpen).map((v) => v.customerId)), [visits]);
  const links = customer.links ?? [];

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-end justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="-mx-2 -my-1 min-w-0 rounded-xl px-2 py-1 text-left transition-colors hover:bg-line-soft"
        >
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <Users className="size-4 text-jade" />
            Keluarga & kerabat
            {links.length > 0 && <span className="tnum rounded-full bg-jade-mist px-2 text-xs font-bold text-jade-deep">{links.length}</span>}
            <ChevronDown className={cx("size-4 text-muted transition-transform", open && "rotate-180")} />
          </h2>
          <p className="truncate text-[13px] text-muted">
            {open
              ? "Pasien yang saling berhubungan. Ketuk nama untuk membuka profilnya."
              : links.length
                ? links
                    .map((l) => `${byId.get(l.id)?.name.split(" ")[0] ?? l.name.split(" ")[0]} (${relationLabel(l.kind, byId.get(l.id)?.gender).toLowerCase()})`)
                    .join(", ")
                : "Belum terhubung dengan pasien lain"}
          </p>
        </button>
        {can("customers.edit") && (
          <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
            Hubungkan
          </Button>
        )}
      </div>

      {open && (
      <Card className="overflow-hidden">
        {links.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-jade-mist text-jade">
              <Link2 className="size-5" />
            </span>
            <p className="mt-3 font-semibold">Belum terhubung dengan pasien lain</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Kerabat yang datang bersama dan ikut terapi otomatis terhubung saat dicatat di Pasien datang. Bisa juga dihubungkan di sini.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-b from-[#f4f8f6] to-surface">
            <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[600px]" role="img" aria-label={`Hubungan keluarga ${customer.name}`}>
              <defs>
                <filter id="rg-shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#13201b" floodOpacity="0.14" />
                </filter>
              </defs>
              {/* guide rings */}
              <circle cx={CX} cy={CY} r={R1} fill="none" stroke="#dce3df" strokeDasharray="2 6" />
              {nodes.some((n) => n.depth === 2) && <circle cx={CX} cy={CY} r={R2} fill="none" stroke="#ebf0ed" strokeDasharray="2 6" />}

              {extra.map(([a, b]) => {
                const pa = at(a);
                const pb = at(b);
                if (!pa || !pb) return null;
                return <line key={`${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#b9c4be" strokeWidth={1.5} strokeDasharray="5 5" />;
              })}

              {placed
                .filter((n) => n.parent)
                .map((n) => {
                  const p = at(n.parent!)!;
                  return (
                    <line
                      key={`e-${n.id}`}
                      x1={p.x}
                      y1={p.y}
                      x2={n.x}
                      y2={n.y}
                      stroke={n.depth === 1 ? "#0f7657" : "#9fb3a9"}
                      strokeWidth={n.depth === 1 ? 2.5 : 1.5}
                      strokeLinecap="round"
                    />
                  );
                })}

              {/* relation labels on the edges */}
              {placed
                .filter((n) => n.parent && n.kind)
                .map((n) => {
                  const p = at(n.parent!)!;
                  const label = relationLabel(n.kind, n.gender);
                  // Middle of the visible part of the line, nudged toward the relative.
                  const d = Math.hypot(n.x - p.x, n.y - p.y) || 1;
                  const from = SIZE[p.depth];
                  const t = (from + 0.62 * (d - from - SIZE[n.depth])) / d;
                  const mx = p.x + (n.x - p.x) * t;
                  const my = p.y + (n.y - p.y) * t;
                  const w = label.length * (n.depth === 1 ? 7.4 : 6.4) + 14;
                  const h = n.depth === 1 ? 22 : 18;
                  return (
                    <g key={`l-${n.id}`}>
                      <rect x={mx - w / 2} y={my - h / 2} width={w} height={h} rx={h / 2} fill="#fff" stroke={n.depth === 1 ? "#0f7657" : "#cfd8d3"} />
                      <text x={mx} y={my + 4} textAnchor="middle" fontSize={n.depth === 1 ? 12 : 10.5} fontWeight={700} fill={n.depth === 1 ? "#0b5a43" : "#5c6a64"}>
                        {label}
                      </text>
                    </g>
                  );
                })}

              {placed.map((n) => {
                const r = SIZE[n.depth];
                const tone = TONE[n.gender ?? "x"];
                const here = inClinic.has(n.id);
                const center = n.depth === 0;
                const name = n.name.split(/\s+/).slice(0, center ? 3 : 2).join(" ");
                return (
                  <g
                    key={n.id}
                    className={cx(!center && "cursor-pointer")}
                    onClick={center ? undefined : () => router.push(`/pelanggan/${n.id}`)}
                    opacity={n.depth === 2 ? 0.85 : 1}
                  >
                    <title>{center ? n.name : `${n.name}: buka profil`}</title>
                    {center && <circle cx={n.x} cy={n.y} r={r + 7} fill="none" stroke="#0f7657" strokeWidth={2} strokeDasharray="4 4" />}
                    <circle cx={n.x} cy={n.y} r={r} fill={tone.bg} stroke={center ? "#0f7657" : "#fff"} strokeWidth={center ? 3 : 2.5} filter="url(#rg-shadow)" />
                    <text x={n.x} y={n.y + r * 0.34} textAnchor="middle" fontSize={r * 0.82} fontWeight={800} fill={tone.fg}>
                      {initials(n.name)}
                    </text>
                    {here && (
                      <g>
                        <circle cx={n.x + r * 0.72} cy={n.y - r * 0.72} r={7} fill="#d2921b" stroke="#fff" strokeWidth={2} />
                        <circle className="pulse-dot" cx={n.x + r * 0.72} cy={n.y - r * 0.72} r={2.5} fill="#fff" />
                      </g>
                    )}
                    {/* The patient's own name is the page title; their circle stays clean. */}
                    {!center && <text
                      x={n.x}
                      // Names sit on the far side from the centre, so they never cross a line.
                      y={!center && Math.sin(n.angle) < -0.3 ? n.y - r - 8 : n.y + r + (center ? 18 : 15)}
                      textAnchor="middle"
                      fontSize={center ? 14 : n.depth === 1 ? 12.5 : 11}
                      fontWeight={center ? 800 : 700}
                      fill="#13201b"
                      paintOrder="stroke"
                      stroke="#f6f9f7"
                      strokeWidth={4}
                    >
                      {name}
                    </text>}
                  </g>
                );
              })}
            </svg>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-soft px-4 py-2 text-[12px] text-muted">
              <Dot color={TONE.L.bg} label="Laki-laki" />
              <Dot color={TONE.P.bg} label="Perempuan" />
              <Dot color="#d2921b" label="Sedang di klinik" />
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-[#b9c4be]" />
                Juga saling terhubung
              </span>
            </div>
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {links.map((l) => {
                const other = byId.get(l.id);
                return (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                    <button type="button" onClick={() => router.push(`/pelanggan/${l.id}`)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-semibold">{other?.name ?? l.name}</span>
                      <span className="block text-[13px] text-muted">
                        {relationLabel(l.kind, other?.gender)} dari {customer.name.split(" ")[0]}
                        {inClinic.has(l.id) && <span className="font-semibold text-amber">, di klinik sekarang</span>}
                      </span>
                    </button>
                    {can("customers.edit") && (
                      <button
                        type="button"
                        onClick={() => setRemoving({ id: l.id, name: other?.name ?? l.name })}
                        aria-label={`Putuskan hubungan dengan ${l.name}`}
                        className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-danger-mist hover:text-danger"
                      >
                        <Unlink className="size-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
      )}

      <LinkSheet open={adding} onClose={() => setAdding(false)} customer={customer} />
      <Confirm
        open={!!removing}
        title="Putuskan hubungan?"
        body={`${customer.name} dan ${removing?.name} tidak lagi ditampilkan sebagai kerabat. Data pasien tidak dihapus.`}
        confirmLabel="Putuskan"
        tone="danger"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          try {
            await unlinkCustomers(customer.id, removing!.id);
            toast("Hubungan diputus");
            setRemoving(null);
          } catch (e) {
            toast(errorText(e), "error");
          }
        }}
      />
    </section>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full ring-1 ring-ink/10" style={{ background: color }} />
      {label}
    </span>
  );
}

function LinkSheet({ open, onClose, customer }: { open: boolean; onClose: () => void; customer: Row<Customer> }) {
  const toast = useToast();
  const [other, setOther] = useState<Row<Customer> | null>(null);
  const [kind, setKind] = useState<RelationKind | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOther(null);
      setKind("");
      setError("");
    }
  }
  const first = customer.name.split(" ")[0];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Hubungkan dengan ${first}`}
      footer={
        <div className="flex flex-col gap-3">
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button
            size="lg"
            block
            loading={busy}
            onClick={async () => {
              setError("");
              if (!other) return setError("Pilih pasien yang akan dihubungkan.");
              if (other.id === customer.id) return setError("Pilih pasien lain.");
              if (!kind) return setError("Pilih hubungannya.");
              setBusy(true);
              try {
                await linkCustomers(customer, other, kind);
                toast(`${other.name} terhubung sebagai ${relationLabel(kind, other.gender).toLowerCase()} ${first}`);
                onClose();
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Hubungkan
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Pasien" hint="Pasien baru bisa ditambahkan langsung di sini, formulirnya diisi kemudian.">
          <CustomerPicker value={other} onChange={setOther} autoFocus />
        </Field>
        <Field label={other ? `${other.name.split(" ")[0]} adalah ... dari ${first}` : `Hubungan dengan ${first}`} htmlFor="link-kind">
          <Select id="link-kind" value={kind} onChange={(e) => setKind(e.target.value as RelationKind)}>
            <option value="">Pilih hubungan</option>
            {relationOptions().map(([k, label]) => (
              <option key={k} value={k}>
                {other?.gender && (k === "pasangan" || k === "orang_tua" || k === "kakek_nenek") ? relationLabel(k, other.gender) : label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Sheet>
  );
}
