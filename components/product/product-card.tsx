import Image from "next/image";
import Link from "next/link";

import type { ProductWithRelations } from "@/lib/supabase/types";
import { formatCurrency } from "@/lib/utils";

export function ProductCard({ product }: { product: ProductWithRelations }) {
  const cover = product.product_media?.[0]?.url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3";
  const category = product.categories?.name || product.category?.name || product.product_type;
  const tags = product.tags?.slice(0, 2).join(" | ") || "Instant delivery";

  return (
    <article className="product-card">
      <Link className="product-card__image" href={`/products/${product.slug}`}>
        <Image alt={product.name} fill sizes="(max-width: 768px) 100vw, 30vw" src={cover} />
      </Link>
      <div className="product-card__body">
        <div className="product-card__meta">
          <span>{category}</span>
          <span>{tags}</span>
        </div>
        <Link href={`/products/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <p className="muted">{product.short_description || product.full_description || "Premium creator asset."}</p>
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
