import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSessionRecord } from "@/lib/commerce/auth";
import { env } from "@/lib/env";

const providerSchema = z.object({
  provider: z.enum(["google", "github"]),
  next: z.string().trim().optional().nullable()
});

export async function POST(request: NextRequest) {
  try {
    const body = providerSchema.parse(await request.json());
    const customerSession = await getCurrentSessionRecord();
    const mode = customerSession ? "link" : "signin";
    const nextPath = body.next || (mode === "link" ? "/account" : "/auth");
    const redirectTo = new URL("/api/auth/callback", env.siteUrl);
    redirectTo.searchParams.set("provider", body.provider);
    redirectTo.searchParams.set("mode", mode);
    redirectTo.searchParams.set("next", nextPath);

    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: body.provider,
      options: {
        redirectTo: redirectTo.toString(),
        skipBrowserRedirect: true
      }
    });

    if (error || !data.url) {
      throw new Error(error?.message || `Unable to start ${body.provider} sign-in.`);
    }

    return NextResponse.json({
      url: data.url
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start provider sign-in" },
      { status: 400 }
    );
  }
}
