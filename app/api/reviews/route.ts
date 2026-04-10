import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedCustomer } from "@/lib/commerce/auth";
import { createProductReview } from "@/lib/commerce/support";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer } = await requireAuthenticatedCustomer();
    const review = await createProductReview(customer, body);
    return NextResponse.json(review);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit review" },
      { status: 400 }
    );
  }
}
