import type { Metadata } from "next";
import Link from "next/link";

import { getCustomerPortalSnapshot } from "@/lib/commerce/auth";
import { getCustomerDownloads } from "@/lib/commerce/downloads";
import { buildPrivatePageMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = buildPrivatePageMetadata(
  "Downloads",
  "Access your Creatorstack purchased downloads."
);

export default async function DownloadsPage() {
  const snapshot = await getCustomerPortalSnapshot();

  if (!snapshot) {
    return (
      <div className="page-shell page-stack">
        <section className="empty-panel">
          <p className="eyebrow">Downloads</p>
          <h1>Sign in to access your purchased files.</h1>
          <Link className="button" href="/auth">
            Sign in
          </Link>
        </section>
      </div>
    );
  }

  const downloads = await getCustomerDownloads(snapshot.customer.id);

  return (
    <div className="page-shell page-stack">
      <section className="section-block">
        <p className="eyebrow">Digital delivery</p>
        <h1>Your purchased downloads</h1>
      </section>

      <div className="review-grid">
        {downloads.length ? (
          downloads.map(({ grant, product, file, order }) => (
            <article className="review-card" key={grant.id}>
              <strong>{product?.name || "Purchased file"}</strong>
              <p>{file?.file_name}</p>
              <p className="muted">{order?.order_number || "Order details coming soon"}</p>
              <p className="muted">Granted {formatDate(grant.created_at)}</p>
              <a className="button" href={`/api/downloads/${grant.id}`}>
                Download file
              </a>
            </article>
          ))
        ) : (
          <div className="empty-panel">Your download library will appear here after a successful purchase.</div>
        )}
      </div>
    </div>
  );
}
