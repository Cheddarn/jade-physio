"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button, Sheet, useToast } from "./ui";
import { authErrorMessage, sendPasswordReset, useUser } from "@/lib/auth";

/* Change your own password: the link goes to the account's email, as with "Lupa kata sandi?". Same file in both apps. */

/** Accounts that sign in with an email (patients who sign in by phone have no password to change). */
export const hasEmailLogin = (email: string) => email.includes("@");

export function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useUser();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  function close() {
    setSent(false);
    onClose();
  }

  async function send() {
    setBusy(true);
    try {
      await sendPasswordReset(user.email);
      setSent(true);
    } catch (e) {
      toast(authErrorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Ganti kata sandi"
      footer={
        sent ? (
          <Button size="lg" block onClick={close}>
            Selesai
          </Button>
        ) : (
          <Button size="lg" block loading={busy} onClick={send}>
            Kirim link ke email saya
          </Button>
        )
      }
    >
      {sent ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-xl bg-jade-mist px-4 py-3 text-sm text-jade-deep">
            <MailCheck className="mt-0.5 size-5 shrink-0" />
            <p>
              Link terkirim ke <span className="font-semibold break-all">{user.email}</span>.
            </p>
          </div>
          <p className="text-sm text-ink-2">
            Buka email itu dan ketuk linknya untuk membuat kata sandi baru. Belum masuk? Cek folder Spam atau Promosi.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-sm text-ink-2">
          <p>
            Kami kirim link untuk membuat kata sandi baru ke email akun Anda:
            <span className="mt-1 block text-base font-semibold break-all text-ink">{user.email}</span>
          </p>
          <p className="text-muted">Kata sandi lama tetap berlaku sampai Anda menggantinya lewat link itu.</p>
        </div>
      )}
    </Sheet>
  );
}
