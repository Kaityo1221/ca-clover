"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { AuthProfile } from "@/lib/use-auth-profile";
import { getAdminRedirect } from "@/lib/auth-routing";

type AdminRouteGuardArgs = {
  loading: boolean;
  user: User | null;
  profile: AuthProfile | null;
  error?: string | null;
  redirectTo?: string;
};

export function useAdminRouteGuard({
  loading,
  user,
  profile,
  error = null,
  redirectTo = "/my",
}: AdminRouteGuardArgs) {
  const router = useRouter();
  const pathname = usePathname();
  const unauthenticated = !loading && !error && !user;
  const denied = !loading && !error && Boolean(user) && profile?.role !== "admin";
  const blocked = loading || Boolean(error);

  useEffect(() => {
    const destination = getAdminRedirect({
      loading,
      error,
      userPresent: Boolean(user),
      role: profile?.role,
      pathname,
      nonAdminRedirectTo: redirectTo,
    });
    if (destination) router.replace(destination);
  }, [error, loading, pathname, profile?.role, redirectTo, router, user]);

  return { denied, unauthenticated, blocked };
}
