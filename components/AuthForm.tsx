"use client";

import { ArrowLeft, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { PASSWORD_MIN, useAuth } from "@/lib/auth";
import { useUi } from "@/lib/store";
import { cx } from "./ui";

type Mode = "login" | "signup" | "forgot";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Log in, sign up and forgot password. Prototype only: there is no auth backend yet (spec 10.3),
 * so accounts are checked in the browser (lib/auth.ts) and forgot password sends nothing.
 * Shell sends the user on to their home page once they are signed in.
 */
export function AuthForm() {
  const toast = useUi((s) => s.toast);
  const logIn = useAuth((s) => s.logIn);
  const signUp = useAuth((s) => s.signUp);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const go = (m: Mode) => {
    setMode(m);
    setErrors({});
    setPassword("");
    setSentTo(null);
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Enter your email.";
    else if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email, like name@company.com.";
    if (mode !== "forgot") {
      if (!password) e.password = "Enter your password.";
      else if (mode === "signup" && password.length < PASSWORD_MIN) e.password = `Use at least ${PASSWORD_MIN} characters.`;
    }
    setErrors(e);
    return !e.email && !e.password;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    setBusy(false);
    if (mode === "forgot") {
      setSentTo(email.trim());
      return;
    }
    const res = mode === "signup" ? signUp(email, password) : logIn(email, password);
    if (!res.ok) {
      // Sign up can only fail on a taken email here; validate() already checked the length.
      setErrors(mode === "signup" ? { email: res.error } : { password: res.error });
      return;
    }
    toast(mode === "signup" ? "Account created" : `Signed in as ${res.user.email}`);
  };

  if (mode === "forgot" && sentTo) {
    return (
      <Card>
        <div className="rise flex flex-col items-center text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-good-bg text-good">
            <MailCheck size={24} aria-hidden />
          </span>
          <h1 className="display text-heading leading-tight font-semibold">Check your email</h1>
          <p className="mt-2 text-small text-ink-2">
            If an account exists for <span className="font-semibold text-ink">{sentTo}</span>, we sent a link to reset your password.
          </p>
          <button type="button" className="btn btn-ghost btn-lg mt-6 w-full" onClick={() => go("login")}>
            Back to log in
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {mode === "forgot" ? (
        <div className="mb-5">
          <button type="button" className="btn btn-quiet btn-sm -ml-2.5 mb-3" onClick={() => go("login")}>
            <ArrowLeft size={14} aria-hidden /> Back to log in
          </button>
          <h1 className="display text-heading leading-tight font-semibold">Reset your password</h1>
          <p className="mt-1 text-small text-ink-2">Enter your email and we&rsquo;ll send you a reset link.</p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Log in or sign up" className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-sunk p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={cx(
                  "h-9 cursor-pointer rounded-md text-small font-semibold transition-colors",
                  mode === m ? "bg-panel text-ink shadow-[0_1px_2px_rgba(20,21,24,0.12)]" : "text-ink-3 hover:text-ink",
                )}
                onClick={() => mode !== m && go(m)}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>
          <h1 className="display mb-4 text-heading leading-tight font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        </>
      )}

      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email" error={errors.email}>
          {(id, describedBy) => (
            <input
              id={id}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              className={cx("input h-11 text-body", errors.email && "border-bad")}
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        {mode !== "forgot" && (
          <Field
            label="Password"
            error={errors.password}
            hint={mode === "signup" ? `At least ${PASSWORD_MIN} characters.` : undefined}
            aside={
              mode === "login" && (
                <button type="button" className="cursor-pointer text-caption font-semibold text-brand hover:text-brand-hover hover:underline" onClick={() => go("forgot")}>
                  Forgot password?
                </button>
              )
            }
          >
            {(id, describedBy) => (
              <PasswordInput
                id={id}
                value={password}
                onChange={setPassword}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                invalid={!!errors.password}
                describedBy={describedBy}
              />
            )}
          </Field>
        )}

        <button type="submit" className="btn btn-primary btn-lg mt-1 w-full" disabled={busy}>
          {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
          {mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>
      </form>

      {mode !== "forgot" && (
        <p className="mt-5 text-center text-small text-ink-2">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button type="button" className="cursor-pointer font-semibold text-brand hover:text-brand-hover hover:underline" onClick={() => go(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      )}
    </Card>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-line bg-panel p-6 shadow-[0_24px_60px_-28px_rgba(20,21,24,0.35)] sm:p-8">{children}</div>;
}

function Field({
  label,
  error,
  hint,
  aside,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  aside?: ReactNode;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  const msg = error ?? hint;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {aside}
      </div>
      {children(id, msg ? msgId : undefined)}
      {msg && (
        <p id={msgId} className={cx("mt-1 text-caption", error ? "text-bad" : "text-ink-3")} role={error ? "alert" : undefined}>
          {msg}
        </p>
      )}
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  invalid: boolean;
  describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        className={cx("input h-11 pr-11 text-body", invalid && "border-bad")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center rounded-r-md text-ink-3 hover:text-ink"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  );
}
