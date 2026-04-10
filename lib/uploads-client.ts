"use client";

import { safeJson } from "@/lib/utils";

export async function uploadFiles(files: File[], folder: string) {
  const uploaded: string[] = [];

  for (const file of files) {
    const presigned = await safeJson<{
      uploadUrl: string;
      publicUrl: string;
    }>(
      await fetch("/api/uploads/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          folder
        })
      })
    );

    const uploadResponse = await fetch(presigned.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type
      },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload ${file.name}`);
    }

    uploaded.push(presigned.publicUrl);
  }

  return uploaded;
}
