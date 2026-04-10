import { NextRequest, NextResponse } from "next/server";

import { requireVerifiedCustomer } from "@/lib/commerce/auth";
import { initiateCheckout } from "@/lib/commerce/checkout";
import { getRequestClientIp, getRequestUserAgent } from "@/lib/meta/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer, wallet } = await requireVerifiedCustomer();
    const result = await initiateCheckout({
      customer,
      wallet,
      input: body,
      requestMeta: {
        clientIpAddress: getRequestClientIp(request.headers),
        clientUserAgent: getRequestUserAgent(request.headers)
      }
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start checkout" },
      { status: 400 }
    );
  }
}
