"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyRemember, isPersistent, REMEMBER_COOKIE, type CookieOptionsLike } from "@/lib/auth/remember";

let client: SupabaseClient | null = null;

function readCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined" || !document.cookie) return [];
  return document.cookie.split("; ").map((pair) => {
    const index = pair.indexOf("=");
    return { name: decodeURIComponent(pair.slice(0, index)), value: decodeURIComponent(pair.slice(index + 1)) };
  });
}

function writeCookie(name: string, value: string, options: CookieOptionsLike & { path?: string; domain?: string; sameSite?: string | boolean; secure?: boolean }) {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=${options.path ?? "/"}`;
  if (options.maxAge !== undefined) cookie += `; max-age=${options.maxAge}`;
  if (options.expires !== undefined) cookie += `; expires=${new Date(options.expires as string).toUTCString()}`;
  if (options.domain) cookie += `; domain=${options.domain}`;
  if (options.sameSite) cookie += `; samesite=${options.sameSite === true ? "strict" : options.sameSite}`;
  if (options.secure) cookie += "; secure";
  document.cookie = cookie;
}

/**
 * Browser Supabase client sharing the cookie session with the server. Token refreshes
 * honour the "Remember me" choice so a session-only login stays session-only.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");

  client = createBrowserClient(url, key, {
    cookies: {
      getAll: () => readCookies(),
      setAll: (toSet) => {
        const persistent = isPersistent(readCookies().find((c) => c.name === REMEMBER_COOKIE)?.value);
        for (const { name, value, options } of toSet) writeCookie(name, value, applyRemember(options as CookieOptionsLike, persistent));
      },
    },
  });
  return client;
}
