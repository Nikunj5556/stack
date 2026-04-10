import type { Metadata } from "next";

import { ProductCard } from "@/components/product/product-card";
import { getCatalogData, getVisibleCategories } from "@/lib/commerce/catalog";
import { buildCatalogMetadata } from "@/lib/seo";

export const metadata: Metadata = buildCatalogMetadata();

export default async function CatalogPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; category?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const [products, categories] = await Promise.all([
    getCatalogData(params.q, params.category),
    getVisibleCategories()
  ]);

  return (
    <div className="page-shell page-stack">
      <section className="section-block section-block--tight">
        <p className="eyebrow">Catalog</p>
        <h1>Explore all products</h1>
        <p className="muted">Browse the full Creatorstack collection and find the right digital product for your next project.</p>
      </section>

      <section className="filter-strip">
        <a className={!params.category ? "filter-pill filter-pill--active" : "filter-pill"} href="/catalog">
          All
        </a>
        {categories.map((category) => (
          <a
            className={params.category === category.id ? "filter-pill filter-pill--active" : "filter-pill"}
            href={`/catalog?category=${category.id}`}
            key={category.id}
          >
            {category.name}
          </a>
        ))}
      </section>

      <div className="product-grid">
        {products.length ? (
          products.map((product) => <ProductCard key={product.id} product={product} />)
        ) : (
          <div className="empty-panel">We could not find products for this filter right now. Try another category.</div>
        )}
      </div>
    </div>
  );
}
