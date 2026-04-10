import { NextRequest, NextResponse } from "next/server";

import { requireVerifiedCustomer } from "@/lib/commerce/auth";
import { walletTopupSchema } from "@/lib/commerce/schemas";
import { createWalletTopupOrder } from "@/lib/commerce/wallet";

export async function POST(request: NextRequest) {
  try {
    const body = walletTopupSchema.parse(await request.json());
    const { customer } = await requireVerifiedCustomer();
    const result = await createWalletTopupOrder({
      customer,
      amount: body.amount
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create wallet top-up order" },
      { status: 400 }
    );
  }
}
