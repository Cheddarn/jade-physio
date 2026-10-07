"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { BEDS, ROOMS, type Bed, type VisitRow } from "@/lib/flow";
import { staffColor } from "@/lib/format";
import type { Row } from "@/lib/store";
import type { Staff } from "@/lib/types";
import { BedLabel, bedTone } from "./BedPlan";
import { groupColor } from "@/lib/relations";

/* Floor plan in metres-ish units. Room 1 holds beds 1-5 in a row, room 2 holds beds 6-7. */
const BED_W = 1.0;
const BED_L = 2.0;
const GAP = 2.3;
const ROOM_D = 5.6;
const ROOM1_W = GAP * 5 + 0.6;
const ROOM2_W = GAP * 2 + 1.4;
const WALL = 0.12;
const WALL_H = 1.1;
const ROOM_X: Record<number, number> = { 1: -ROOM2_W / 2 - WALL / 2, 2: ROOM1_W / 2 + WALL / 2 };

function bedPosition(bed: Bed) {
  const inRoom = BEDS.filter((b) => b.room === bed.room);
  const i = inRoom.indexOf(bed);
  const w = bed.room === 1 ? ROOM1_W : ROOM2_W;
  const x = ROOM_X[bed.room] - w / 2 + (w - GAP * inRoom.length) / 2 + GAP * (i + 0.5);
  return new THREE.Vector3(x, 0, -0.5);
}

interface BedParts {
  group: THREE.Group;
  mattress: THREE.MeshStandardMaterial;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  patient: THREE.Group;
  therapist: THREE.Group;
  therapistBody: THREE.MeshStandardMaterial;
  hit: THREE.Mesh;
}

