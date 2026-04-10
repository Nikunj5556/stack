import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { applySessionCookie, verifyEmailPasswordAccess } from "@/lib/commerce/auth";
import { getRequestClientIp, getRequestUserAgent } from "@/lib/meta/server";

export const runtime = "nodejs";

const verifyEmailAccessSchema = z.object({
  email: z.string().email(),
  otp: z.string().trim().length(6)
});

export async function POST(request: NextRequest) {
  try {
    const body = verifyEmailAccessSchema.parse(await request.json());
    const result = await verifyEmailPasswordAccess({
      email: body.email,
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
      { error: error instanceof Error ? error.message : "Unable to verify your email code" },
      { status: 400 }
    );
  }
}
