"use client";

import { useState } from "react";

import type { UserIdentity } from "@/lib/supabase/types";
import { safeJson } from "@/lib/utils";

const OAUTH_PROVIDERS = [
  { provider: "google", label: "Google" },
  { provider: "github", label: "GitHub" }
] as const;

export function ConnectedAccounts({
  emailVerified,
  phoneVerified,
  linkedProviders,
  nextPath,
  title = "Connected accounts",
  description = "Use email, WhatsApp, and social sign-in together without creating duplicate accounts."
}: {
  emailVerified?: boolean;
  phoneVerified?: boolean;
  linkedProviders?: UserIdentity[];
  nextPath: string;
  title?: string;
  description?: string;
}) {
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [status, setStatus] = useState(description);

  async function startProvider(provider: "google" | "github") {
    setPendingProvider(provider);
    try {
      const body = await safeJson<{ url: string }>(
        await fetch("/api/auth/link-provider", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            provider,
            next: nextPath
          })
        })
      );

      window.location.assign(body.url);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Unable to start ${provider} right now.`);
      setPendingProvider(null);
    }
  }

  function isLinked(provider: string) {
    return linkedProviders?.some((identity) => identity.provider === provider) ?? false;
  }

  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Connected accounts</p>
          <h2>{title}</h2>
        </div>
      </div>
      <p className="muted">{status}</p>

      <div className="status-grid">
        <div>
          <span>Email</span>
          <strong>{emailVerified ? "Verified" : "Use email OTP"}</strong>
        </div>
        <div>
          <span>Phone</span>
          <strong>{phoneVerified ? "Verified" : "Use WhatsApp OTP"}</strong>
        </div>
      </div>

      <div className="form-stack">
        {OAUTH_PROVIDERS.map((provider) => {
          const linked = isLinked(provider.provider);
          return (
            <div className="connected-account-row" key={provider.provider}>
              <div>
                <strong>{provider.label}</strong>
                <p className="muted">
                  {linked ? `${provider.label} is already linked to this Creatorstack account.` : `Connect ${provider.label} to sign in faster.`}
                </p>
              </div>
              <button
                className="button button--ghost"
                disabled={linked || pendingProvider !== null}
                onClick={() => void startProvider(provider.provider)}
                type="button"
              >
                {linked ? "Connected" : pendingProvider === provider.provider ? "Connecting..." : `Connect ${provider.label}`}
              </button>
            </div>
          );
        })}

        <div className="connected-account-row connected-account-row--disabled">
          <div>
            <strong>Microsoft</strong>
            <p className="muted">Available after you enable Microsoft in Supabase for this store.</p>
          </div>
          <button className="button button--ghost" disabled type="button">
            Coming soon
          </button>
        </div>
      </div>
    </section>
  );
}
