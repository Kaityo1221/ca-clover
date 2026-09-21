"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase";

export type AppRole = "admin" | "ca" | "pending";

export type AuthProfile = {
  role: AppRole;
  niantic_id: string | null;
};

export function useAuthProfile() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      if (!alive) return;
      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setPermissions([]);
        setLoading(false);
        return;
      }

      const [profileResult, permissionResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("role,niantic_id")
          .eq("id", currentUser.id)
          .maybeSingle(),
        supabase
          .from("user_permissions")
          .select("permission_code")
          .eq("user_id", currentUser.id),
      ]);

      if (!alive) return;
      setProfile((profileResult.data as AuthProfile | null) ?? null);
      setPermissions(
        ((permissionResult.data as { permission_code: string }[] | null) ?? [])
          .map((row) => row.permission_code)
      );
      setLoading(false);
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      load();
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const hasPermission = (code: string) =>
    profile?.role === "admin" || permissions.includes(code.trim().toUpperCase());

  return { supabase, user, profile, permissions, hasPermission, loading };
}
