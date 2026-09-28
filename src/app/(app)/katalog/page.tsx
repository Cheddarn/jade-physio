"use client";

import { useState } from "react";
import { LayoutGrid, Plus } from "lucide-react";
import { Badge, Button, Card, Empty, PageHeader, Segmented, Spinner, cx } from "@/components/ui";
import { Beads } from "@/components/Beads";
import { PackageForm, ServiceForm } from "@/components/CatalogForms";
import { usePackages, useServices } from "@/lib/hooks";
import { duration, rupiah } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Package, Service } from "@/lib/types";

type Tab = "layanan" | "paket";

export default function KatalogPage() {
  const [tab, setTab] = useState<Tab>("layanan");
  const { services, loading: sLoading } = useServices(true);
  const { packages, loading: pLoading } = usePackages(true);
  const [editService, setEditService] = useState<Row<Service> | "new" | null>(null);
  const [editPackage, setEditPackage] = useState<Row<Package> | "new" | null>(null);

  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? "Layanan dihapus";

  return (
    <div className="mx-auto max-w-5xl pb-10">
      <PageHeader
        title="Katalog"
        subtitle="Layanan yang bisa dibooking dan paket sesi prabayar"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => (tab === "layanan" ? setEditService("new") : setEditPackage("new"))}>
            {tab === "layanan" ? "Layanan baru" : "Paket baru"}
          </Button>
        }
      />
      <div className="px-4 md:px-8">
        <Segmented
          className="w-full md:w-auto"
          value={tab}
          onChange={setTab}
          options={[
            { value: "layanan", label: `Layanan (${services.length})` },
            { value: "paket", label: `Paket sesi (${packages.length})` },
          ]}
        />

        {tab === "layanan" &&
          (sLoading ? (
            <Spinner />
          ) : services.length === 0 ? (
            <Empty
              icon={<LayoutGrid className="size-5" />}
              title="Belum ada layanan"
              body="Layanan adalah sesi yang bisa dibooking, misalnya Fisioterapi 60 menit."
              action={<Button onClick={() => setEditService("new")}>Tambah layanan</Button>}
            />
          ) : (
            <Card className="mt-4 divide-y divide-line-soft">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setEditService(s)}
                  className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-canvas"
                >
                  <div className="min-w-0 flex-1">
                    <p className={cx("truncate font-semibold", !s.active && "text-muted")}>{s.name}</p>
                    <p className="truncate text-[13px] text-muted">
                      {duration(s.durationMin)}
                      {s.description ? `, ${s.description}` : ""}
                    </p>
                  </div>
                  {!s.active && <Badge>Nonaktif</Badge>}
                  <span className="tnum shrink-0 font-semibold">{rupiah(s.price)}</span>
                </button>
              ))}
            </Card>
          ))}

        {tab === "paket" &&
          (pLoading ? (
            <Spinner />
          ) : packages.length === 0 ? (
            <Empty
              icon={<LayoutGrid className="size-5" />}
              title="Belum ada paket sesi"
              body="Paket dijual sekali bayar dan menjadi voucher sesi untuk pelanggan, misalnya 5 sesi fisioterapi."
              action={<Button onClick={() => setEditPackage("new")}>Tambah paket</Button>}
            />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {packages.map((p) => {
                const perSession = Math.round(p.price / p.sessions);
                const normal = p.serviceIds.length
                  ? Math.max(...p.serviceIds.map((id) => services.find((s) => s.id === id)?.price ?? 0))
                  : 0;
                const saving = normal > perSession ? Math.round((1 - perSession / normal) * 100) : 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => setEditPackage(p)}
                    className="rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-jade/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className={cx("font-semibold", !p.active && "text-muted")}>{p.name}</p>
                      {!p.active ? <Badge>Nonaktif</Badge> : saving > 0 ? <Badge tone="jade">Hemat {saving}%</Badge> : null}
                    </div>
                    <Beads total={p.sessions} used={0} className="mt-3" />
                    <p className="tnum mt-3 text-xl font-bold">{rupiah(p.price)}</p>
                    <p className="tnum text-[13px] text-muted">
                      {rupiah(perSession)} per sesi, {p.validityDays ? `berlaku ${p.validityDays} hari` : "tanpa batas waktu"}
                    </p>
                    <p className="mt-2 truncate text-[13px] text-ink-2">
                      {p.serviceIds.length ? p.serviceIds.map(serviceName).join(", ") : "Semua layanan"}
                    </p>
                  </button>
                );
              })}
            </div>
          ))}
      </div>

      <ServiceForm value={editService} onClose={() => setEditService(null)} />
      <PackageForm value={editPackage} services={services.filter((s) => s.active)} onClose={() => setEditPackage(null)} />
    </div>
  );
}
