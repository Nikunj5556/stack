import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { StructuredData } from "@/components/seo/structured-data";
import { getAllFaqs, getFaqPageData } from "@/lib/commerce/help";
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildFaqMetadata } from "@/lib/seo";

export async function generateStaticParams() {
  const faqs = await getAllFaqs();
  return faqs.filter((faq) => faq.seo_slug).map((faq) => ({ slug: faq.seo_slug as string }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getFaqPageData(slug);

  if (!data) {
    return {};
  }

  return buildFaqMetadata(data.faq);
}

export default async function FaqPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getFaqPageData(slug);

  if (!data) {
    notFound();
  }

  return (
    <div className="page-shell page-stack">
      <StructuredData data={buildFaqJsonLd([data.faq])} />
      <StructuredData
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "FAQ", path: "/faq" },
          { name: data.faq.question, path: `/faq/${data.faq.seo_slug}` }
        ])}
      />

      <article className="section-block docs-article">
        <p className="eyebrow">{data.faq.category || "FAQ"}</p>
        <h1>{data.faq.question}</h1>
        <div dangerouslySetInnerHTML={{ __html: data.faq.answer }} className="docs-rich-text" />
      </article>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">More FAQs</p>
            <h2>Related answers</h2>
          </div>
        </div>
        <div className="review-grid">
          {data.relatedFaqs.map((faq) =>
            faq.seo_slug ? (
              <Link className="review-card" href={`/faq/${faq.seo_slug}`} key={faq.id}>
                <strong>{faq.question}</strong>
                <p className="muted">{faq.category || "Frequently asked question"}</p>
              </Link>
            ) : null
          )}
        </div>
      </section>
    </div>
  );
}
