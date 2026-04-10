import Image from "next/image";
import Link from "next/link";

import type { ProductWithRelations } from "@/lib/supabase/types";
import { formatCurrency } from "@/lib/utils";

export function ProductCard({ product }: { product: ProductWithRelations }) {
  const cover = product.product_media?.[0]?.url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3";
  const category = product.categories?.name || product.category?.name || product.product_type;
  const tags = product.tags?.slice(0, 2).join(" | ") || "Instant delivery";
  const ratingText =
    product.total_reviews && Number(product.total_reviews) > 0
      ? `${Number(product.avg_rating).toFixed(1)} stars`
      : "New release";

  return (
    <article className="product-card">
      <Link className="product-card__image" href={`/products/${product.slug}`}>
        <Image alt={product.name} fill sizes="(max-width: 768px) 100vw, 30vw" src={cover} />
      </Link>
      <div className="product-card__body">
        <div className="product-card__meta">
          <span>{category}</span>
          <span>{ratingText}</span>
        </div>
        <Link href={`/products/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <p className="muted">{product.short_description || product.full_description || "Premium creator asset."}</p>
        <div className="product-card__chips">
          <span className="product-chip">{tags}</span>
          <span className="product-chip">{product.digital_files?.length ?? 0} files</span>
        </div>
        <div className="product-card__footer">
          <strong>{formatCurrency(product.base_price)}</strong>
          <Link className="button button--ghost" href={`/products/${product.slug}`}>
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
