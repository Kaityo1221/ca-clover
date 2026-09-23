"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase";

export type AppRole = "admin" | "ca" | "pending";

export type AuthProfile = {
  role: AppRole;
  niantic_id: string | null;
  stamp_exchange_message: string | null;
};

export function useAuthProfile() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const retry = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    let loadVersion = 0;

    async function load() {
      const version = ++loadVersion;
      setLoading(true);
      setError(null);

      try {
        const sessionResult = await supabase.auth.getSession();
        if (!alive || version !== loadVersion) return;

        if (sessionResult.error) {
          setUser(null);
          setProfile(null);
          setPermissions([]);
          setError("ログイン状態を確認できませんでした。通信状態を確認して、もう一度お試しください。");
          setLoading(false);
          return;
        }

        const currentUser = sessionResult.data.session?.user ?? null;
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
            .select("role,niantic_id,stamp_exchange_message")
            .eq("id", currentUser.id)
            .maybeSingle(),
          supabase
            .from("user_permissions")
            .select("permission_code")
            .eq("user_id", currentUser.id),
        ]);

        if (!alive || version !== loadVersion) return;

        if (profileResult.error || !profileResult.data) {
          setProfile(null);
          setPermissions([]);
          setError("ユーザー情報を取得できませんでした。権限情報を確定せず、再読み込みを待っています。");
          setLoading(false);
          return;
        }

        if (permissionResult.error) {
          setProfile(null);
          setPermissions([]);
          setError("権限情報を取得できませんでした。安全のため権限を未確定のまま停止しています。");
          setLoading(false);
          return;
        }

        setProfile(profileResult.data as AuthProfile);
        setPermissions(
          ((permissionResult.data as { permission_code: string }[] | null) ?? [])
            .map((row) => row.permission_code)
        );
        setLoading(false);
      } catch {
        if (!alive || version !== loadVersion) return;
        setProfile(null);
        setPermissions([]);
        setError("ログイン情報の読み込み中にエラーが発生しました。もう一度お試しください。");
        setLoading(false);
      }
    }

    void load();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      alive = false;
      loadVersion += 1;
      listener.subscription.unsubscribe();
    };
  }, [refreshKey, supabase]);

  const hasPermission = (code: string) =>
    !error && (profile?.role === "admin" || permissions.includes(code.trim().toUpperCase()));

  return { supabase, user, profile, permissions, hasPermission, loading, error, retry };
}
