import { NextRequest, NextResponse } from "next/server";

import { requireVerifiedCustomer } from "@/lib/commerce/auth";
import { verifyCheckoutPayment } from "@/lib/commerce/checkout";
import { getRequestClientIp, getRequestUserAgent } from "@/lib/meta/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer, wallet } = await requireVerifiedCustomer();
    const result = await verifyCheckoutPayment({
      customer,
      wallet,
      checkoutSessionId: body.checkoutSessionId,
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
      purchaseEventId: body.purchaseEventId,
      eventSourceUrl: body.eventSourceUrl,
      clientIpAddress: getRequestClientIp(request.headers),
      clientUserAgent: getRequestUserAgent(request.headers)
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment verification failed" },
      { status: 400 }
    );
  }
}
