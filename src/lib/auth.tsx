"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc, writeBatch } from "firebase/firestore";
import { auth, db, DEMO_MODE } from "./firebase";
import { can as canRole, isRole, type Cap, type Role } from "./roles";
import type { Access, PortalAccount } from "./types";

export interface SessionUser {
  email: string;
  name: string;
  role: Role;
  staffId?: string;
}

type AuthState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "no_access"; user: { email: string; name: string } }
  | { status: "ready"; user: SessionUser };

interface AuthApi {
  state: AuthState;
  signIn(email: string, password: string): Promise<void>;
  /** `patient` set: a self-registered patient account (portal only). */
  signUp(name: string, email: string, password: string, patient?: { phone: string }): Promise<void>;
  signOut(): Promise<void>;
  isFirstRun(): Promise<boolean>;
  /** Demo mode only: preview the app as another role. */
  setDemoRole(role: Role): void;
}

const Ctx = createContext<AuthApi | null>(null);

export const DEMO_USERS: Record<Role, SessionUser> = {
  admin: { email: "admin@jadephysio.id", name: "Admin Demo", role: "admin" },
  manager: { email: "manajer@jadephysio.id", name: "Manajer Demo", role: "manager" },
  staff: { email: "kasir@jadephysio.id", name: "Front Desk Demo", role: "staff" },
  therapist: { email: "andini@jadephysio.id", name: "Ft. Andini", role: "therapist", staffId: "st1" },
  cleaning: { email: "cleaning@jadephysio.id", name: "Pak Joko", role: "cleaning" },
  patient: { email: "rina@gmail.com", name: "Rina Wulandari", role: "patient" },
};
const DEMO_ROLE_KEY = "jade-physio-demo-role";

function demoRole(): Role {
  try {
    const r = window.localStorage.getItem(DEMO_ROLE_KEY);
    if (isRole(r)) return r;
  } catch {
    /* ignore */
  }
  return "admin";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const signingUp = useRef(false);
  const attach = useRef<(u: User | null) => void>(() => {});

  useEffect(() => {
    if (DEMO_MODE) {
      setState({ status: "ready", user: DEMO_USERS[demoRole()] });
      return;
    }
    let stopAccess: (() => void) | undefined;
    attach.current = (u) => {
      stopAccess?.();
      stopAccess = undefined;
      if (!u?.email) return setState({ status: "signed_out" });
      const email = u.email.toLowerCase();
      const name = u.displayName || email.split("@")[0];
      // Live: if an admin changes this person's role or removes them, the app follows.
      stopAccess = onSnapshot(
        doc(db(), "access", email),
        (snap) => {
          const a = snap.exists() ? (snap.data() as Access) : null;
          if (!a || !isRole(a.role)) setState({ status: "no_access", user: { email, name } });
          else setState({ status: "ready", user: { email, name: a.name || name, role: a.role, staffId: a.staffId } });
        },
        () => setState({ status: "no_access", user: { email, name } }),
      );
    };
    const stopAuth = onAuthStateChanged(auth(), (u) => {
      if (!signingUp.current) attach.current(u);
    });
    return () => {
      stopAccess?.();
      stopAuth();
    };
  }, []);

  async function signUpInner(name: string, email: string, password: string, patient?: { phone: string }) {
    const cred = await createUserWithEmailAndPassword(auth(), email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim() });
    const mail = email.trim().toLowerCase();
    // The first account ever becomes admin; everyone after needs to be added by an admin.
    try {
      const setup = await getDoc(doc(db(), "meta", "setup"));
      if (!setup.exists()) {
        const batch = writeBatch(db());
        batch.set(doc(db(), "access", mail), { role: "admin", name: name.trim(), addedAt: Date.now() });
        batch.set(doc(db(), "meta", "setup"), { by: mail, at: Date.now() });
        await batch.commit();
      }
    } catch {
      /* setup already done: the account waits for an admin to add it */
    }
    if (patient) {
      // Patients register themselves. If the admin already added this email as staff, that wins.
      try {
        const existing = await getDoc(doc(db(), "access", mail));
        if (!existing.exists()) {
          await setDoc(doc(db(), "access", mail), { role: "patient", name: name.trim(), addedAt: Date.now() } satisfies Access);
          await setDoc(doc(db(), "accounts", mail), {
            name: name.trim(),
            persons: [{ id: "self", name: name.trim(), phone: patient.phone.trim() }],
            createdAt: Date.now(),
          } satisfies PortalAccount);
        }
      } catch {
        /* rules not deployed yet: the account waits on the no-access screen */
      }
    }
  }

  const setDemoRole = useCallback((role: Role) => {
    if (!DEMO_MODE) return;
    try {
      window.localStorage.setItem(DEMO_ROLE_KEY, role);
    } catch {
      /* ignore */
    }
    setState({ status: "ready", user: DEMO_USERS[role] });
  }, []);

  const api: AuthApi = {
    state,
    setDemoRole,
    async signIn(email, password) {
      await signInWithEmailAndPassword(auth(), email.trim(), password);
    },
    async signUp(name, email, password, patient) {
      signingUp.current = true;
      try {
        await signUpInner(name, email, password, patient);
      } finally {
        signingUp.current = false;
      }
      attach.current(auth().currentUser);
    },
    async signOut() {
      if (DEMO_MODE) return;
      await fbSignOut(auth());
    },
    async isFirstRun() {
      if (DEMO_MODE) return false;
      try {
        const setup = await getDoc(doc(db(), "meta", "setup"));
        return !setup.exists();
      } catch {
        return false;
      }
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

/** The signed-in person. Only call inside the authenticated (app) area. */
export function useUser(): SessionUser {
  const { state } = useAuth();
  return state.status === "ready" ? state.user : { email: "", name: "", role: "therapist" };
}

export function useCan() {
  const user = useUser();
  return (cap: Cap) => canRole(user.role, cap);
}

export function authErrorMessage(e: unknown) {
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
    return "Email atau kata sandi salah.";
  if (code.includes("email-already-in-use")) return "Email ini sudah terdaftar. Silakan masuk.";
  if (code.includes("weak-password")) return "Kata sandi minimal 6 karakter.";
  if (code.includes("invalid-email")) return "Format email tidak valid.";
  if (code.includes("too-many-requests")) return "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.";
  if (code.includes("network")) return "Tidak ada koneksi internet.";
  return "Gagal masuk. Coba lagi.";
}
