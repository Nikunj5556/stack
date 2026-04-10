import { NextRequest, NextResponse } from "next/server";

import { searchHelpContent } from "@/lib/commerce/help";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q") || "";
    const results = await searchHelpContent(query);
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to search help content" },
      { status: 400 }
    );
  }
}
