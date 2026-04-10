import type { MetadataRoute } from "next";

import { getVisibleCategories, getCatalogData } from "@/lib/commerce/catalog";
import { getAllFaqs } from "@/lib/commerce/help";
import { absoluteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, faqs] = await Promise.all([
    getVisibleCategories(),
    getCatalogData(),
    getAllFaqs()
  ]);

  const staticRoutes: MetadataRoute.Sitemap = ["", "/catalog", "/support", "/faq"].map((path) => ({
    url: absoluteUrl(path || "/"),
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.8
  }));

  return [
    ...staticRoutes,
    ...categories.map((category) => ({
      url: absoluteUrl(`/categories/${category.slug}`),
      lastModified: new Date(category.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8
    })),
    ...products.map((product) => ({
      url: absoluteUrl(`/products/${product.slug}`),
      lastModified: new Date(product.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.9
    })),
    ...faqs
      .filter((faq) => faq.seo_slug)
      .map((faq) => ({
        url: absoluteUrl(`/faq/${faq.seo_slug}`),
        lastModified: new Date(faq.created_at),
        changeFrequency: "monthly" as const,
        priority: 0.7
      }))
  ];
}
