"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Renders nothing — just subscribes to postgres_changes on the given tables
 * and re-fetches the current route's Server Component data whenever a row
 * changes. Supabase Realtime enforces RLS per-connection, so this only ever
 * sees changes the signed-in user is allowed to read.
 */
export function RealtimeRefresher({ tables, channel }: { tables: string[]; channel: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(channel);

    for (const table of tables) {
      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => router.refresh()
      );
    }

    ch.subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  return null;
}
