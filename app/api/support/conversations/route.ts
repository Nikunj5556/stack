import { NextResponse } from "next/server";

import { createConversation } from "@/lib/commerce/support";
import { requireVerifiedCustomer } from "@/lib/commerce/auth";

export async function POST() {
  try {
    const { customer } = await requireVerifiedCustomer();
    const conversation = await createConversation(customer);
    return NextResponse.json(conversation);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create conversation" },
      { status: 400 }
    );
  }
}
