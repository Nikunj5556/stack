import { NextRequest, NextResponse } from "next/server";

import { requireVerifiedCustomer } from "@/lib/commerce/auth";
import { createSupportTicket } from "@/lib/commerce/support";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer } = await requireVerifiedCustomer();
    const ticket = await createSupportTicket(customer, body);
    return NextResponse.json(ticket);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create support ticket" },
      { status: 400 }
    );
  }
}
