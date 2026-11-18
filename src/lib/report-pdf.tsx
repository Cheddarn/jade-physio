import { Document, Font, Image, Page, Path, Circle, Line, Svg, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { BUSINESS, dayMonth, longDate, shortDate, time } from "./format";
import { caseSessions, hasProgress, progressText, trend, type Trend } from "./progress";
import type { TherapyReport } from "./types";

/*
  The therapy report as a real PDF file: text that can be selected and searched, the clinic's logo, the recovery
  charts drawn as vectors. Made in the browser, loaded only when someone asks for it. Same file in both apps.
*/

const C = {
  ink: "#13201b",
  ink2: "#3c4a44",
  muted: "#5c6a64",
  line: "#dce3df",
  lineSoft: "#ebf0ed",
  jade: "#0f7657",
  jadeDeep: "#0b5a43",
  jadeMist: "#e3f2eb",
  series: "#1f9a73",
  grid: "#e6e8eb",
  danger: "#b8392b",
  dangerMist: "#fbe7e4",
};

let fontsReady = false;
function registerFonts(origin: string) {
  if (fontsReady) return;
  Font.register({
    family: "Jakarta",
    fonts: [
      { src: `${origin}/fonts/PlusJakartaSans-Regular.ttf`, fontWeight: 400 },
      { src: `${origin}/fonts/PlusJakartaSans-SemiBold.ttf`, fontWeight: 600 },
      { src: `${origin}/fonts/PlusJakartaSans-Bold.ttf`, fontWeight: 700 },
    ],
  });
  // Indonesian words are not hyphenated.
  Font.registerHyphenationCallback((w) => [w]);
  fontsReady = true;
}

const s = StyleSheet.create({
  page: { fontFamily: "Jakarta", fontSize: 10.5, color: C.ink, paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44 },
  // Line height goes on the paragraphs, not the page: on the page it stops the page numbers from being drawn.
  content: {},
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: C.jadeDeep, paddingBottom: 12 },
  brand: { flexDirection: "row", alignItems: "center", flexShrink: 1, marginRight: 16 },
  logo: { width: 46, height: 46, borderRadius: 6, marginRight: 11 },
  name: { fontSize: 16, fontWeight: 700, color: C.jadeDeep, lineHeight: 1.15 },
  address: { fontSize: 8.5, color: C.muted, marginTop: 2, maxWidth: 290 },
  title: { fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" },
  // Larger than the body text: who, when and what is the first thing read. The right column is wider for the date.
  info: { flexDirection: "row", flexWrap: "wrap", marginTop: 16, fontSize: 12.5 },
  infoItem: { flexDirection: "row", marginBottom: 6 },
  infoLeft: { width: "44%", paddingRight: 10 },
  infoRight: { width: "56%" },
  infoLabel: { color: C.muted },
  infoValue: { flex: 1 },
  section: { marginTop: 13 },
  h2: { fontSize: 8.5, fontWeight: 700, color: C.jadeDeep, letterSpacing: 0.6, textTransform: "uppercase" },
  // In points: a plain number here is read as a much larger gap than it says.
  body: { marginTop: 3, lineHeight: "15pt" },
  trendRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 5 },
  // Each label stays on the same line as its badge.
  trendPair: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  trendLead: { fontSize: 9, color: C.muted, marginRight: 5 },
  badge: { fontSize: 9, fontWeight: 600, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6, marginRight: 10 },
  charts: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  caption: { fontSize: 8.5, fontWeight: 600, color: C.ink2, marginBottom: 3 },
  table: { marginTop: 10, borderTopWidth: 1, borderTopColor: C.line },
  tr: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: C.lineSoft, paddingVertical: 3, fontSize: 9 },
  th: { color: C.muted, fontWeight: 600 },
  sign: { marginTop: 36, alignSelf: "flex-end", alignItems: "center", width: 170 },
  signImage: { marginTop: 6, height: 54, width: 170, objectFit: "contain" },
  signLine: { marginTop: 46, borderTopWidth: 0.75, borderTopColor: C.ink2, paddingTop: 3, width: "100%", textAlign: "center", fontWeight: 600 },
  footLeft: { position: "absolute", bottom: 24, left: 44, right: 160, fontSize: 7.5, color: C.muted },
  footRight: { position: "absolute", bottom: 24, right: 44, width: 110, textAlign: "right", fontSize: 7.5, color: C.muted },
  note: { fontSize: 9, color: C.muted, marginTop: 3 },
  attach: { marginTop: 6, maxHeight: 420, objectFit: "contain" },
});

