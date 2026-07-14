import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/os-utils";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ["user_roles", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AppRole[]> => {
      if (!userId) return [];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

export function canEdit(roles: AppRole[]) {
  return roles.some((r) => r === "admin" || r === "pcp");
}
export function canUpdateStages(roles: AppRole[]) {
  return roles.some((r) => r === "admin" || r === "pcp" || r === "producao");
}
export function isAdmin(roles: AppRole[]) {
  return roles.includes("admin");
}
