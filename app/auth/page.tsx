import type { Metadata } from "next";

import { AccountAccessPanel } from "@/components/auth/account-access-panel";
import { buildPrivatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPrivatePageMetadata(
  "Account access",
  "Sign in or create your Creatorstack account with email, Google, or GitHub."
);

export default async function AuthPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="page-shell page-stack">
      {params.error ? (
        <section className="empty-panel">
          <p className="eyebrow">Sign-in update</p>
          <h2>{params.error}</h2>
        </section>
      ) : null}
      <section className="auth-card">
        <AccountAccessPanel redirectTo="/account" />
      </section>
    </div>
  );
}
