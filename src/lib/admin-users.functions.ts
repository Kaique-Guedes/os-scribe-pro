import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  email: z.string().email(),
  nome: z.string().trim().optional(),
  role: z.enum(["admin", "pcp", "producao", "viewer"]).default("viewer"),
});

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    // 1) Autoriza: caller deve ser admin
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Apenas administradores podem convidar usuários.");

    // 2) Convida via Auth Admin API (envia e-mail de convite com magic link)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const redirectTo = process.env.SITE_URL
      ? `${process.env.SITE_URL}/auth`
      : undefined;

    const { data: invited, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: { nome: data.nome ?? data.email.split("@")[0] },
        redirectTo,
      });
    if (inviteErr) throw new Error(inviteErr.message);
    const newUserId = invited.user?.id;
    if (!newUserId) throw new Error("Convite enviado, mas usuário não retornado.");

    // 3) Define o papel escolhido (o trigger cria 'viewer' por padrão)
    if (data.role !== "viewer") {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUserId, role: data.role });
      if (rErr) throw new Error(rErr.message);
    }

    return { ok: true, userId: newUserId, email: data.email };
  });
