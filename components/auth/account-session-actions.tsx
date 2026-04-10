"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { safeJson } from "@/lib/utils";

export function AccountSessionActions() {
  const router = useRouter();
  const { setCustomer } = useAuth();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await safeJson(await fetch("/api/auth/logout", { method: "POST" }));
      setCustomer(null);
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="button-row">
      <button className="button--ghost" disabled={pending} onClick={() => void signOut()} type="button">
        {pending ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
