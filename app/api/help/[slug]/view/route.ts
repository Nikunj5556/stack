import { NextResponse } from "next/server";

import { incrementHelpArticleViewCount } from "@/lib/commerce/help";

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    await incrementHelpArticleViewCount(slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update article view count" },
      { status: 400 }
    );
  }
}
