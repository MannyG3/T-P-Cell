// "Remember me" support, shared by the server, proxy and browser Supabase clients.
//
// @supabase/ssr always writes auth cookies with a 400-day maxAge, so it cannot
// create browser-session cookies by itself. We record the user's choice in
// REMEMBER_COOKIE and strip maxAge/expires from auth cookies when they opted out,
// which turns them into session cookies that disappear when the browser closes.

export const REMEMBER_COOKIE = "ct_remember";
export const PERSISTENT_MAX_AGE = 400 * 24 * 60 * 60;

export type CookieOptionsLike = {
  maxAge?: number;
  expires?: Date | number | string;
  [key: string]: unknown;
};

/** Missing cookie = persistent (e.g. right after following an invite link). */
export const isPersistent = (rememberValue: string | undefined | null): boolean => rememberValue !== "0";

export function applyRemember<T extends CookieOptionsLike>(options: T | undefined, persistent: boolean): T {
  const next = { ...(options ?? {}) } as T;
  const isDeletion = next.maxAge === 0 || (next.expires !== undefined && new Date(next.expires as string).getTime() <= Date.now());
  if (!persistent && !isDeletion) {
    delete next.maxAge;
    delete next.expires;
  }
  return next;
}

/** Cookie options for REMEMBER_COOKIE itself. */
export function rememberCookieOptions(persistent: boolean) {
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: false, // the browser client reads it to keep refreshed tokens session-scoped
    ...(persistent ? { maxAge: PERSISTENT_MAX_AGE } : {}),
  };
}
