import { NextRequest, NextResponse } from "next/server";

import { requireVerifiedCustomer } from "@/lib/commerce/auth";
import { getDownloadGrantForCustomer, markDownloadAccessed } from "@/lib/commerce/downloads";
import { buildDownloadUrl } from "@/lib/integrations/apprunner";

function resolveStoragePath(file: { storage_path: string | null; file_url: string }) {
  if (file.storage_path) {
    return file.storage_path;
  }

  try {
    const parsed = new URL(file.file_url);
    return parsed.pathname.replace(/^\/+/, "");
  } catch {
    return file.file_url;
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ grantId: string }> }
) {
  try {
    const { grantId } = await context.params;
    const { customer } = await requireVerifiedCustomer();
    const { grant, file } = await getDownloadGrantForCustomer(grantId, customer);
    const storagePath = resolveStoragePath(file);
    const upstream = await fetch(buildDownloadUrl(storagePath), { cache: "no-store" });

    if (!upstream.ok || !upstream.body) {
      throw new Error("Unable to stream the requested file.");
    }

    await markDownloadAccessed(grant);

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/octet-stream",
        "Content-Disposition":
          upstream.headers.get("Content-Disposition") || `attachment; filename="${file.file_name}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Download failed" },
      { status: 400 }
    );
  }
}
