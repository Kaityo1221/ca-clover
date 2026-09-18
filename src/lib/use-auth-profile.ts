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
        setLoading(false);
        return;
      }

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("role,niantic_id")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (!alive) return;
      setProfile((profileRow as AuthProfile | null) ?? null);
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

  return { supabase, user, profile, loading };
}
