import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for Server Components, Server Actions, and Route Handlers.
 * Still runs as the signed-in user (RLS applies) — this is NOT the service-role client.
 *
 * See the note in client.ts — deliberately untyped against Database for now.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // setAll called from a Server Component with no writable response — safe to ignore,
            // middleware refreshes the session cookie on every request instead.
          }
        },
      },
    }
  );
}
