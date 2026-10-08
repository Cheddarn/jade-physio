"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  updateProfile,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc, writeBatch } from "firebase/firestore";
import { auth, db, DEMO_MODE, provisionAuth } from "./firebase";
import { can as canRole, isRole, normalizeRole, type Cap, type Role } from "./roles";
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
  /** Staff, and accounts the admin made: email and password. */
  signIn(email: string, password: string): Promise<void>;
  /** Only for the very first account, which becomes the admin. */
  signUp(name: string, email: string, password: string): Promise<void>;
  /** Patients: text a sign-in code. The button with this id carries the invisible reCAPTCHA. */
  sendCode(phone: string, buttonId: string): Promise<void>;
  /** Check the code. "new": this number has no patient account yet, finish with registerPatient. */
  verifyCode(code: string): Promise<"ready" | "new">;
  /** Create the patient account for the phone number that just signed in. Email is optional. */
  registerPatient(name: string, email?: string): Promise<void>;
  signOut(): Promise<void>;
  isFirstRun(): Promise<boolean>;
  /** Demo mode only: preview the app as another role. */
  setDemoRole(role: Role): void;
}

const Ctx = createContext<AuthApi | null>(null);

export const DEMO_USERS: Record<Role, SessionUser> = {
  admin: { email: "admin@jadephysio.id", name: "Admin Demo", role: "admin" },
  manager: { email: "manajer@jadephysio.id", name: "Manajer Demo", role: "manager" },
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

/** Staff sign in by email; patients by phone, so their phone number (+62...) is their key in access and accounts. */
export const loginId = (u: Pick<User, "email" | "phoneNumber"> | null) => u?.email?.toLowerCase() ?? u?.phoneNumber ?? null;

/** "0812-3456 7890", "62812..." or "+62812..." to "+6281234567890". */
export function toE164(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return `+${d}`;
}

/** "+6281234567890" to "081234567890", the way the clinic writes numbers. */
export const localPhone = (e164: string) => (e164.startsWith("+62") ? `0${e164.slice(3)}` : e164);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const signingUp = useRef(false);
  const attach = useRef<(u: User | null) => void>(() => {});
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);

  useEffect(() => {
    if (DEMO_MODE) {
      setState({ status: "ready", user: DEMO_USERS[demoRole()] });
      return;
    }
    let stopAccess: (() => void) | undefined;
    attach.current = (u) => {
      stopAccess?.();
      stopAccess = undefined;
      const email = loginId(u);
      if (!u || !email) return setState({ status: "signed_out" });
      const name = u.displayName || (u.email ? email.split("@")[0] : localPhone(email));
      // Live: if an admin changes this person's role or removes them, the app follows.
      stopAccess = onSnapshot(
        doc(db(), "access", email),
        (snap) => {
          const a = snap.exists() ? (snap.data() as Access) : null;
          const role = normalizeRole(a?.role);
          if (!a || !role) setState({ status: "no_access", user: { email, name } });
          else setState({ status: "ready", user: { email, name: a.name || name, role, staffId: a.staffId } });
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

  async function signUpInner(name: string, email: string, password: string) {
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
    async signUp(name, email, password) {
      signingUp.current = true;
      try {
        await signUpInner(name, email, password);
      } finally {
        signingUp.current = false;
      }
      attach.current(auth().currentUser);
    },
    async sendCode(phone, buttonId) {
      if (DEMO_MODE) return;
      // A fresh verifier each time: the old one cannot be rendered into the button twice.
      verifier.current?.clear();
      verifier.current = new RecaptchaVerifier(auth(), buttonId, { size: "invisible" });
      confirmation.current = await signInWithPhoneNumber(auth(), toE164(phone), verifier.current);
    },
    async verifyCode(code) {
      if (DEMO_MODE) {
        if (code.trim() !== "123456") throw { code: "auth/invalid-verification-code" };
        setDemoRole("patient");
        return "ready";
      }
      if (!confirmation.current) throw { code: "auth/code-expired" };
      // Hold the app back until we know whether this number already has an account.
      signingUp.current = true;
      try {
        const cred = await confirmation.current.confirm(code.trim());
        const id = loginId(cred.user)!;
        if ((await getDoc(doc(db(), "access", id))).exists()) {
          signingUp.current = false;
          attach.current(cred.user);
          return "ready";
        }
        return "new";
      } catch (e) {
        signingUp.current = false;
        throw e;
      }
    },
    async registerPatient(name, email) {
      const u = auth().currentUser;
      const id = loginId(u);
      if (!u || !id?.startsWith("+")) throw { code: "auth/code-expired" };
      await updateProfile(u, { displayName: name.trim() }).catch(() => {});
      await setDoc(doc(db(), "access", id), { role: "patient", name: name.trim(), addedAt: Date.now() } satisfies Access);
      await setDoc(doc(db(), "accounts", id), {
        name: name.trim(),
        email: email?.trim() || null,
        persons: [{ id: "self", name: name.trim(), phone: localPhone(id), relation: "self" }],
        createdAt: Date.now(),
      } satisfies PortalAccount);
      signingUp.current = false;
      attach.current(u);
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

/**
 * Admin: make a login for a staff member or a clinic account, with a password the admin hands over.
 * "exists" when the email already has a login; its password stays as it was.
 */
export async function createLogin(email: string, password: string, name: string): Promise<"created" | "exists"> {
  if (DEMO_MODE) return "created";
  const a = provisionAuth();
  try {
    const cred = await createUserWithEmailAndPassword(a, email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
    return "created";
  } catch (e) {
    if ((e as { code?: string })?.code === "auth/email-already-in-use") return "exists";
    throw e;
  } finally {
    await fbSignOut(a).catch(() => {});
  }
}

/** Email a link to set a new password. Firebase sends it, and does not reveal whether the email has an account. */
export async function sendPasswordReset(email: string) {
  if (DEMO_MODE) return;
  await sendPasswordResetEmail(auth(), email.trim());
}

export function authErrorMessage(e: unknown) {
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
    return "Email atau kata sandi salah.";
  if (code.includes("email-already-in-use")) return "Email ini sudah terdaftar. Silakan masuk.";
  if (code.includes("weak-password")) return "Kata sandi minimal 6 karakter.";
  if (code.includes("invalid-email") || code.includes("missing-email")) return "Format email tidak valid.";
  if (code.includes("invalid-phone-number") || code.includes("missing-phone-number")) return "Nomor HP tidak valid. Contoh: 0812 3456 7890.";
  if (code.includes("invalid-verification-code")) return "Kodenya salah. Cek lagi SMS yang masuk.";
  if (code.includes("code-expired") || code.includes("session-expired")) return "Kodenya sudah kedaluwarsa. Kirim ulang kode.";
  if (code.includes("captcha-check-failed") || code.includes("invalid-app-credential"))
    return "Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi.";
  if (code.includes("billing-not-enabled")) return "Pengiriman SMS belum aktif: proyek Firebase perlu paket Blaze.";
  if (code.includes("operation-not-allowed")) return "Masuk dengan nomor HP belum diaktifkan di Firebase.";
  if (code.includes("unauthorized-domain")) return "Alamat situs ini belum diizinkan di Firebase (Authorized domains).";
  if (code.includes("quota-exceeded")) return "Batas SMS hari ini tercapai. Coba lagi nanti.";
  if (code.includes("user-disabled")) return "Akun ini dinonaktifkan. Hubungi admin klinik.";
  if (code.includes("too-many-requests")) return "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.";
  if (code.includes("network")) return "Tidak ada koneksi internet.";
  return "Gagal masuk. Coba lagi.";
}
