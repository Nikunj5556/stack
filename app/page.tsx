import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/product/product-card";
import { StructuredData } from "@/components/seo/structured-data";
import { getHomepageData } from "@/lib/commerce/catalog";
import { getAllFaqs, getGuides, getHelpArticles } from "@/lib/commerce/help";
import { STORE_PROMISES } from "@/lib/constants";
import { buildHomeMetadata, buildOrganizationJsonLd, buildWebsiteJsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getHomepageData();
  return buildHomeMetadata(data.store);
}

export default async function HomePage() {
  const [data, helpArticles, faqs, guides] = await Promise.all([
    getHomepageData(),
    getHelpArticles(),
    getAllFaqs(),
    getGuides()
  ]);

  return (
    <div className="page-shell page-stack">
      <StructuredData data={buildOrganizationJsonLd(data.store)} />
      <StructuredData data={buildWebsiteJsonLd(data.store)} />
      <section className="hero-panel">
        <div className="hero-panel__copy">
          <p className="eyebrow">Creatorstack</p>
          <h1>Discover premium digital products, check out securely, and download in minutes.</h1>
          <p className="muted">
            Explore curated templates, assets, and creator tools with smooth checkout, fast delivery, and
            dependable support whenever you need help.
          </p>
          <div className="button-row">
            <Link className="button" href="/catalog">
              Browse products
            </Link>
            <Link className="button button--ghost" href="/auth">
              Sign in
            </Link>
          </div>
        </div>

        <div className="hero-panel__card">
          <p className="eyebrow">Why shop here</p>
          <ul className="promise-list">
            {STORE_PROMISES.map((promise) => (
              <li key={promise}>{promise}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Why customers choose Creatorstack</p>
            <h2>Commerce-ready digital delivery with built-in guidance</h2>
          </div>
        </div>
        <div className="review-grid">
          <article className="review-card">
            <strong>Instant access</strong>
            <p className="muted">Eligible purchases are delivered to the download library quickly after successful payment.</p>
          </article>
          <article className="review-card">
            <strong>Verified checkout</strong>
            <p className="muted">Customers verify email and WhatsApp before payment for safer commerce and cleaner account linking.</p>
          </article>
          <article className="review-card">
            <strong>Search-driven support</strong>
            <p className="muted">Help articles, FAQs, and guides answer buying questions before they block conversion.</p>
          </article>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Featured categories</p>
            <h2>Browse collections picked for creators</h2>
          </div>
          <Link className="text-link" href="/catalog">
            See full catalog
          </Link>
        </div>

        <div className="category-grid">
          {data.featuredCategories.map((category) => (
            <Link className="category-card" href={`/categories/${category.slug}`} key={category.id}>
              <p className="eyebrow">Featured category</p>
              <h3>{category.name}</h3>
              <p className="muted">{category.description || "Curated digital products and creator tools."}</p>
            </Link>
          ))}
        </div>
      </section>

      {data.sections.map(({ section, products }) => (
        <section className="section-block" key={section.id}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Featured picks</p>
              <h2>{section.section_key.replace(/[-_]/g, " ")}</h2>
            </div>
          </div>
          <div className="product-grid">
            {products.length ? (
              products.map((product) => <ProductCard key={product.id} product={product} />)
            ) : (
              <div className="empty-panel">Fresh picks are on the way. Check back soon for new releases.</div>
            )}
          </div>
        </section>
      ))}

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Help & docs</p>
            <h2>Helpful content built for customers and search engines</h2>
          </div>
          <Link className="text-link" href="/support">
            Visit support center
          </Link>
        </div>
        <div className="review-grid">
          {helpArticles.slice(0, 2).map((article) => (
            <Link className="review-card" href={`/support#help-${article.slug}`} key={article.id}>
              <strong>{article.title}</strong>
              <p className="muted">{article.seo_description || article.category || "Help article"}</p>
            </Link>
          ))}
          {guides.slice(0, 1).map((guide) => (
            <Link className="review-card" href={`/support#guide-${guide.slug}`} key={guide.id}>
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
    </div>
  );
}
