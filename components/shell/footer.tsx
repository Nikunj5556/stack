import Link from "next/link";

import type { StorePolicies, StoreSettings } from "@/lib/supabase/types";

export function Footer({
  store,
  policies
}: {
  store: StoreSettings;
  policies: StorePolicies | null;
}) {
  const hasSupportEmail = Boolean(store.support_email);
  const hasSupportPhone = Boolean(store.support_phone);

  return (
    <footer className="shell-footer">
      <div className="page-shell shell-footer__grid">
        <div>
          <p className="eyebrow">Creatorstack</p>
          <h3>{store.store_name}</h3>
          <p className="muted">
            Shop with confidence using secure payments, quick access to your purchases, and friendly support.
          </p>
        </div>

        <div>
          <h4>Need help?</h4>
          {hasSupportEmail ? <p className="muted">{store.support_email}</p> : null}
          {hasSupportPhone ? <p className="muted">{store.support_phone}</p> : null}
          {!hasSupportEmail && !hasSupportPhone ? (
            <p className="muted">Our support team is available through the support center and your order support tools.</p>
          ) : null}
          <div className="footer-links">
            <Link className="text-link" href="/support">
              Support center
            </Link>
            <Link className="text-link" href="/faq">
              FAQs
            </Link>
            <Link className="text-link" href="/support#help-library">
              Help articles
            </Link>
          </div>
        </div>

        <div>
          <h4>Shop with confidence</h4>
          <p className="muted">
            {policies?.refund_policy?.slice(0, 160) ||
              "Clear delivery, refund, and usage policies help you place every order with confidence."}
          </p>
          <Link className="text-link" href="/support">
            Contact support
          </Link>
        </div>
      </div>
    </footer>
  );
}
