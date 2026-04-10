import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSessionRecord } from "@/lib/commerce/auth";
import { submitHelpFeedback } from "@/lib/commerce/help";

const feedbackSchema = z.object({
  isHelpful: z.boolean(),
  sessionId: z.string().trim().optional().nullable(),
  feedbackText: z.string().trim().max(1500).optional().nullable()
});

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const body = feedbackSchema.parse(await request.json());
    const { slug } = await context.params;
    const session = await getCurrentSessionRecord();
    const result = await submitHelpFeedback({
      articleId: slug,
      isHelpful: body.isHelpful,
      customerId: session?.customer_id ?? null,
      sessionId: body.sessionId ?? session?.id ?? null,
      feedbackText: body.feedbackText ?? null
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save feedback" },
      { status: 400 }
    );
  }
}