type Session = Pick<TherapyReport, "pain" | "recovery" | "sessionAt" | "condition" | "staffName" | "progressNote">;

/* ---------------- charts ----------------
   Same reading as on screen: one 2pt line, ringed dots, three quiet gridlines, the latest value labelled, and the
   numbers again in the table below. Pain and recovery are two charts, never one with two axes. */

const CW = 244,
  CH = 112,
  L = 30,
  R = 30,
  T = 8,
  B = 18;

function Chart({ title, points, pick, max, unit, current }: { title: string; points: Session[]; pick: (p: Session) => number | null | undefined; max: number; unit: (v: number) => string; current: number }) {
  const n = points.length;
  const x = (i: number) => (n === 1 ? L + (CW - L - R) / 2 : L + (i * (CW - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - v / max) * (CH - T - B);
  const line = points.map((p, i) => ({ i, v: pick(p) })).filter((p): p is { i: number; v: number } => p.v != null);
  if (!line.length) return null;
  const d = line.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = line[line.length - 1];
  const ticks = [0, max / 2, max];
  const xs = n <= 6 ? points.map((_, i) => i) : [0, n - 1];
  return (
    <View style={{ width: CW }} wrap={false}>
      <Text style={s.caption}>{title}</Text>
      <View style={{ width: CW, height: CH, position: "relative" }}>
        <Svg width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`}>
          {ticks.map((t) => (
            <Line key={t} x1={L} x2={CW - R + 6} y1={y(t)} y2={y(t)} stroke={C.grid} strokeWidth={0.75} />
          ))}
          <Path d={d} fill="none" stroke={C.series} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {line.map((p) => (
            <Circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={points[p.i].sessionAt === current ? 4.2 : 3.2} fill={C.series} stroke="#ffffff" strokeWidth={1.5} />
          ))}
        </Svg>
        {ticks.map((t) => (
          <Text key={t} style={{ position: "absolute", left: 0, width: L - 5, top: y(t) - 5, fontSize: 7.5, color: C.muted, textAlign: "right" }}>
            {unit(t)}
          </Text>
        ))}
        {xs.map((i) => {
          const at = x(i);
          const align = n === 1 ? "center" : i === 0 ? "left" : i === n - 1 ? "right" : "center";
          const left = align === "left" ? at - 3 : align === "right" ? at - 47 : at - 25;
          return (
            <Text key={i} style={{ position: "absolute", top: CH - B + 5, left, width: 50, fontSize: 7.5, color: C.muted, textAlign: align }}>
              {dayMonth(points[i].sessionAt)}
            </Text>
          );
        })}
        <Text style={{ position: "absolute", left: x(last.i) + 6, top: y(last.v) - 6, fontSize: 9, fontWeight: 700, color: C.ink }}>{unit(last.v)}</Text>
      </View>
    </View>
  );
}

function Badge({ t }: { t: Trend }) {
  const tone = t.tone === "good" ? { backgroundColor: C.jadeMist, color: C.jadeDeep } : t.tone === "bad" ? { backgroundColor: C.dangerMist, color: C.danger } : { backgroundColor: C.lineSoft, color: C.ink2 };
  return (
    <Text style={[s.badge, tone]}>
      {t.label} <Text style={{ fontWeight: 400 }}>({t.detail})</Text>
    </Text>
  );
}

function Progress({ r, sessions }: { r: TherapyReport; sessions: Session[] }) {
  const points = caseSessions(sessions, r.condition, r.sessionAt);
  const now = points[points.length - 1];
  const t = now ? trend(now, points[points.length - 2]) : null;
  const span = points.length > 2 ? trend(now, points[0]) : null;
  return (
    <View>
      {(t || span) && (
        <View style={s.trendRow}>
          {t && (
            <View style={s.trendPair}>
              <Text style={s.trendLead}>Dibanding sesi lalu:</Text>
              <Badge t={t} />
            </View>
          )}
          {span && (
            <View style={s.trendPair}>
              <Text style={s.trendLead}>
                Sejak sesi pertama{r.condition ? ` ${r.condition}` : ""} ({dayMonth(points[0].sessionAt)}):
              </Text>
              <Badge t={span} />
            </View>
          )}
        </View>
      )}
      {points.length > 0 && (
        <View wrap={false}>
          <View style={s.charts}>
            <Chart title="Nyeri (VAS 0–10, makin rendah makin baik)" points={points} pick={(p) => p.pain} max={10} unit={(v) => `${v}`} current={r.sessionAt} />
            <Chart title="Pemulihan (makin tinggi makin baik)" points={points} pick={(p) => p.recovery} max={100} unit={(v) => `${v}%`} current={r.sessionAt} />
          </View>
          <View style={s.table}>
            <View style={[s.tr, s.th]}>
              <Text style={{ width: 30 }}>Sesi</Text>
              <Text style={{ width: 78 }}>Tanggal</Text>
              <Text style={{ width: 48, textAlign: "right" }}>Nyeri</Text>
              <Text style={{ width: 62, textAlign: "right", marginRight: 12 }}>Pemulihan</Text>
              <Text style={{ flex: 1 }}>Catatan</Text>
            </View>
            {points.map((p, i) => (
              <View key={p.sessionAt} style={[s.tr, p.sessionAt === r.sessionAt ? { fontWeight: 700 } : {}]} wrap={false}>
                <Text style={{ width: 30 }}>{i + 1}</Text>
                <Text style={{ width: 78 }}>{shortDate(p.sessionAt)}</Text>
                <Text style={{ width: 48, textAlign: "right" }}>{p.pain != null ? `${p.pain}/10` : "-"}</Text>
                <Text style={{ width: 62, textAlign: "right", marginRight: 12 }}>{p.recovery != null ? `${p.recovery}%` : "-"}</Text>
                <Text style={{ flex: 1, color: C.muted, fontWeight: 400 }}>{p.progressNote || p.staffName}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function ReportDoc({
  r,
  sessions,
  origin,
  attachment,
  signature,
}: {
  r: TherapyReport;
  sessions: Session[];
  origin: string;
  attachment: string | null;
  signature: string | null;
}) {
  const sections: [string, string | undefined][] = [
    ["Keluhan", r.complaint],
    ["Anamnesis", r.anamnesis],
    ["Mekanisme cedera", r.mechanism],
    ["Pemeriksaan / temuan", r.assessment],
    ["Tindakan yang diberikan", r.treatment],
    ["Saran & latihan di rumah", r.advice],
  ];
  const info: [string, string][] = [
    ["Pasien", r.customerName],
    ["Tanggal", `${longDate(r.sessionAt)}, ${time(r.sessionAt)}`],
    ["Fisioterapis", r.staffName],
    ...(r.condition ? ([["Kondisi", r.condition]] as [string, string][]) : []),
  ];
  return (
    <Document title={`Laporan fisioterapi ${r.customerName}, ${shortDate(r.sessionAt)}`} author={BUSINESS.name} creator={BUSINESS.name} language="id">
      <Page size="A4" style={s.page}>
        {/* On every page: whose report, and the page number. */}
        <Text style={s.footLeft} fixed>
          {BUSINESS.name} · Laporan fisioterapi {r.customerName} · {shortDate(r.sessionAt)}
        </Text>
        <Text style={s.footRight} fixed render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`} />
        <View style={s.content}>
          <View style={s.header}>
            <View style={s.brand}>
              <Image src={`${origin}/logo.png`} style={s.logo} />
              <View style={{ flexShrink: 1 }}>
                <Text style={s.name}>{BUSINESS.name}</Text>
                {BUSINESS.address ? <Text style={s.address}>{BUSINESS.address}</Text> : null}
                {BUSINESS.phone ? <Text style={s.address}>{BUSINESS.phone}</Text> : null}
              </View>
            </View>
            <Text style={s.title}>Laporan fisioterapi</Text>
          </View>

          <View style={s.info}>
            {info.map(([k, v], i) => (
              <View key={k} style={[s.infoItem, i % 2 ? s.infoRight : s.infoLeft]}>
                <Text style={[s.infoLabel, { width: i % 2 ? 64 : 86 }]}>{k}</Text>
                <Text style={[s.infoValue, k === "Pasien" || k === "Kondisi" ? { fontWeight: 600 } : {}]}>{v}</Text>
              </View>
            ))}
          </View>

          {sections
            .filter(([, v]) => v?.trim())
            .map(([k, v]) => (
              <View key={k} style={s.section}>
                <Text style={s.h2} minPresenceAhead={24}>
                  {k}
                </Text>
                <Text style={s.body}>{v!.trim()}</Text>
              </View>
            ))}

          {/* Kept on one page: the heading, how it compares, both charts and the table. */}
          {(hasProgress(r) || r.progressNote?.trim()) && (
            <View style={s.section} wrap={false}>
              <Text style={s.h2} minPresenceAhead={60}>
                Progres pemulihan
              </Text>
              {hasProgress(r) && <Text style={s.body}>{progressText(r).replace(/^./, (c) => c.toUpperCase())}</Text>}
              {r.progressNote?.trim() ? <Text style={s.body}>{r.progressNote.trim()}</Text> : null}
              <Progress r={r} sessions={sessions} />
            </View>
          )}

          {r.nextVisit?.trim() || r.nextVisitDate ? (
            <View style={s.section}>
              <Text style={s.h2} minPresenceAhead={24}>
                Rencana kunjungan berikutnya
              </Text>
              {r.nextVisitDate ? <Text style={[s.body, { fontWeight: 600 }]}>{longDate(r.nextVisitDate)}</Text> : null}
              {r.nextVisit?.trim() ? <Text style={s.body}>{r.nextVisit.trim()}</Text> : null}
            </View>
          ) : null}

          {r.file && (
            <View style={s.section} wrap={!attachment}>
              <Text style={s.h2}>Lampiran dari fisioterapis</Text>
              {attachment ? (
                <Image src={attachment} style={s.attach} />
              ) : (
                <Text style={s.note}>{r.file.name} (file terpisah, unduh dari halaman laporan)</Text>
              )}
            </View>
          )}

          <View style={s.sign} wrap={false}>
            <Text style={{ color: C.muted }}>Fisioterapis</Text>
            {signature ? <Image src={signature} style={s.signImage} /> : null}
            <Text style={[s.signLine, signature ? { marginTop: 2 } : {}]}>{r.staffName}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/** An image the physio attached, as a data URL the PDF can hold; null when it is a PDF or cannot be fetched. */
async function attachmentImage(file: TherapyReport["file"]) {
  if (!file || !/^image\/(png|jpe?g)$/.test(file.type)) return null;
  if (file.url.startsWith("data:")) return file.url;
  try {
    const res = await fetch(file.url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** "Laporan Fisioterapi - Rina Wulandari - 18 Nov 2026.pdf" */
export function reportPdfName(r: Pick<TherapyReport, "customerName" | "sessionAt">) {
  const safe = (x: string) => x.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `Laporan Fisioterapi - ${safe(r.customerName || "Pasien")} - ${safe(shortDate(r.sessionAt))}.pdf`;
}

/** Make the report's PDF. `sessions` are the patient's reports, for the recovery charts; `signature` the physio's. */
export async function reportPdf(r: TherapyReport, sessions: Session[], signature?: string | null): Promise<Blob> {
  const origin = window.location.origin;
  registerFonts(origin);
  const attachment = await attachmentImage(r.file);
  return pdf(<ReportDoc r={r} sessions={sessions} origin={origin} attachment={attachment} signature={signature ?? null} />).toBlob();
}

/** Make the PDF and save it to the device. */
export async function downloadReportPdf(r: TherapyReport, sessions: Session[], signature?: string | null) {
  const blob = await reportPdf(r, sessions, signature);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = reportPdfName(r);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
