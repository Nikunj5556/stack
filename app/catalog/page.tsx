import type { Metadata } from "next";

import { CatalogSearchForm } from "@/components/catalog/catalog-search-form";
import { Pagination } from "@/components/catalog/pagination";
import { ProductCard } from "@/components/product/product-card";
import { getCatalogData, getVisibleCategories } from "@/lib/commerce/catalog";
import { buildCatalogMetadata } from "@/lib/seo";

export const metadata: Metadata = buildCatalogMetadata();

export default async function CatalogPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number(params.page || "1") || 1);
  const [products, categories] = await Promise.all([
    getCatalogData(params.q, params.category, { page, pageSize: 12 }),
    getVisibleCategories()
  ]);

  return (
    <div className="page-shell page-stack">
      <section className="section-block section-block--tight">
        <p className="eyebrow">Catalog</p>
        <h1>Explore all products</h1>
        <p className="muted">Browse the full Creatorstack collection and find the right digital product for your next project.</p>
      </section>

      <section className="section-block section-block--tight">
        <CatalogSearchForm action="/catalog" categoryId={params.category} query={params.q}>
          {(params.q || params.category) ? (
            <a className="button button--ghost" href="/catalog">
              Clear filters
            </a>
          ) : null}
        </CatalogSearchForm>
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

      <section className="section-block section-block--tight">
        <div className="catalog-results-bar">
          <p className="muted">
            {products.total
              ? `Showing ${products.products.length} of ${products.total} product${products.total > 1 ? "s" : ""}`
              : "No products matched your search yet."}
          </p>
          {products.totalPages > 1 ? <p className="muted">Page {products.page} of {products.totalPages}</p> : null}
        </div>
      </section>

      <div className="product-grid product-grid--catalog">
        {products.products.length ? (
          products.products.map((product) => <ProductCard key={product.id} product={product} />)
        ) : (
          <div className="empty-panel">We could not find products for this filter right now. Try another category.</div>
        )}
      </div>

      <Pagination
        basePath="/catalog"
        currentPage={products.page}
        params={{ q: params.q, category: params.category }}
        totalPages={products.totalPages}
      />
    </div>
  );
}
