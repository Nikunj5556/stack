import { env } from "@/lib/env";

export async function requestPresignedUpload(payload: {
  fileName: string;
  fileType: string;
  folder?: string;
}) {
  const response = await fetch(`${env.fileServiceUrl}/get-presigned-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Failed to generate upload URL");
  }

  return (await response.json()) as {
    uploadUrl: string;
    publicUrl: string;
    key: string;
  };
}

export function buildDownloadUrl(path: string) {
  const url = new URL(`${env.fileServiceUrl}/download`);
  url.searchParams.set("path", path);
  return url.toString();
}
