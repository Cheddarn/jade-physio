import { store, type Row } from "./store";
import type { Customer, CustomerLink, Gender, RelationKind } from "./types";

/** "B is A's <kind>" turns into "A is B's <inverse>". */
export const INVERSE: Record<RelationKind, RelationKind> = {
  pasangan: "pasangan",
  orang_tua: "anak",
  anak: "orang_tua",
  saudara: "saudara",
  kakek_nenek: "cucu",
  cucu: "kakek_nenek",
  teman: "teman",
  kerabat: "kerabat",
};

export const RELATION_KINDS: RelationKind[] = ["pasangan", "anak", "orang_tua", "saudara", "kakek_nenek", "cucu", "teman", "kerabat"];

const NEUTRAL: Record<RelationKind, string> = {
  pasangan: "Suami / istri",
  orang_tua: "Orang tua",
  anak: "Anak",
  saudara: "Saudara",
  kakek_nenek: "Kakek / nenek",
  cucu: "Cucu",
  teman: "Teman",
  kerabat: "Kerabat lain",
};

/** Label for a person with this relation, using their gender when known: pasangan + P = Istri. */
export function relationLabel(kind: RelationKind | null | undefined, gender?: Gender) {
  if (!kind) return "";
  if (kind === "pasangan" && gender) return gender === "L" ? "Suami" : "Istri";
  if (kind === "orang_tua" && gender) return gender === "L" ? "Ayah" : "Ibu";
  if (kind === "kakek_nenek" && gender) return gender === "L" ? "Kakek" : "Nenek";
  return NEUTRAL[kind];
}

export const relationOptions = () => RELATION_KINDS.map((k) => [k, NEUTRAL[k]] as [RelationKind, string]);

function withLink(list: CustomerLink[] | undefined, link: CustomerLink) {
  return [...(list ?? []).filter((l) => l.id !== link.id), link];
}

/** Connect two patients both ways. `kind` is what `b` is to `a`. */
export async function linkCustomers(a: Pick<Row<Customer>, "id" | "name">, b: Pick<Row<Customer>, "id" | "name">, kind: RelationKind) {
  if (a.id === b.id) throw new Error("Tidak bisa menghubungkan pasien dengan dirinya sendiri.");
  const at = Date.now();
  await store.transaction(async (tx) => {
    const ca = await tx.get<Customer>("customers", a.id);
    const cb = await tx.get<Customer>("customers", b.id);
    if (!ca || !cb) throw new Error("Pasien tidak ditemukan.");
    tx.update("customers", a.id, { links: withLink(ca.links, { id: b.id, name: cb.name, kind, at }) });
    tx.update("customers", b.id, { links: withLink(cb.links, { id: a.id, name: ca.name, kind: INVERSE[kind], at }) });
  });
}

export async function unlinkCustomers(aId: string, bId: string) {
  await store.transaction(async (tx) => {
    const ca = await tx.get<Customer>("customers", aId);
    const cb = await tx.get<Customer>("customers", bId);
    if (ca) tx.update("customers", aId, { links: (ca.links ?? []).filter((l) => l.id !== bId) });
    if (cb) tx.update("customers", bId, { links: (cb.links ?? []).filter((l) => l.id !== aId) });
  });
}

/* ---------------- Graph for the profile page ---------------- */

export interface GraphNode {
  id: string;
  name: string;
  gender?: Gender;
  depth: 0 | 1 | 2;
  parent?: string;
  /** What this person is to their parent node. */
  kind?: RelationKind;
}

/** The patient, their direct links, and their links' links (two steps out). */
export function relationGraph(centerId: string, byId: Map<string, Row<Customer>>) {
  const center = byId.get(centerId);
  if (!center) return { nodes: [] as GraphNode[], extra: [] as [string, string][] };
  const nodes: GraphNode[] = [{ id: center.id, name: center.name, gender: center.gender, depth: 0 }];
  const seen = new Set([center.id]);
  const level1 = (center.links ?? []).filter((l) => !seen.has(l.id));
  for (const l of level1) {
    seen.add(l.id);
    nodes.push({ id: l.id, name: byId.get(l.id)?.name ?? l.name, gender: byId.get(l.id)?.gender, depth: 1, parent: center.id, kind: l.kind });
  }
  // Links between two people already shown (e.g. husband and child both linked to the patient).
  const extra: [string, string][] = [];
  for (const l of level1) {
    for (const l2 of byId.get(l.id)?.links ?? []) {
      if (l2.id === center.id) continue;
      if (seen.has(l2.id)) {
        if (nodes.find((n) => n.id === l2.id)?.depth === 1 && l.id < l2.id) extra.push([l.id, l2.id]);
        continue;
      }
      seen.add(l2.id);
      nodes.push({ id: l2.id, name: byId.get(l2.id)?.name ?? l2.name, gender: byId.get(l2.id)?.gender, depth: 2, parent: l.id, kind: l2.kind });
    }
  }
  return { nodes, extra };
}

/* ---------------- Group colour (board cards, 3D lines) ---------------- */

// Dark enough to read as text on white and on every bed colour.
const GROUP_COLORS = ["#ac3f54", "#2f65ae", "#884ca9", "#885e11", "#157355", "#9f4f2c"];
export function groupColor(groupId: string) {
  let h = 0;
  for (const ch of groupId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GROUP_COLORS[h % GROUP_COLORS.length];
}
