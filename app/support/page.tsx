import Link from "next/link";
import type { Metadata } from "next";

import { HelpFeedback } from "@/components/docs/help-feedback";
import { HelpSearch } from "@/components/docs/help-search";
import { StructuredData } from "@/components/seo/structured-data";
import { SupportWorkspace } from "@/components/support/support-workspace";
import { getCustomerPortalSnapshot } from "@/lib/commerce/auth";
import { getAllFaqs, getGuides, getHelpArticles } from "@/lib/commerce/help";
import { getSupportWorkspace } from "@/lib/commerce/support";
import { buildArticleJsonLd, buildFaqJsonLd, buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Support, help articles, and customer guides",
  description:
    "Get Creatorstack support, browse searchable help articles, read practical guides, and find answers for orders, downloads, payments, and account access.",
  path: "/support",
  keywords: [
    "creatorstack support",
    "digital product help",
    "download support",
    "refund help",
    "customer guides",
    "checkout support"
  ]
});

export default async function SupportPage() {
  const [snapshot, helpArticles, guides, faqs] = await Promise.all([
    getCustomerPortalSnapshot(),
    getHelpArticles(),
    getGuides(),
    getAllFaqs()
  ]);
  const workspace = snapshot ? await getSupportWorkspace(snapshot.customer.id) : null;

  return (
    <div className="page-shell page-stack">
      <StructuredData data={buildFaqJsonLd(faqs)} />
      {helpArticles.map((article) => (
        <StructuredData data={buildArticleJsonLd(article, `/support#help-${article.slug}`)} key={`help-schema-${article.id}`} />
      ))}
      {guides.map((guide) => (
        <StructuredData data={buildArticleJsonLd(guide, `/support#guide-${guide.slug}`)} key={`guide-schema-${guide.id}`} />
      ))}

      <section className="hero-panel hero-panel--compact">
        <div className="hero-panel__copy">
          <p className="eyebrow">Support center</p>
          <h1>Get answers, follow step-by-step guides, and reach Creatorstack support in one place.</h1>
          <p className="muted">
            Search product help, read customer guides, check common FAQs, and sign in whenever you want live chat,
            ticket updates, or order-specific support.
          </p>
          <div className="button-row">
            <Link className="button" href="#help-library">
              Browse help articles
            </Link>
            <Link className="button button--ghost" href="#direct-support">
              Contact support
            </Link>
          </div>
        </div>

        <div className="hero-panel__card">
          <p className="eyebrow">Fast help</p>
          <ul className="promise-list">
            <li>Find checkout, wallet, download, and refund answers without leaving the page.</li>
            <li>Use your account to start live chat, manage tickets, and keep every support reply in one place.</li>
            <li>Read practical guides before or after purchase to get the most from your digital products.</li>
          </ul>
        </div>
      </section>

      <HelpSearch />

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Popular topics</p>
            <h2>Jump straight to the answer you need</h2>
          </div>
          <Link className="text-link" href="#direct-support">
            Need personal help?
          </Link>
        </div>
        <div className="review-grid">
          {helpArticles.slice(0, 3).map((article) => (
            <Link className="review-card" href={`#help-${article.slug}`} key={article.id}>
              <strong>{article.title}</strong>
              <p className="muted">{article.seo_description || article.category || "Help article"}</p>
            </Link>
          ))}
          {guides.slice(0, 2).map((guide) => (
            <Link className="review-card" href={`#guide-${guide.slug}`} key={guide.id}>
              <strong>{guide.title}</strong>
              <p className="muted">{guide.seo_description || guide.category || "Guide"}</p>
            </Link>
          ))}
          {faqs.slice(0, 1).map((faq) =>
            faq.seo_slug ? (
              <Link className="review-card" href={`/faq/${faq.seo_slug}`} key={faq.id}>
                <strong>{faq.question}</strong>
                <p className="muted">{faq.category || "FAQ"}</p>
              </Link>
            ) : null
          )}
        </div>
      </section>

      <section className="section-block" id="help-library">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Help library</p>
            <h2>Searchable help articles</h2>
          </div>
        </div>
        <div className="docs-library">
          {helpArticles.length ? (
            helpArticles.map((article) => (
              <article className="section-block docs-article support-doc" id={`help-${article.slug}`} key={article.id}>
                <div className="support-doc__header">
                  <div>
                    <p className="eyebrow">{article.category || "Help article"}</p>
                    <h3>{article.title}</h3>
                  </div>
                  <a className="text-link" href={`#help-${article.slug}`}>
                    Copy link
                  </a>
                </div>
                <p className="muted">
                  {article.seo_description || "Practical support guidance for shopping, payment, delivery, and account access."}
                </p>
                <div className="docs-rich-text" dangerouslySetInnerHTML={{ __html: article.content }} />
                <HelpFeedback articleId={article.id} />
              </article>
            ))
          ) : (
            <div className="empty-panel">
              <h2>Help articles are coming soon.</h2>
              <p className="muted">You can still contact the support team below if you need help right away.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Guides</p>
            <h2>Step-by-step customer guides</h2>
          </div>
        </div>
        <div className="docs-library">
          {guides.length ? (
            guides.map((guide) => (
              <article className="section-block docs-article support-doc" id={`guide-${guide.slug}`} key={guide.id}>
                <div className="support-doc__header">
                  <div>
                    <p className="eyebrow">{guide.category || "Guide"}</p>
                    <h3>{guide.title}</h3>
                  </div>
                  <a className="text-link" href={`#guide-${guide.slug}`}>
                    Copy link
                  </a>
                </div>
                <p className="muted">
                  {guide.seo_description || "Follow a practical guide for setup, access, account actions, and product use."}
                </p>
                <div className="docs-rich-text" dangerouslySetInnerHTML={{ __html: guide.content }} />
                <HelpFeedback articleId={guide.id} />
              </article>
            ))
          ) : (
            <div className="empty-panel">
              <h2>No guides have been published yet.</h2>
              <p className="muted">Check back soon for setup tips, walkthroughs, and customer best practices.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FAQs</p>
            <h2>More quick answers</h2>
          </div>
          <Link className="text-link" href="/faq">
            View all FAQs
          </Link>
        </div>
        <div className="review-grid">
          {faqs.slice(0, 6).map((faq) =>
            faq.seo_slug ? (
              <Link className="review-card" href={`/faq/${faq.seo_slug}`} key={faq.id}>
                <strong>{faq.question}</strong>
                <p className="muted">{faq.category || "Frequently asked question"}</p>
              </Link>
            ) : null
          )}
        </div>
      </section>

      <section className="section-block" id="direct-support">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Direct support</p>
            <h2>Chat live or open a support ticket</h2>
          </div>
        </div>
        <SupportWorkspace initialData={workspace} />
      </section>
    </div>
  );
}
