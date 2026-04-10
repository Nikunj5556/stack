import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { META_EVENT_NAMES } from "@/lib/meta/shared";
import { getRequestClientIp, getRequestUserAgent, sendMetaConversionEvent } from "@/lib/meta/server";

const metaEventSchema = z.object({
  eventName: z.enum(META_EVENT_NAMES),
  eventId: z.string().trim().min(8).max(255),
  eventSourceUrl: z.string().url().optional().nullable(),
  customData: z
    .object({
      currency: z.string().trim().max(8).optional().nullable(),
      value: z.number().finite().nonnegative().optional().nullable()
    })
    .optional()
    .nullable(),
  customer: z
    .object({
      email: z.string().email().optional().nullable(),
      phone: z.string().trim().max(32).optional().nullable(),
      firstName: z.string().trim().max(120).optional().nullable(),
      country: z.string().trim().max(120).optional().nullable()
    })
    .optional()
    .nullable()
});

export async function POST(request: NextRequest) {
  try {
    const body = metaEventSchema.parse(await request.json());

    await sendMetaConversionEvent({
      eventName: body.eventName,
      eventId: body.eventId,
      eventSourceUrl: body.eventSourceUrl,
      customer: body.customer,
      customData: body.customData,
      clientIpAddress: getRequestClientIp(request.headers),
      clientUserAgent: getRequestUserAgent(request.headers)
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to track Meta event" },
      { status: 400 }
    );
  }
}
