import Link from "next/link";
import type { Metadata } from "next";

import { StructuredData } from "@/components/seo/structured-data";
import { getAllFaqs } from "@/lib/commerce/help";
import { buildFaqJsonLd, buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Frequently asked questions",
  description: "Read Creatorstack FAQs for quick answers about purchases, refunds, downloads, wallet balances, and support.",
  path: "/faq",
  keywords: ["creatorstack faq", "digital downloads faq", "refund faq", "checkout faq"]
});

export default async function FaqIndexPage() {
  const faqs = await getAllFaqs();

  return (
    <div className="page-shell page-stack">
      <StructuredData data={buildFaqJsonLd(faqs)} />
      <section className="section-block section-block--tight">
        <p className="eyebrow">FAQ</p>
        <h1>Quick answers to common shopping questions</h1>
        <p className="muted">Search-engine-friendly answers for common issues help customers resolve questions before they drop out of the funnel.</p>
      </section>

      <div className="review-grid">
        {faqs.map((faq) =>
          faq.seo_slug ? (
            <Link className="review-card" href={`/faq/${faq.seo_slug}`} key={faq.id}>
              <strong>{faq.question}</strong>
              <p className="muted">{faq.category || "Frequently asked question"}</p>
            </Link>
          ) : null
        )}
      </div>
    </div>
  );
}
