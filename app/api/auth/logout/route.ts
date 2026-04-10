import { NextResponse } from "next/server";

import { clearSessionCookie, signOutCurrentCustomer } from "@/lib/commerce/auth";

export async function POST() {
  await signOutCurrentCustomer();
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
