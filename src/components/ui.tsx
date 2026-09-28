"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, X, AlertCircle } from "lucide-react";
import { initials } from "@/lib/format";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------------- Buttons ---------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
const variants: Record<Variant, string> = {
  primary: "bg-jade text-white hover:bg-jade-deep active:bg-jade-deep disabled:bg-jade/40",
  secondary: "bg-surface text-ink border border-line hover:border-ink-2/40 hover:bg-canvas disabled:text-muted",
  ghost: "text-ink-2 hover:bg-line-soft hover:text-ink disabled:text-muted",
  danger: "bg-surface text-danger border border-line hover:border-danger/40 hover:bg-danger-mist",
  quiet: "text-jade hover:bg-jade-mist disabled:text-muted",
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "primary", size = "md", loading, icon, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-semibold transition-colors disabled:cursor-not-allowed",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-[15px]",
        block && "w-full",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-10 items-center justify-center rounded-[10px] text-ink-2 transition-colors hover:bg-line-soft hover:text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- Form fields ---------------- */

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-[10px] border border-line bg-surface px-3 text-ink placeholder:text-muted/70 transition-colors hover:border-ink-2/30 focus:border-jade focus:outline-none focus:ring-3 focus:ring-jade/15 disabled:bg-canvas";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(inputBase, "h-11 md:h-10", className)} {...rest} />;
});

export function MoneyInput({
  value,
  onChange,
  id,
  placeholder = "0",
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  id?: string;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value ? value.toLocaleString("id-ID") : "");
  useEffect(() => {
    const parsed = Number(text.replace(/\D/g, "")) || 0;
    if (parsed !== value) setText(value ? value.toLocaleString("id-ID") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cx("relative", className)}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted">
        Rp
      </span>
      <input
        id={id}
        inputMode="numeric"
        className={cx(inputBase, "tnum h-11 pl-10 md:h-10")}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, "")) || 0;
          setText(n ? n.toLocaleString("id-ID") : "");
          onChange(n);
        }}
      />
    </div>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputBase, "min-h-20 py-2.5", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputBase, "h-11 appearance-none bg-no-repeat pr-9 md:h-10", className)} {...rest}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%236a7872' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 10px center",
      }}
    >
      {children}
    </select>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-sm font-medium text-ink"
    >
      <span className={cx("relative h-6 w-10 rounded-full transition-colors", checked ? "bg-jade" : "bg-line")}>
        <span
          className={cx(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
      {label}
    </button>
  );
}

/** Segmented control / tab strip */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cx("inline-flex rounded-[10px] bg-line-soft p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 whitespace-nowrap rounded-[7px] px-3 font-semibold transition-colors",
            size === "sm" ? "h-7 text-[13px]" : "h-8 text-[13px] md:text-sm",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Surfaces ---------------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-xl border border-line bg-surface", className)}>{children}</div>;
}

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "jade" | "amber" | "danger" | "outline";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-line-soft text-ink-2",
    jade: "bg-jade-mist text-jade-deep",
    amber: "bg-amber-mist text-amber",
    danger: "bg-danger-mist text-danger",
    outline: "border border-line text-ink-2",
  };
  return (
    <span className={cx("inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color?: { bg: string; fg: string }; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: color?.bg ?? "var(--color-jade-mist)",
        color: color?.fg ?? "var(--color-jade-deep)",
      }}
    >
      {initials(name)}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-end justify-between gap-3 px-4 pb-4 pt-5 md:px-8 md:pt-8", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.01em] md:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-jade-mist text-jade">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center justify-center py-16 text-muted", className)}>
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

/* ---------------- Sheet: bottom sheet on phones, side panel on desktop ---------------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
      <div className="anim-fade absolute inset-0 bg-ink/35" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          "anim-sheet-up md:anim-sheet-left relative flex max-h-[92dvh] w-full flex-col rounded-t-[var(--radius-sheet)] bg-surface shadow-[var(--shadow-sheet)] outline-none md:max-h-none md:rounded-none md:rounded-l-[var(--radius-sheet)]",
          wide ? "md:w-[560px]" : "md:w-[460px]",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" />
        <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5 md:px-6 md:py-4">
          <h2 id={titleId} className="text-[17px] font-bold">
            {title}
          </h2>
          <IconButton label="Tutup" onClick={onClose} className="-mr-2">
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5 md:px-6">{children}</div>
        {footer && (
          <div className="border-t border-line-soft px-5 pt-3 pb-[calc(12px+var(--safe-bottom))] md:px-6 md:pb-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Confirm ---------------- */

export function Confirm({
  open,
  title,
  body,
  confirmLabel,
  tone = "primary",
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center">
      <div className="anim-fade absolute inset-0 bg-ink/35" onClick={onClose} />
      <div role="alertdialog" aria-modal="true" className="anim-sheet-up relative w-full max-w-sm rounded-2xl bg-surface p-5 shadow-[var(--shadow-sheet)]">
        <h2 className="text-[17px] font-bold">{title}</h2>
        {body && <div className="mt-1.5 text-sm text-ink-2">{body}</div>}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" block onClick={onClose}>
            Kembali
          </Button>
          <Button
            block
            variant={tone === "danger" ? "primary" : "primary"}
            className={tone === "danger" ? "!bg-danger hover:!bg-danger/90" : ""}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Toasts ---------------- */

type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastCtx = createContext<(text: string, tone?: "ok" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+var(--safe-bottom))] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="anim-sheet-up pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-lg"
          >
            {t.tone === "ok" ? (
              <CheckCircle2 className="size-[18px] shrink-0 text-[#6fd3ad]" />
            ) : (
              <AlertCircle className="size-[18px] shrink-0 text-[#ff9b8f]" />
            )}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function errorText(e: unknown) {
  if (e instanceof Error && e.message) {
    if (e.message.includes("permission")) return "Akses ditolak. Pastikan akun Anda punya akses admin.";
    return e.message;
  }
  return "Terjadi kesalahan. Coba lagi.";
}
