import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Use inside Client Components only.
 * Reads and writes go through RLS as the signed-in user — never service-role here.
 *
 * Not typed against supabase/types.ts on purpose for now: hand-maintaining a
 * full Database type for every table fights the query builder more than it
 * helps at this stage. Swap in generated types anytime with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 * then add `<Database>` back here once the generated type covers every table.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
