import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { applySessionCookie, startEmailPasswordAccess } from "@/lib/commerce/auth";
import { getRequestClientIp, getRequestUserAgent } from "@/lib/meta/server";

export const runtime = "nodejs";

const startEmailAccessSchema = z.object({
  email: z.string().email(),
  password: z.string().trim().min(8).max(120)
});

export async function POST(request: NextRequest) {
  try {
    const body = startEmailAccessSchema.parse(await request.json());
    const result = await startEmailPasswordAccess({
      email: body.email,
      password: body.password,
      requestContext: {
        ipAddress: getRequestClientIp(request.headers),
        userAgent: getRequestUserAgent(request.headers)
      }
    });

    if (result.mode === "signed_in") {
      const response = NextResponse.json({
        mode: result.mode,
        message: result.message,
        snapshot: result.snapshot
      });
      applySessionCookie(response, result.sessionToken, result.sessionExpiresAt);
      return response;
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to continue with email" },
      { status: 400 }
    );
  }
}
