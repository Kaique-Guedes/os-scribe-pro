// Só pode ser importado por código server-side (*.server.ts ou dentro de handlers
// de createServerFn) — nunca no bundle do cliente, pois usa a service role key.

export async function resolveEnv(key: string): Promise<string | undefined> {
  if (process.env[key]) return process.env[key];
  try {
    const cfWorkers = (await import("cloudflare:workers")) as { env?: Record<string, string> };
    return cfWorkers.env?.[key];
  } catch {
    return undefined;
  }
}

export async function enviarEmail(opts: { to: string[]; subject: string; html: string }) {
  const resendKey = await resolveEnv("RESEND_API_KEY");
  if (!resendKey) {
    console.warn("[email] RESEND_API_KEY ausente — e-mail não enviado:", opts.subject);
    return;
  }
  if (opts.to.length === 0) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Sartori O.S. <notificacoes@flowguedes.com.br>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend API ${res.status}: ${t.slice(0, 300)}`);
  }
}

// Busca e-mails de todo mundo que tem um dos roles passados (admin, pcp, etc).
// Usa o client admin porque só admin/pcp tem SELECT liberado em user_roles de
// outras pessoas via RLS.
export async function emailsPorRoles(roles: string[]): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userRoles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("role", roles);
  const userIds = [...new Set((userRoles ?? []).map((r) => r.user_id))];
  if (userIds.length === 0) return [];

  const { data: perfis } = await supabaseAdmin.from("profiles").select("email").in("id", userIds);
  return (perfis ?? []).map((p) => p.email).filter((e): e is string => !!e);
}
