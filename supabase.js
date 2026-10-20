"use client";
import { createClient } from "@supabase/supabase-js";

let client = null;

export function sb() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }
    );
  }
  return client;
}

export async function accessToken() {
  const { data } = await sb().auth.getSession();
  return data.session?.access_token || "";
}
