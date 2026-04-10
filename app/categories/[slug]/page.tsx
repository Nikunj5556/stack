import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/product/product-card";
import { StructuredData } from "@/components/seo/structured-data";
import { getCategoryPageData } from "@/lib/commerce/catalog";
import { buildBreadcrumbJsonLd, buildCategoryMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryPageData(slug);

  if (!data) {
    return {};
  }

  return buildCategoryMetadata(data.category);
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getCategoryPageData(slug);

  if (!data) {
    notFound();
  }

  return (
    <div className="page-shell page-stack">
      <StructuredData
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Catalog", path: "/catalog" },
          { name: data.category.name, path: `/categories/${data.category.slug}` }
        ])}
      />
      <section className="section-block section-block--tight">
        <p className="eyebrow">Category</p>
        <h1>{data.category.name}</h1>
        <p className="muted">{data.category.description || "Explore a handpicked collection of digital products in this category."}</p>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Featured</p>
            <h2>Top picks in this collection</h2>
          </div>
        </div>
        <div className="product-grid">
          {data.featuredProducts.length ? (
            data.featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)
          ) : (
            <div className="empty-panel">Featured picks for this category will appear here soon.</div>
          )}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">All products</p>
            <h2>Everything in this collection</h2>
          </div>
        </div>
        <div className="product-grid">
          {data.products.length ? (
            data.products.map((product) => <ProductCard key={product.id} product={product} />)
          ) : (
            <div className="empty-panel">This category is being refreshed. Please check back soon.</div>
          )}
        </div>
      </section>
    </div>
  );
}
