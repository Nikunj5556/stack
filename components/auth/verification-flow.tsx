"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { useAuth } from "@/hooks/use-auth";
import { hasConnectedOAuth, type CustomerSyncResponse } from "@/lib/auth/shared";
import { safeJson } from "@/lib/utils";

interface VerificationFlowProps {
  purpose?: "account_access" | "guest_checkout";
  eyebrow?: string;
  title?: string;
  description?: string;
  onSynced?: (snapshot: CustomerSyncResponse) => void;
}

export function VerificationFlow({
  purpose = "guest_checkout",
  eyebrow = "Checkout access",
  title = "Verify what is still missing",
  description = "Guest checkout needs a verified email and WhatsApp number. Creatorstack accounts can sign in first, then add phone verification in one quick step.",
  onSynced
}: VerificationFlowProps) {
  const pathname = usePathname();
  const { customer, setCustomer, openAuthDialog } = useAuth();
  const [email, setEmail] = useState(customer?.customer.email || "");
  const [phone, setPhone] = useState(customer?.customer.phone || "");
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [status, setStatus] = useState(description);
  const [pending, setPending] = useState<null | "send-email" | "send-phone" | "verify-email" | "verify-phone">(null);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);

  const oauthLinked = useMemo(() => hasConnectedOAuth(customer), [customer]);
  const emailReady = Boolean(customer?.customer.email_verified || oauthLinked);
  const phoneReady = Boolean(customer?.customer.phone_verified);

  useEffect(() => {
    if (customer?.customer.email) {
      setEmail(customer.customer.email);
    }

    if (customer?.customer.phone) {
      setPhone(customer.customer.phone);
    }
  }, [customer?.customer.email, customer?.customer.phone]);

  async function requestCode(channel: "email" | "whatsapp") {
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedEmail) {
      setStatus("Enter your email address to continue.");
      return;
    }

    if (!trimmedPhone) {
      setStatus("Enter your WhatsApp number to continue.");
      return;
    }

    setPending(channel === "email" ? "send-email" : "send-phone");
    try {
      const body = await safeJson<{ message: string }>(
        await fetch("/api/auth/request-otp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: trimmedEmail,
            phone: trimmedPhone,
            channel,
            purpose
          })
        })
      );

      setStatus(body.message);
      if (channel === "email") {
        setEmailCodeSent(true);
      } else {
        setPhoneCodeSent(true);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "We could not send a verification code right now.");
    } finally {
      setPending(null);
    }
  }

  async function verifyCode(channel: "email" | "whatsapp") {
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const otp = channel === "email" ? emailOtp : phoneOtp;

    if (!trimmedEmail || !trimmedPhone || otp.trim().length !== 6) {
      setStatus("Enter your contact details and the 6-digit code to continue.");
      return;
    }

    setPending(channel === "email" ? "verify-email" : "verify-phone");
    try {
      const snapshot = await safeJson<CustomerSyncResponse>(
        await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: trimmedEmail,
            phone: trimmedPhone,
            channel,
            purpose,
            otp
          })
        })
      );

      setCustomer(snapshot);
      onSynced?.(snapshot);

      if (channel === "email") {
        setEmailOtp("");
      } else {
        setPhoneOtp("");
      }

      setStatus(
        snapshot.customer.email_verified && snapshot.customer.phone_verified
          ? "You are verified and ready to continue to payment."
          : snapshot.customer.phone_verified
            ? "Your WhatsApp number is verified."
            : "Your email is verified. One quick WhatsApp step remains."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "We could not verify that code.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="auth-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </div>

      <p className="muted">{status}</p>

      {!customer ? (
        <div className="auth-step-card auth-step-card--split">
          <div>
            <strong>Already have a Creatorstack account?</strong>
            <p className="muted">Sign in with email, Google, or GitHub and we will only ask for WhatsApp if it is still missing.</p>
          </div>
          <button
            className="button button--ghost"
            onClick={() => openAuthDialog({ redirectTo: pathname || "/checkout" })}
            type="button"
          >
            Sign in faster
          </button>
        </div>
      ) : null}

      {!emailReady ? (
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
            <span>WhatsApp number</span>
            <input
              autoComplete="tel"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91 98765 43210"
              value={phone}
            />
          </label>
          <div className="button-row">
            <button className="button" disabled={pending !== null} onClick={() => void requestCode("email")} type="button">
              {pending === "send-email" ? "Sending..." : "Send email code"}
            </button>
          </div>
          {emailCodeSent ? (
            <>
              <label className="field">
                <span>Email code</span>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setEmailOtp(event.target.value)}
                  placeholder="123456"
                  value={emailOtp}
                />
              </label>
              <button
                className="button button--ghost"
                disabled={pending !== null}
                onClick={() => void verifyCode("email")}
                type="button"
              >
                {pending === "verify-email" ? "Verifying..." : "Verify email"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {emailReady && !phoneReady ? (
        <div className="form-stack">
          <label className="field">
            <span>WhatsApp number</span>
            <input
              autoComplete="tel"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91 98765 43210"
              value={phone}
            />
          </label>
          <button className="button" disabled={pending !== null} onClick={() => void requestCode("whatsapp")} type="button">
            {pending === "send-phone" ? "Sending..." : "Send WhatsApp code"}
          </button>
          {phoneCodeSent ? (
            <>
              <label className="field">
                <span>WhatsApp code</span>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setPhoneOtp(event.target.value)}
                  placeholder="123456"
                  value={phoneOtp}
                />
              </label>
              <button
                className="button button--ghost"
                disabled={pending !== null}
                onClick={() => void verifyCode("whatsapp")}
                type="button"
              >
                {pending === "verify-phone" ? "Verifying..." : "Verify WhatsApp"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="status-grid">
        <div>
          <span>Email status</span>
          <strong>{emailReady ? "Ready" : "Needs verification"}</strong>
        </div>
        <div>
          <span>Phone status</span>
          <strong>{phoneReady ? "Verified" : "WhatsApp required"}</strong>
        </div>
        <div>
          <span>Checkout access</span>
          <strong>{emailReady && phoneReady ? "Unlocked" : "Almost there"}</strong>
        </div>
      </div>
    </div>
  );
}
