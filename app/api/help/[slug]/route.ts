import { NextResponse } from "next/server";

import { getHelpArticlePageData } from "@/lib/commerce/help";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const data = await getHelpArticlePageData(slug, "help");

    if (!data) {
      return NextResponse.json({ error: "Help article not found" }, { status: 404 });
    }

    return NextResponse.json({
      title: data.article.title,
      content: data.article.content,
      seo_title: data.article.seo_title,
      seo_description: data.article.seo_description,
      keywords: data.article.keywords ?? data.article.tags ?? [],
      related_articles: data.relatedArticles,
      related_products: data.relatedProducts
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load help article" },
      { status: 400 }
    );
  }
}
