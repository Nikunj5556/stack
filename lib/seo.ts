import type { Metadata } from "next";

import { env } from "@/lib/env";
import type { Category, FAQ, HelpArticle, ProductWithRelations, StoreSettings } from "@/lib/supabase/types";

const DEFAULT_DESCRIPTION =
  "Creatorstack helps creators discover premium digital products, instant downloads, trusted support, and practical help guides.";

const DEFAULT_KEYWORDS = [
  "digital products",
  "creator marketplace",
  "creator tools",
  "templates",
  "assets",
  "Creatorstack"
];

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function trimText(value: string | null | undefined, fallback: string, max = 160) {
  const source = value?.trim() || fallback;
  return source.length > max ? `${source.slice(0, max - 3).trim()}...` : source;
}

export function absoluteUrl(path = "/") {
  return new URL(path, env.siteUrl).toString();
}

export function buildKeywords(...groups: Array<Array<string | null | undefined> | undefined>) {
  const values = groups.flatMap((group) => group ?? []).filter(Boolean) as string[];
  return [...new Set([...DEFAULT_KEYWORDS, ...values.map((value) => value.trim()).filter(Boolean)])];
}

export function buildSiteMetadata(storeName: string): Metadata {
  return {
    metadataBase: new URL(env.siteUrl),
    title: {
      default: `${storeName} | Premium Digital Products for Creators`,
      template: `%s | ${storeName}`
    },
    description: DEFAULT_DESCRIPTION,
    keywords: DEFAULT_KEYWORDS,
    alternates: {
      canonical: "/"
    },
    openGraph: {
      type: "website",
      url: absoluteUrl("/"),
      siteName: storeName,
      title: `${storeName} | Premium Digital Products for Creators`,
      description: DEFAULT_DESCRIPTION,
      images: env.appLogoUrl ? [{ url: env.appLogoUrl, alt: storeName }] : []
    },
    twitter: {
      card: "summary_large_image",
      title: `${storeName} | Premium Digital Products for Creators`,
      description: DEFAULT_DESCRIPTION,
      images: env.appLogoUrl ? [env.appLogoUrl] : []
    },
    category: "ecommerce",
    robots: {
      index: true,
      follow: true
    }
  };
}

export function buildPageMetadata(args: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  image?: string | null;
  noIndex?: boolean;
}): Metadata {
  return {
    title: args.title,
    description: args.description,
    keywords: args.keywords,
    alternates: {
      canonical: args.path
    },
    openGraph: {
      type: "website",
      url: absoluteUrl(args.path),
      title: args.title,
      description: args.description,
      images: args.image ? [{ url: args.image, alt: args.title }] : undefined
    },
    twitter: {
      card: args.image ? "summary_large_image" : "summary",
      title: args.title,
      description: args.description,
      images: args.image ? [args.image] : undefined
    },
    robots: args.noIndex
      ? {
          index: false,
          follow: false
        }
      : {
          index: true,
          follow: true
        }
  };
}

export function buildHomeMetadata(store: StoreSettings) {
  return buildPageMetadata({
    title: `${store.store_name} digital products marketplace`,
    description: trimText(
      store.support_email
        ? `Shop premium digital downloads from ${store.store_name} with secure checkout, instant delivery, and support at ${store.support_email}.`
        : `Shop premium digital downloads from ${store.store_name} with secure checkout, instant delivery, and practical creator support.`,
      DEFAULT_DESCRIPTION
    ),
    path: "/",
    keywords: buildKeywords([store.store_name, "buy digital products online", "instant download assets"]),
    image: store.logo_url || env.appLogoUrl
  });
}

export function buildCatalogMetadata() {
  return buildPageMetadata({
    title: "Digital products catalog",
    description:
      "Browse Creatorstack's digital catalog for templates, creator assets, guides, and downloadable products built for fast delivery.",
    path: "/catalog",
    keywords: buildKeywords(["digital product catalog", "creator templates", "downloadable assets"])
  });
}

export function buildCategoryMetadata(category: Category) {
  return buildPageMetadata({
    title: category.seo_title || `${category.name} digital products`,
    description: trimText(
      category.seo_description || category.description,
      `Explore ${category.name} digital products, downloads, and creator tools from Creatorstack.`
    ),
    path: `/categories/${category.slug}`,
    keywords: buildKeywords([category.name, category.slug.replace(/-/g, " "), "digital downloads"])
  });
}

export function buildProductMetadata(product: ProductWithRelations) {
  const image = product.product_media?.[0]?.url || null;
  return buildPageMetadata({
    title: product.seo_title || product.name,
    description: trimText(
      product.seo_description || product.short_description || product.full_description,
      `${product.name} is available on Creatorstack with secure checkout and instant digital delivery.`
    ),
    path: `/products/${product.slug}`,
    keywords: buildKeywords([
      product.name,
      product.brand,
      product.publisher,
      ...(product.tags ?? []),
      product.categories?.name,
      "buy digital product"
    ]),
    image
  });
}

export function buildHelpMetadata(article: HelpArticle, path: string) {
  return buildPageMetadata({
    title: article.seo_title || article.title,
    description: trimText(
      article.seo_description || stripHtml(article.content),
      `${article.title} on Creatorstack Help Center.`
    ),
    path,
    keywords: buildKeywords([article.title, article.category, ...(article.tags ?? []), ...(article.keywords ?? [])])
  });
}

export function buildFaqMetadata(faq: FAQ) {
  return buildPageMetadata({
    title: faq.question,
    description: trimText(stripHtml(faq.answer), `${faq.question} answered by Creatorstack.`),
    path: `/faq/${faq.seo_slug}`,
    keywords: buildKeywords([faq.question, faq.category, ...(faq.tags ?? [])])
  });
}

export function buildPrivatePageMetadata(title: string, description: string): Metadata {
  return buildPageMetadata({
    title,
    description,
    path: "/",
    noIndex: true
  });
}

export function buildOrganizationJsonLd(store: StoreSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: store.store_name,
    url: absoluteUrl("/"),
    logo: store.logo_url || env.appLogoUrl,
    email: store.support_email || undefined,
    telephone: store.support_phone || undefined
  };
}

export function buildWebsiteJsonLd(store: StoreSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: store.store_name,
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/catalog")}?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
}

export function buildProductJsonLd(product: ProductWithRelations) {
  const image = product.product_media?.map((media) => media.url) ?? [];
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: trimText(product.short_description || product.full_description, product.name, 300),
    image,
    sku: product.sku || undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    category: product.categories?.name || undefined,
    aggregateRating:
      product.total_reviews > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: Number(product.avg_rating),
            reviewCount: product.total_reviews
          }
        : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: Number(product.base_price),
      availability:
        product.unlimited_stock || product.stock_quantity > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: absoluteUrl(`/products/${product.slug}`)
    }
  };
}

export function buildArticleJsonLd(article: HelpArticle, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    datePublished: article.created_at,
    dateModified: article.updated_at,
    author: {
      "@type": "Organization",
      name: "Creatorstack"
    },
    publisher: {
      "@type": "Organization",
      name: "Creatorstack",
      logo: {
        "@type": "ImageObject",
        url: env.appLogoUrl
      }
    },
    description: trimText(article.seo_description || stripHtml(article.content), article.title, 300),
    mainEntityOfPage: absoluteUrl(path)
  };
}

export function buildFaqJsonLd(faqs: FAQ[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: stripHtml(faq.answer)
      }
    }))
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path)
    }))
  };
}
