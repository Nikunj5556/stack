import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { applySessionCookie, verifyOtp } from "@/lib/commerce/auth";
import { getRequestClientIp, getRequestUserAgent } from "@/lib/meta/server";

export const runtime = "nodejs";

const verifyOtpSchema = z.object({
  fullName: z.string().trim().max(120).optional().nullable(),
  email: z.string().email(),
  phone: z.string().trim().min(8).max(20),
  channel: z.enum(["email", "whatsapp"]),
  purpose: z.enum(["account_access", "guest_checkout"]),
  otp: z.string().trim().length(6)
});

export async function POST(request: NextRequest) {
  try {
    const body = verifyOtpSchema.parse(await request.json());
    const result = await verifyOtp({
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      channel: body.channel,
      purpose: body.purpose,
      otp: body.otp,
      requestContext: {
        ipAddress: getRequestClientIp(request.headers),
        userAgent: getRequestUserAgent(request.headers)
      }
    });

    const response = NextResponse.json(result.snapshot);
    applySessionCookie(response, result.sessionToken, result.sessionExpiresAt);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify code" },
      { status: 400 }
    );
  }
}
