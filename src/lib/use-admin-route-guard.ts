"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { AuthProfile } from "@/lib/use-auth-profile";

type AdminRouteGuardArgs = {
  loading: boolean;
  user: User | null;
  profile: AuthProfile | null;
  redirectTo?: string;
};

export function useAdminRouteGuard({
  loading,
  user,
  profile,
  redirectTo = "/my",
}: AdminRouteGuardArgs) {
  const router = useRouter();
  const denied = !loading && Boolean(user) && profile?.role !== "admin";

  useEffect(() => {
    if (denied) router.replace(redirectTo);
  }, [denied, redirectTo, router]);

  return { denied };
}
