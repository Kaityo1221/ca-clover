"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { AuthProfile } from "@/lib/use-auth-profile";

type AdminRouteGuardArgs = {
  loading: boolean;
  user: User | null;
  profile: AuthProfile | null;
  error?: string | null;
  redirectTo?: string;
  loginRedirectTo?: string;
};

export function useAdminRouteGuard({
  loading,
  user,
  profile,
  error = null,
  redirectTo = "/my",
  loginRedirectTo = "/login",
}: AdminRouteGuardArgs) {
  const router = useRouter();
  const unauthenticated = !loading && !error && !user;
  const denied = !loading && !error && Boolean(user) && profile?.role !== "admin";
  const blocked = loading || Boolean(error);

  useEffect(() => {
    if (loading || error) return;
    if (!user) {
      router.replace(loginRedirectTo);
      return;
    }
    if (profile?.role !== "admin") router.replace(redirectTo);
  }, [error, loading, loginRedirectTo, profile?.role, redirectTo, router, user]);

  return { denied, unauthenticated, blocked };
}
