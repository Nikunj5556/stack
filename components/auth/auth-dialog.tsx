"use client";

import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import { AccountAccessPanel } from "@/components/auth/account-access-panel";

export function AuthDialog() {
  const { modalOpen, modalRedirectTo, closeAuthDialog } = useAuth();

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAuthDialog();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeAuthDialog, modalOpen]);

  if (!modalOpen) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="dialog-backdrop"
      onClick={() => closeAuthDialog()}
      role="presentation"
    >
      <div
        aria-label="Sign in or create your account"
        aria-modal="true"
        className="dialog-panel auth-dialog-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button
          aria-label="Close sign-in dialog"
          className="dialog-close"
          onClick={() => closeAuthDialog()}
          type="button"
        >
          x
        </button>

        <AccountAccessPanel
          compact
          onSuccess={closeAuthDialog}
          redirectTo={modalRedirectTo}
          title="Welcome back"
        />
      </div>
    </div>
  );
}
