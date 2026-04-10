import type { Metadata } from "next";
import Link from "next/link";

import { WalletPanel } from "@/components/wallet/wallet-panel";
import { getCustomerPortalSnapshot } from "@/lib/commerce/auth";
import { buildPrivatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPrivatePageMetadata(
  "Wallet",
  "View and top up your Creatorstack wallet."
);

export default async function WalletPage() {
  const snapshot = await getCustomerPortalSnapshot();

  if (!snapshot) {
    return (
      <div className="page-shell page-stack">
        <section className="empty-panel">
          <p className="eyebrow">Wallet</p>
          <h1>Sign in to use wallet balance and add money to your account.</h1>
          <Link className="button" href="/auth">
            Sign in
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell page-stack">
      <WalletPanel initialBalance={Number(snapshot.wallet.current_balance)} />
    </div>
  );
}
