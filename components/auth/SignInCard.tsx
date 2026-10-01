// components/auth/SignInCard.tsx
// A fully custom sign-in form built on Clerk's headless useSignIn hook —
// mirrors SignUpCard.tsx exactly: no <SignIn /> component, no Clerk-hosted
// UI at any point. Email + password, or Google via authenticateWithRedirect
// (still landing back on this app's own pages, see app/sign-in/sso-callback).
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { AuthCardFrame } from "./AuthCardFrame";

const inputClass =
  "w-full border border-[#2b2b25] bg-[#0f0f0d] px-3.5 py-2.5 ff-body text-[14px] text-[#f4f2ea] placeholder:text-[#5c5a52] outline-none transition-all duration-200 focus:border-[var(--lime)] focus:shadow-[0_0_0_3px_var(--lime-glow)]";

const labelClass = "ff-mono text-[10px] uppercase tracking-[0.2em] text-[#8b8980]";

const socialBtn =
  "inline-flex h-11 w-full items-center justify-center gap-2.5 border border-[#2b2b25] px-5 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#cac8bf] transition-all duration-200 hover:border-[var(--lime)] hover:text-[var(--lime)] hover:shadow-[0_0_24px_-6px_var(--lime-glow)] active:scale-[0.99]";

const submitBtn =
  "group relative inline-flex h-11 w-full items-center justify-center gap-2.5 bg-[var(--lime)] px-5 text-black ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] transition-all duration-200 hover:bg-[var(--lime-bright)] hover:shadow-[0_0_28px_-4px_var(--lime-glow)] active:scale-[0.99] active:bg-[var(--lime-dim)] disabled:opacity-50 disabled:hover:shadow-none";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.15.8 3.88 1.5l2.6-2.5C16.9 3.1 14.7 2 12 2 6.9 2 2.7 6.2 2.7 11.4S6.9 20.8 12 20.8c6.9 0 9.3-4.9 9.3-7.4 0-.5-.05-.9-.13-1.2H12z" />
    </svg>
  );
}

export function SignInCard() {
  const { signIn } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleGoogle() {
    setError(null);
    const { error: ssoError } = await signIn.sso({
      strategy: "oauth_google",
      redirectCallbackUrl: "/sign-in/sso-callback",
      redirectUrl: "/",
    });
    if (ssoError) setError(ssoError.message);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: passwordError } = await signIn.password({
      identifier: email.trim(),
      password,
    });
    if (passwordError) {
      setError(passwordError.message);
      setSubmitting(false);
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize({ navigate: () => router.push("/") });
    } else {
      setError("Sign in incomplete, this account may need an extra verification step");
    }
    setSubmitting(false);
  }

  return (
    <AuthCardFrame eyebrow="Auth / Sign in">
      <h1 className="mt-3 ff-display text-2xl text-[#f4f2ea]">Sign in</h1>
      <p className="mt-1.5 ff-body text-[13px] leading-relaxed text-[#8b8980]">Welcome back.</p>

      <button type="button" onClick={handleGoogle} className={`${socialBtn} mt-5`}>
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-[#1b1b18]" />
        <span className="ff-mono text-[10px] uppercase tracking-[0.2em] text-[#5c5a52]">or</span>
        <div className="h-px flex-1 bg-[#1b1b18]" />
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <div>
          <label className={labelClass}>Email</label>
          <input className={`${inputClass} mt-1.5`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>Password</label>
          <input className={`${inputClass} mt-1.5`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        {/* Required by Clerk's bot-protection (Smart CAPTCHA) when enabled on
            the instance; invisible and inert when it isn't. */}
        <div id="clerk-captcha" />

        {error && <p className="ff-body text-[13px] text-red-400">{error}</p>}

        <button type="submit" disabled={submitting} className={submitBtn}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center ff-body text-[13px] text-[#8b8980]">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="text-[var(--lime)] hover:underline">
          Sign up
        </Link>
      </p>
    </AuthCardFrame>
  );
}
