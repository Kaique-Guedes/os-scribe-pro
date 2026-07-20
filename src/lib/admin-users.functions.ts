import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  email: z.string().email(),
  nome: z.string().trim().optional(),
  role: z.enum(["admin", "pcp", "producao", "viewer"]).default("viewer"),
  password: z.string().min(8).optional(),
});

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return out + "!9";
}

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    // Autoriza: caller deve ser admin
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Apenas administradores podem criar usuários.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const password = data.password ?? generatePassword();
    const nome = data.nome ?? data.email.split("@")[0];

    // Cria o usuário já confirmado (login imediato com a senha gerada)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });
    if (createErr) throw new Error(createErr.message);
    const newUserId = created.user?.id;
    if (!newUserId) throw new Error("Usuário não retornado após criação.");

    // Define o papel escolhido (trigger cria 'viewer' por padrão)
    if (data.role !== "viewer") {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUserId, role: data.role });
      if (rErr) throw new Error(rErr.message);
    }

    return { ok: true, userId: newUserId, email: data.email, password };
  });

const DeleteInput = z.object({ userId: z.string().uuid() });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeleteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Apenas administradores podem remover usuários.");
    if (data.userId === context.userId) throw new Error("Você não pode remover sua própria conta.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