/** Live 3D view of both treatment rooms. Labels are React, pinned to each bed. */
export default function BedMap3D({
  occupancy,
  staff,
  now,
  onPick,
  compact,
}: {
  occupancy: Map<string, VisitRow>;
  staff: Row<Staff>[];
  now: number;
  onPick: (bedId: string) => void;
  compact: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const parts = useRef<Map<string, BedParts>>(new Map());
  const sceneRef = useRef<THREE.Scene | null>(null);
  const links = useRef<THREE.Group | null>(null);
  const [labels, setLabels] = useState<{ id: string; el: HTMLDivElement }[]>([]);
  const [failed, setFailed] = useState(false);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  // Build the scene once.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    const labelRenderer = new CSS2DRenderer();
    Object.assign(labelRenderer.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    el.appendChild(labelRenderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    links.current = new THREE.Group();
    scene.add(links.current);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = 1.2;
    controls.minDistance = 7;
    controls.maxDistance = 40;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe7e2, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-6, 14, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 8, bottom: -8 });
    scene.add(sun);

    const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
    const box = (w: number, h: number, d: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    // Rooms: floor, three walls, and a doorway on the front.
    const floorMat = mat(0xf1ece2);
    const wallMat = mat(0xffffff, { transparent: true, opacity: 0.92 });
    const trimMat = mat(0x0b5a43);
    for (const room of ROOMS) {
      const w = room.id === 1 ? ROOM1_W : ROOM2_W;
      const cx = ROOM_X[room.id];
      const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, ROOM_D), floorMat);
      floor.position.set(cx, -0.05, 0);
      floor.receiveShadow = true;
      scene.add(floor);
      const back = box(w + WALL, WALL_H, WALL, wallMat);
      back.position.set(cx, WALL_H / 2, -ROOM_D / 2);
      scene.add(back);
      const trim = box(w + WALL, 0.06, WALL + 0.02, trimMat);
      trim.position.set(cx, WALL_H, -ROOM_D / 2);
      scene.add(trim);
      for (const side of [-1, 1]) {
        const s = box(WALL, WALL_H, ROOM_D, wallMat);
        s.position.set(cx + (side * w) / 2, WALL_H / 2, 0);
        scene.add(s);
      }
      // Low front wall with a doorway gap in the middle.
      const seg = (w - 1.6) / 2;
      for (const side of [-1, 1]) {
        const f = box(seg, 0.35, WALL, wallMat);
        f.position.set(cx + side * (0.8 + seg / 2), 0.175, ROOM_D / 2);
        scene.add(f);
      }
      const name = document.createElement("div");
      name.className = "rounded-full bg-jade-deep/90 px-2.5 py-0.5 text-[11px] font-bold text-white whitespace-nowrap";
      name.textContent = room.name;
      const nameObj = new CSS2DObject(name);
      nameObj.position.set(cx, 0.05, ROOM_D / 2 - 0.35);
      scene.add(nameObj);
    }

    // Beds with optional patient and therapist figures.
    const frameMat = mat(0xd9dee3, { roughness: 0.5, metalness: 0.2 });
    const pillowMat = mat(0xffffff);
    const skin = mat(0xdcae8a);
    const sheet = mat(0xf8f6f0);
    const newLabels: { id: string; el: HTMLDivElement }[] = [];
    for (const bed of BEDS) {
      const g = new THREE.Group();
      g.position.copy(bedPosition(bed));
      g.userData.bedId = bed.id;

      const frame = box(BED_W + 0.08, 0.5, BED_L + 0.08, frameMat);
      frame.position.y = 0.25;
      g.add(frame);
      const mattress = mat(0xe4e8ee);
      const top = box(BED_W, 0.16, BED_L, mattress);
      top.position.y = 0.58;
      g.add(top);
      const pillow = box(BED_W * 0.7, 0.1, 0.35, pillowMat);
      pillow.position.set(0, 0.71, -BED_L / 2 + 0.28);
      g.add(pillow);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.02, 48),
        new THREE.MeshBasicMaterial({ color: 0x1a8a66, transparent: true, opacity: 0, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      ring.scale.set(1, 1.3, 1);
      g.add(ring);

      // Patient lying face up.
      const patient = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.05, 6, 12), sheet);
      body.rotation.x = Math.PI / 2;
      body.position.set(0, 0.86, 0.15);
      body.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skin);
      head.position.set(0, 0.86, -BED_L / 2 + 0.3);
      head.castShadow = true;
      patient.add(body, head);
      patient.visible = false;
      g.add(patient);

      // Therapist standing beside the bed.
      const therapist = new THREE.Group();
      const therapistBody = mat(0x1a8a66);
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.75, 6, 12), therapistBody);
      torso.position.y = 0.8;
      torso.castShadow = true;
      const tHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), skin);
      tHead.position.y = 1.5;
      tHead.castShadow = true;
      therapist.add(torso, tHead);
      therapist.position.set(BED_W / 2 + 0.45, 0, 0.1);
      therapist.visible = false;
      g.add(therapist);

      // Invisible box for clicks anywhere on the bed area.
      const hit = new THREE.Mesh(new THREE.BoxGeometry(BED_W + 1.2, 1.6, BED_L + 0.4), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(0.3, 0.8, 0);
      hit.userData.bedId = bed.id;
      g.add(hit);

      const labelEl = document.createElement("div");
      labelEl.style.pointerEvents = "auto";
      const label = new CSS2DObject(labelEl);
      label.position.set(0, 2.05, -0.2);
      g.add(label);
      newLabels.push({ id: bed.id, el: labelEl });

      scene.add(g);
      parts.current.set(bed.id, { group: g, mattress, ring, patient, therapist, therapistBody, hit });
    }
    setLabels(newLabels);

    // Fit the whole floor in view for any screen shape.
    function resize() {
      const w = el!.clientWidth;
      const h = el!.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const span = ROOM1_W + ROOM2_W + 0.6;
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      // Far enough that the full width fits, and the depth (plus labels) fits the height.
      const dist = Math.max(span / 2 / (tanV * camera.aspect), (ROOM_D + 3) / 2 / tanV, 10) * 1.02;
      const dir = new THREE.Vector3(0, 1.15, 0.75).normalize();
      controls.target.set(0, 0.4, 0.2);
      camera.position.copy(dir.multiplyScalar(dist)).add(controls.target);
      controls.maxDistance = dist * 1.6;
      controls.update();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // Tap a bed to open it. Ignore drags (orbiting).
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...parts.current.values()].map((p) => p.hit));
      const id = hits[0]?.object.userData.bedId as string | undefined;
      if (id) pickRef.current(id);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    let raf = 0;
    const clock = new THREE.Clock();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      for (const p of parts.current.values()) {
        if (!p.ring.userData.active) continue;
        p.ring.material.opacity = reduceMotion ? 0.55 : 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2.4));
        if (!reduceMotion) p.therapist.position.y = 0.03 * Math.sin(t * 3);
      }
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    loop();

    const map = parts.current;
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((x) => x.dispose());
      });
      renderer.dispose();
      el.replaceChildren();
      map.clear();
      sceneRef.current = null;
      links.current = null;
      setLabels([]);
    };
  }, []);

  // Paint each bed for the current state.
  useEffect(() => {
    for (const bed of BEDS) {
      const p = parts.current.get(bed.id);
      if (!p) continue;
      const v = occupancy.get(bed.id);
      const st = staff.find((s) => s.id === v?.staffId);
      const c = staffColor(st?.color);
      const tone = bedTone(v);
      p.mattress.color.set(tone === "free" ? 0xe4e8ee : tone === "reserved" ? 0xf6dfa8 : c.dot);
      p.patient.visible = tone === "session";
      p.therapist.visible = tone === "session";
      p.therapistBody.color.set(c.dot);
      p.ring.userData.active = tone !== "free";
      p.ring.material.color.set(tone === "reserved" ? 0xd2921b : c.dot);
      if (tone === "free") p.ring.material.opacity = 0;
    }

    // Family members on beds at the same time: join their beds with an arc.
    const g = links.current;
    if (!g) return;
    for (const child of [...g.children]) {
      g.remove(child);
      const m = child as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material)?.dispose();
    }
    const groups = new Map<string, string[]>();
    for (const bed of BEDS) {
      const gid = occupancy.get(bed.id)?.groupId;
      if (gid) groups.set(gid, [...(groups.get(gid) ?? []), bed.id]);
    }
    for (const [gid, beds] of groups) {
      if (beds.length < 2) continue;
      const color = new THREE.Color(groupColor(gid));
      for (let i = 0; i < beds.length - 1; i++) {
        // Along the floor, from the foot of one bed to the next, curving toward the viewer
        // (labels sit above the beds, so a line overhead would be hidden).
        const foot = (id: string) => bedPosition(BEDS.find((b) => b.id === id)!).setY(0.06).add(new THREE.Vector3(0, 0, BED_L / 2 + 0.25));
        const a = foot(beds[i]);
        const b = foot(beds[i + 1]);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.z += 0.5 + a.distanceTo(b) * 0.12;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.07, 8), new THREE.MeshBasicMaterial({ color }));
        g.add(tube);
        for (const end of [a, b]) {
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color }));
          dot.position.copy(end);
          g.add(dot);
        }
      }
    }
  }, [occupancy, staff, labels]);

  if (failed)
    return (
      <p className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">
        Perangkat ini tidak mendukung tampilan 3D. Gunakan tampilan denah.
      </p>
    );

  return (
    <div ref={host} className="relative h-full w-full overflow-hidden">
      {labels.map(({ id, el }) =>
        createPortal(
          <BedLabel bed={BEDS.find((b) => b.id === id)!} visit={occupancy.get(id)} staff={staff} now={now} compact={compact} onClick={() => onPick(id)} />,
          el,
          id,
        ),
      )}
    </div>
  );
}
