// components/auth/SignUpCard.tsx
// A fully custom sign-up form built on Clerk's headless useSignUp hook —
// no <SignUp /> component, no Clerk-hosted UI at any point. Two steps:
// "form" (name/email/password + Google) and "verify" (the 6-digit email
// code Clerk sends once signUp.create succeeds). Google goes through
// Clerk's authenticateWithRedirect, which still lands back on this app's
// own pages (see app/sign-up/sso-callback), never a Clerk-hosted screen.
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
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

export function SignUpCard() {
  const { signUp } = useSignUp();
  const router = useRouter();

  const [step, setStep] = React.useState<"form" | "verify">("form");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleGoogle() {
    setError(null);
    const { error: ssoError } = await signUp.sso({
      strategy: "oauth_google",
      redirectCallbackUrl: "/sign-up/sso-callback",
      redirectUrl: "/",
    });
    if (ssoError) setError(ssoError.message);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: passwordError } = await signUp.password({
      emailAddress: email.trim(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
    if (passwordError) {
      setError(passwordError.message);
      setSubmitting(false);
      return;
    }

    if (signUp.status === "complete") {
      await signUp.finalize({ navigate: () => router.push("/") });
      setSubmitting(false);
      return;
    }

    const { error: codeError } = await signUp.verifications.sendEmailCode();
    if (codeError) {
      setError(codeError.message);
      setSubmitting(false);
      return;
    }
    setStep("verify");
    setSubmitting(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (verifyError) {
      setError(verifyError.message);
      setSubmitting(false);
      return;
    }

    if (signUp.status === "complete") {
      await signUp.finalize({ navigate: () => router.push("/") });
    } else {
      setError("Verification incomplete, double-check the code");
    }
    setSubmitting(false);
  }

  if (step === "verify") {
    return (
      <AuthCardFrame eyebrow="Auth / Verify">
        <div className="jh-step-in">
          <h1 className="mt-3 ff-display text-2xl text-[#f4f2ea]">Check your email</h1>
          <p className="mt-1.5 ff-body text-[13px] leading-relaxed text-[#8b8980]">
            Enter the 6-digit code we sent to {email}.
          </p>
          <form onSubmit={handleVerify} data-conversion="true" className="mt-5 space-y-3">
            <div>
              <label className={labelClass}>Verification code</label>
              <input
                className={`${inputClass} mt-1.5 text-center text-[18px] tracking-[0.4em]`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoFocus
                required
              />
            </div>
            {error && <p className="ff-body text-[13px] text-red-400">{error}</p>}
            <button type="submit" disabled={submitting} className={submitBtn}>
              {submitting ? "Verifying..." : "Verify and continue"}
            </button>
          </form>
        </div>
      </AuthCardFrame>
    );
  }

  return (
    <AuthCardFrame eyebrow="Auth / Sign up">
      <h1 className="mt-3 ff-display text-2xl text-[#f4f2ea]">Create your account</h1>
      <p className="mt-1.5 ff-body text-[13px] leading-relaxed text-[#8b8980]">Start tracking your site in minutes.</p>

      <button type="button" onClick={handleGoogle} className={`${socialBtn} mt-5 w-full`}>
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-[#1b1b18]" />
        <span className="ff-mono text-[10px] uppercase tracking-[0.2em] text-[#5c5a52]">or</span>
        <div className="h-px flex-1 bg-[#1b1b18]" />
      </div>

      <form onSubmit={handleCreate} data-conversion="true" className="mt-5 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelClass}>First name</label>
            <input className={`${inputClass} mt-1.5`} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="flex-1">
            <label className={labelClass}>Last name</label>
            <input className={`${inputClass} mt-1.5`} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input className={`${inputClass} mt-1.5`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>Password</label>
          <input className={`${inputClass} mt-1.5`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>

        {/* Required by Clerk's bot-protection (Smart CAPTCHA) when enabled on
            the instance; invisible and inert when it isn't. */}
        <div id="clerk-captcha" />

        {error && <p className="ff-body text-[13px] text-red-400">{error}</p>}

        <button type="submit" disabled={submitting} className={submitBtn}>
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center ff-body text-[13px] text-[#8b8980]">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-[var(--lime)] hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCardFrame>
  );
}
