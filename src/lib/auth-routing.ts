import type { AppRole } from "@/lib/use-auth-profile";

export function sanitizeNextPath(value: string | null | undefined, fallback = "/my") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/^[\u0000-\u001F\u007F]/.test(value)) return fallback;
  return value;
}

type AdminRedirectArgs = {
  loading: boolean;
  error?: string | null;
  userPresent: boolean;
  role: AppRole | null | undefined;
  pathname: string;
  nonAdminRedirectTo?: string;
};

export function getAdminRedirect({
  loading,
  error = null,
  userPresent,
  role,
  pathname,
  nonAdminRedirectTo = "/my",
}: AdminRedirectArgs) {
  if (loading || error) return null;
  if (!userPresent) {
    const next = sanitizeNextPath(pathname, "/admin");
    return `/login?next=${encodeURIComponent(next)}`;
  }
  if (role !== "admin") return nonAdminRedirectTo;
  return null;
}
