import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requestOtp } from "@/lib/commerce/auth";
import { getRequestClientIp, getRequestUserAgent } from "@/lib/meta/server";

export const runtime = "nodejs";

const requestOtpSchema = z.object({
  fullName: z.string().trim().max(120).optional().nullable(),
  email: z.string().email(),
  phone: z.string().trim().min(8).max(20),
  channel: z.enum(["email", "whatsapp"]),
  purpose: z.enum(["account_access", "guest_checkout"])
});

export async function POST(request: NextRequest) {
  try {
    const body = requestOtpSchema.parse(await request.json());
    const result = await requestOtp({
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      channel: body.channel,
      purpose: body.purpose,
      requestContext: {
        ipAddress: getRequestClientIp(request.headers),
        userAgent: getRequestUserAgent(request.headers)
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send verification code" },
      { status: 400 }
    );
  }
}
