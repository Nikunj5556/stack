import { NextResponse } from "next/server";

import { getFaqPageData } from "@/lib/commerce/help";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const data = await getFaqPageData(slug);

    if (!data) {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }

    return NextResponse.json({
      title: data.faq.question,
      content: data.faq.answer,
      seo_title: data.faq.question,
      seo_description: data.faq.answer.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160),
      keywords: data.faq.tags ?? [],
      related_articles: data.relatedFaqs,
      related_products: []
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load FAQ" },
      { status: 400 }
    );
  }
}
