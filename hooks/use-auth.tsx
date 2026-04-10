"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { AuthDialog } from "@/components/auth/auth-dialog";
import type { CustomerSyncResponse } from "@/lib/auth/shared";

interface OpenAuthDialogOptions {
  redirectTo?: string | null;
}

interface AuthContextValue {
  customer: CustomerSyncResponse | null;
  loading: boolean;
  modalOpen: boolean;
  modalRedirectTo: string | null;
  openAuthDialog: (options?: OpenAuthDialogOptions) => void;
  closeAuthDialog: () => void;
  syncCustomer: () => Promise<CustomerSyncResponse | null>;
  setCustomer: (snapshot: CustomerSyncResponse | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchCurrentCustomer() {
  try {
    const response = await fetch("/api/auth/sync", { method: "POST" });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as CustomerSyncResponse;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerSyncResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRedirectTo, setModalRedirectTo] = useState<string | null>("/account");

  const syncCustomer = useCallback(async () => {
    const snapshot = await fetchCurrentCustomer();
    setCustomer(snapshot);
    setLoading(false);
    return snapshot;
  }, []);

  useEffect(() => {
    void syncCustomer();
  }, [syncCustomer]);

  const openAuthDialog = useCallback((options?: OpenAuthDialogOptions) => {
    setModalRedirectTo(options?.redirectTo ?? "/account");
    setModalOpen(true);
  }, []);

  const closeAuthDialog = useCallback(() => {
    setModalOpen(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      customer,
      loading,
      modalOpen,
      modalRedirectTo,
      openAuthDialog,
      closeAuthDialog,
      syncCustomer,
      setCustomer
    }),
    [closeAuthDialog, customer, loading, modalOpen, modalRedirectTo, openAuthDialog, syncCustomer]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthDialog />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
