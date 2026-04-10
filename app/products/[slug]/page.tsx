import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductViewTracker } from "@/components/meta/product-view-tracker";
import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { BuyNowButton } from "@/components/product/buy-now-button";
import { ProductCard } from "@/components/product/product-card";
import { ReviewComposer } from "@/components/product/review-composer";
import { StructuredData } from "@/components/seo/structured-data";
import { getProductPageData } from "@/lib/commerce/catalog";
import { buildBreadcrumbJsonLd, buildProductJsonLd, buildProductMetadata } from "@/lib/seo";
import { formatCurrency } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductPageData(slug);

  if (!data) {
    return {};
  }

  return buildProductMetadata(data.product);
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getProductPageData(slug);

  if (!data) {
    notFound();
  }

  const heroMedia =
    data.product.product_media?.[0]?.url || "https://images.unsplash.com/photo-1498050108023-c5249f4df085";

  return (
    <div className="page-shell page-stack">
      <StructuredData data={buildProductJsonLd(data.product)} />
      <StructuredData
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Catalog", path: "/catalog" },
          {
            name: data.product.categories?.name || data.product.product_type,
            path: data.product.categories?.slug ? `/categories/${data.product.categories.slug}` : "/catalog"
          },
          { name: data.product.name, path: `/products/${data.product.slug}` }
        ])}
      />
      <ProductViewTracker />
      <section className="product-hero">
        <div className="product-hero__media">
          <Image alt={data.product.name} fill sizes="(max-width: 768px) 100vw, 50vw" src={heroMedia} />
        </div>
        <div className="product-hero__content">
          <p className="eyebrow">{data.product.product_type}</p>
          <h1>{data.product.name}</h1>
          <p className="muted">{data.product.full_description || data.product.short_description}</p>
          <div className="price-stack">
            <strong>{formatCurrency(data.product.base_price)}</strong>
            {data.product.compare_at_price ? (
              <span>{formatCurrency(data.product.compare_at_price)}</span>
            ) : null}
          </div>
          <div className="button-row">
            <AddToCartButton
              image={heroMedia}
              name={data.product.name}
              price={Number(data.product.base_price)}
              productId={data.product.id}
              slug={data.product.slug}
            />
            <BuyNowButton />
          </div>
          <div className="info-grid">
            <div>
              <span>Files included</span>
              <strong>{data.product.digital_files?.length ?? 0}</strong>
            </div>
            <div>
              <span>Tags</span>
              <strong>{data.product.tags?.slice(0, 3).join(", ") || "Digital product"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reviews</p>
            <h2>What customers are saying</h2>
          </div>
          <p className="muted">
            {data.product.total_reviews
              ? `${Number(data.product.avg_rating).toFixed(1)}/5 from ${data.product.total_reviews} review${data.product.total_reviews > 1 ? "s" : ""}`
              : "No reviews yet"}
          </p>
        </div>
        <div className="review-grid">
          {data.reviews.length ? (
            data.reviews.map((review) => (
              <article className="review-card" key={review.id}>
                <div className="review-card__head">
                  <strong>{review.customer?.full_name || "Creatorstack customer"}</strong>
                  <div className="review-badges">
                    {review.is_verified_purchase ? <span className="review-badge">Verified purchase</span> : null}
                    <span>{review.rating}/5</span>
                  </div>
                </div>
                <p>{review.title || "Customer review"}</p>
                <p className="muted">{review.review_text || "This customer shared a rating without written notes."}</p>
                {review.media?.length ? (
                  <div className="review-media-grid">
                    {review.media.map((media) =>
                      media.media_type === "video" ? (
                        <video controls key={media.id} preload="metadata">
                          <source src={media.media_url} />
                        </video>
                      ) : (
                        <div className="review-media" key={media.id}>
                          <Image
                            alt={review.title || data.product.name}
                            fill
                            sizes="(max-width: 768px) 100vw, 240px"
                            src={media.media_url}
                          />
                        </div>
                      )
                    )}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="empty-panel">Be the first customer to share feedback on this product.</div>
          )}
        </div>
      </section>

      <ReviewComposer productId={data.product.id} />

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">You may also like</p>
            <h2>Related digital products</h2>
          </div>
        </div>
        <div className="product-grid">
          {data.relatedProducts.length ? (
            data.relatedProducts.map((product) => <ProductCard key={product.id} product={product} />)
          ) : (
            <div className="empty-panel">More recommendations will appear here as new products are added.</div>
          )}
        </div>
      </section>
    </div>
  );
}
