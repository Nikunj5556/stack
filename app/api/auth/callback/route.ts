import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { applySessionCookie, authenticateWithOAuth, linkOAuthProviderForCurrentCustomer } from "@/lib/commerce/auth";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const nextPath = request.nextUrl.searchParams.get("next") || "/auth";
  const mode = request.nextUrl.searchParams.get("mode") || "signin";
  const provider = request.nextUrl.searchParams.get("provider");
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  try {
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    } else if (tokenHash && type) {
      await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type
      });
    }

    if (provider === "google" || provider === "github") {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("OAuth sign-in did not return a user session.");
      }

      if (mode === "link") {
        await linkOAuthProviderForCurrentCustomer(user, provider);
        const linkedUrl = new URL(nextPath, request.url);
        linkedUrl.searchParams.set("linked_provider", provider);
        response.headers.set("Location", linkedUrl.toString());
        return response;
      }

      const oauthResult = await authenticateWithOAuth(user, provider);
      applySessionCookie(response, oauthResult.sessionToken, oauthResult.sessionExpiresAt);
      return response;
    }
  } catch (error) {
    const fallback = mode === "link" ? "/account" : "/auth";
    const redirectUrl = new URL(fallback, request.url);
    redirectUrl.searchParams.set(
      "error",
      error instanceof Error ? error.message : "We could not complete sign-in right now."
    );
    response.headers.set("Location", redirectUrl.toString());
    return response;
  }

  return response;
}
