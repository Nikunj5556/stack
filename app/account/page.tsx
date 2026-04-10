import type { Metadata } from "next";

import { AccountAccessPanel } from "@/components/auth/account-access-panel";
import { AccountSessionActions } from "@/components/auth/account-session-actions";
import { ConnectedAccounts } from "@/components/auth/connected-accounts";
import { getCustomerPortalSnapshot } from "@/lib/commerce/auth";
import { buildPrivatePageMetadata } from "@/lib/seo";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = buildPrivatePageMetadata(
  "Customer account",
  "Manage your Creatorstack account, orders, and wallet."
);

export default async function AccountPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; linked_provider?: string }>;
}) {
  const [snapshot, params] = await Promise.all([getCustomerPortalSnapshot(), searchParams]);

  if (!snapshot) {
    return (
      <div className="page-shell page-stack">
        <section className="auth-card">
          <AccountAccessPanel redirectTo="/account" title="Sign in to view your orders, downloads, and wallet." />
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell page-stack">
      {params.error ? (
        <section className="empty-panel">
          <p className="eyebrow">Connected accounts</p>
          <h2>{params.error}</h2>
        </section>
      ) : null}

      {params.linked_provider ? (
        <section className="empty-panel">
          <p className="eyebrow">Connected accounts</p>
          <h2>{params.linked_provider} is now linked to your Creatorstack account.</h2>
        </section>
      ) : null}

      <section className="section-block">
        <p className="eyebrow">My account</p>
        <h1>{snapshot.customer.full_name || snapshot.customer.email}</h1>
        <AccountSessionActions />
        <div className="status-grid">
          <div>
            <span>Email verified</span>
            <strong>{snapshot.customer.email_verified ? "Yes" : "No"}</strong>
          </div>
          <div>
            <span>Phone verified</span>
            <strong>{snapshot.customer.phone_verified ? "Yes" : "No"}</strong>
          </div>
          <div>
            <span>Wallet balance</span>
            <strong>{formatCurrency(snapshot.wallet.current_balance)}</strong>
          </div>
        </div>
      </section>

      <ConnectedAccounts
        emailVerified={snapshot.customer.email_verified}
        linkedProviders={snapshot.linkedProviders}
        nextPath="/account"
        phoneVerified={snapshot.customer.phone_verified}
      />

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recent orders</p>
            <h2>Your recent purchases</h2>
          </div>
        </div>
        <div className="review-grid">
          {snapshot.orders.length ? (
            snapshot.orders.map((order) => (
              <article className="review-card" key={order.id}>
                <strong>{order.order_number}</strong>
                <p>{order.order_status}</p>
                <p className="muted">{formatDate(order.purchase_date)}</p>
                <p>{formatCurrency(order.grand_total)}</p>
              </article>
            ))
          ) : (
            <div className="empty-panel">Orders will appear here once you complete checkout.</div>
          )}
        </div>
      </section>
    </div>
  );
}
