"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/hooks/use-auth";
import type { CustomerSyncResponse } from "@/lib/auth/shared";
import { safeJson } from "@/lib/utils";

type AuthStep = "credentials" | "otp";
type OAuthProvider = "google" | "github";

interface EmailAccessStartResponse {
  mode: "signed_in" | "otp_required";
  message: string;
  snapshot?: CustomerSyncResponse;
  email?: string;
}

export function AccountAccessPanel({
  title = "Sign in or create your Creatorstack account",
  description = "Use your email and password, or keep it instant with Google or GitHub. Phone verification can wait until checkout.",
  redirectTo,
  compact = false,
  onSuccess
}: {
  title?: string;
  description?: string;
  redirectTo?: string | null;
  compact?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { customer, setCustomer, syncCustomer } = useAuth();
  const [email, setEmail] = useState(customer?.customer.email || "");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<AuthStep>("credentials");
  const [status, setStatus] = useState(description);
  const [pending, setPending] = useState<null | "email" | "otp" | OAuthProvider>(null);

  useEffect(() => {
    if (customer?.customer.email) {
      setEmail(customer.customer.email);
    }
  }, [customer?.customer.email]);

  async function finalizeSignIn(snapshot?: CustomerSyncResponse | null) {
    const synced = snapshot ?? (await syncCustomer());
    if (synced) {
      setCustomer(synced);
    }

    onSuccess?.();

    if (redirectTo && pathname !== redirectTo) {
      router.push(redirectTo as Route);
      return;
    }

    router.refresh();
  }

  async function startEmailAccess() {
    setPending("email");
    try {
      const body = await safeJson<EmailAccessStartResponse>(
        await fetch("/api/auth/email-access/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email,
            password
          })
        })
      );

      setStatus(body.message);

      if (body.mode === "signed_in") {
        await finalizeSignIn(body.snapshot ?? null);
        return;
      }

      setStep("otp");
      if (body.email) {
        setEmail(body.email);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "We could not continue with email right now.");
    } finally {
      setPending(null);
    }
  }

  async function verifyOtp() {
    setPending("otp");
    try {
      const snapshot = await safeJson<CustomerSyncResponse>(
        await fetch("/api/auth/email-access/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email,
            otp
          })
        })
      );

      setStatus("You are signed in and ready to continue.");
      await finalizeSignIn(snapshot);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "We could not verify that code.");
    } finally {
      setPending(null);
    }
  }

  async function startProvider(provider: OAuthProvider) {
    setPending(provider);
    try {
      const body = await safeJson<{ url: string }>(
        await fetch("/api/auth/link-provider", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            provider,
            next: redirectTo || pathname || "/account"
          })
        })
      );

      window.location.assign(body.url);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Unable to start ${provider} right now.`);
      setPending(null);
    }
  }

  if (customer) {
    return (
      <section className={compact ? "auth-flow auth-flow--compact" : "auth-flow"}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Account access</p>
            <h1>You are already signed in.</h1>
          </div>
        </div>

        <p className="muted">
          Continue with your Creatorstack account, manage connected providers, or head back to checkout to finish phone verification.
        </p>

        <div className="button-row">
          <button
            className="button"
            onClick={() => {
              onSuccess?.();
              if (redirectTo && pathname !== redirectTo) {
                router.push(redirectTo as Route);
                return;
              }
              router.push("/account");
            }}
            type="button"
          >
            Continue
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={compact ? "auth-flow auth-flow--compact" : "auth-flow"}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Account access</p>
          <h1>{title}</h1>
        </div>
      </div>

      <p className="muted">{status}</p>

      {step === "credentials" ? (
        <div className="form-stack">
          <label className="field">
            <span>Email</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              type="password"
              value={password}
            />
          </label>

          <button className="button" disabled={pending !== null} onClick={() => void startEmailAccess()} type="button">
            {pending === "email" ? "Continuing..." : "Continue with email"}
          </button>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <div className="auth-provider-grid">
            <button
              className="button button--ghost auth-provider-button"
              disabled={pending !== null}
              onClick={() => void startProvider("google")}
              type="button"
            >
              {pending === "google" ? "Opening Google..." : "Continue with Google"}
            </button>
            <button
              className="button button--ghost auth-provider-button"
              disabled={pending !== null}
              onClick={() => void startProvider("github")}
              type="button"
            >
              {pending === "github" ? "Opening GitHub..." : "Continue with GitHub"}
            </button>
          </div>
        </div>
      ) : (
        <div className="form-stack">
          <div className="auth-step-card">
            <strong>Check your inbox</strong>
            <p className="muted">Enter the 6-digit code we sent to {email}. Once it matches, your account is ready.</p>
          </div>

          <label className="field">
            <span>Email code</span>
            <input
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setOtp(event.target.value)}
              placeholder="123456"
              value={otp}
            />
          </label>

          <button className="button" disabled={pending !== null} onClick={() => void verifyOtp()} type="button">
            {pending === "otp" ? "Verifying..." : "Verify and continue"}
          </button>

          <button
            className="button button--ghost"
            disabled={pending !== null}
            onClick={() => {
              setStep("credentials");
              setOtp("");
              setStatus(description);
            }}
            type="button"
          >
            Use a different email
          </button>
        </div>
      )}
    </section>
  );
}
