"use client";

import type { ReactNode } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";
import { useAdminRouteGuard } from "@/lib/use-admin-route-guard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuthProfile();
  const { denied } = useAdminRouteGuard({ loading, user, profile });

  if (loading || denied) {
    return (
      <main className="grid min-h-[70vh] place-items-center text-sm font-black text-lime-800">
        🍀 {loading ? "権限を確認中..." : "My Communityへ移動中..."}
      </main>
    );
  }

  return <>{children}</>;
}
