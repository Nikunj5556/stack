import { NextRequest, NextResponse } from "next/server";

import { requireVerifiedCustomer } from "@/lib/commerce/auth";
import { verifyWalletTopup } from "@/lib/commerce/wallet";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer, wallet } = await requireVerifiedCustomer();
    const result = await verifyWalletTopup({
      customer,
      wallet,
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Wallet top-up verification failed" },
      { status: 400 }
    );
  }
}
