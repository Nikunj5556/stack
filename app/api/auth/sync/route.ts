import { NextResponse } from "next/server";

import { clearSessionCookie, syncCurrentCustomer } from "@/lib/commerce/auth";

export async function POST() {
  try {
    const synced = await syncCurrentCustomer();

    if (!synced) {
      const response = NextResponse.json({ error: "No active session" }, { status: 401 });
      clearSessionCookie(response);
      return response;
    }

    return NextResponse.json(synced);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync customer profile" },
      { status: 500 }
    );
  }
}
