import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";

export function useAdminAuth() {
  const { isLoading, user, logout } = useAuth();

  return useMemo(
    () => ({
      isAdmin: Boolean(user?.isAdmin),
      isLoading,
      logout,
    }),
    [isLoading, logout, user?.isAdmin]
  );
}