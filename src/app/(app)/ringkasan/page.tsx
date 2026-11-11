"use client";

import { useState } from "react";
import { PageHeader, Segmented } from "@/components/ui";
import { DateRangePicker, presetRange, rangeLabel, type Range } from "@/components/DateRange";
import { Dashboard } from "@/components/Dashboard";
import { ActivityFeed } from "@/components/ActivityFeed";

type Tab = "dasbor" | "aktivitas";

/** The manager's start page: figures for any date range, and everything that happened in it. */
export default function RingkasanPage() {
  const [tab, setTab] = useState<Tab>("dasbor");
  const [range, setRange] = useState<Range>(() => presetRange("30d"));
  return (
    <div className="mx-auto max-w-6xl pb-16">
      <PageHeader
        title="Dasbor"
        subtitle={rangeLabel(range)}
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "dasbor", label: "Ringkasan" },
              { value: "aktivitas", label: "Aktivitas" },
            ]}
          />
        }
      />
      <div className="flex flex-col gap-4 px-4 md:px-8">
        <DateRangePicker long value={range} onChange={setRange} />
        {tab === "dasbor" ? <Dashboard from={range.from} to={range.to} /> : <ActivityFeed from={range.from} to={range.to} />}
      </div>
    </div>
  );
}
