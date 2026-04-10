import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedCustomer } from "@/lib/commerce/auth";
import { requestPresignedUpload } from "@/lib/integrations/apprunner";

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedCustomer();
    const body = await request.json();
    const result = await requestPresignedUpload(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload initialization failed" },
      { status: 400 }
    );
  }
}
