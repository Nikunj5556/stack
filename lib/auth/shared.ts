import type { UserIdentity } from "@/lib/supabase/types";

export type CustomerSessionAuthMethod = "email_otp" | "whatsapp_otp" | "google_oauth" | "github_oauth";

export interface CustomerSyncResponse {
  customer: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
    email: string;
    phone: string | null;
    email_verified: boolean;
    phone_verified: boolean;
    profile_image: string | null;
  };
  wallet: {
    current_balance: number;
  };
  session: {
    auth_method: CustomerSessionAuthMethod;
    expires_at: string;
  };
  linked_providers: UserIdentity[];
}

export function hasConnectedOAuth(snapshot: CustomerSyncResponse | null | undefined) {
  return (
    snapshot?.linked_providers.some((identity) => identity.provider === "google" || identity.provider === "github") ??
    false
  );
}
