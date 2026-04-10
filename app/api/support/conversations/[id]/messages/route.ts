import { NextRequest, NextResponse } from "next/server";

import { requireVerifiedCustomer } from "@/lib/commerce/auth";
import { sendConversationMessage } from "@/lib/commerce/support";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id } = await context.params;
    const { customer } = await requireVerifiedCustomer();
    const message = await sendConversationMessage(customer, id, body);
    return NextResponse.json(message);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send support message" },
      { status: 400 }
    );
  }
}
