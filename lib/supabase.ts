"use client";

import { AuthClient, type GoTrueClient } from "@supabase/auth-js";
import { PostgrestClient } from "@supabase/postgrest-js";

// The app only uses Supabase Auth and the REST API. supabase-js's createClient
// also bundles the Realtime, Storage and Functions clients into every page, so
// this wires the same two sub-clients the way createClient does: same session
// storage key, auth defaults, and per-request access token.
export type SupabaseClient = {
  auth: GoTrueClient;
  from: PostgrestClient["from"];
};

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (client) {
    return client;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
    );
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(url.endsWith("/") ? url : `${url}/`);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  }

  const auth = new AuthClient({
    url: new URL("auth/v1", baseUrl).href,
    headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
    storageKey: `sb-${baseUrl.hostname.split(".")[0]}-auth-token`,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: "implicit",
  });

  const fetchWithAuth: typeof fetch = async (input, init) => {
    const { data } = await auth.getSession();
    const headers = new Headers(init?.headers);
    if (!headers.has("apikey")) {
      headers.set("apikey", anonKey);
    }
    if (!headers.has("Authorization")) {
      headers.set(
        "Authorization",
        `Bearer ${data.session?.access_token ?? anonKey}`,
      );
    }
    return fetch(input, { ...init, headers });
  };

  const rest = new PostgrestClient(new URL("rest/v1", baseUrl).href, {
    schema: "public",
    fetch: fetchWithAuth,
  });

  client = { auth, from: rest.from.bind(rest) };
  return client;
}
