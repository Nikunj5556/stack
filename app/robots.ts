import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/catalog", "/categories/", "/products/", "/support", "/faq"],
        disallow: ["/checkout", "/account", "/downloads", "/wallet", "/api/"]
      }
    ],
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
