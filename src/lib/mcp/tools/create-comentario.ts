import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "add_comentario_os",
  title: "Comentar em uma O.S.",
  description: "Adiciona um comentário a uma ordem de serviço em nome do usuário autenticado.",
  inputSchema: {
    os_id: z.string().uuid().describe("ID da ordem de serviço."),
    texto: z.string().trim().min(1).describe("Conteúdo do comentário."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ os_id, texto }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const { data, error } = await sb(ctx)
      .from("os_comentarios")
      .insert({ os_id, texto, user_id: ctx.getUserId() })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Comentário adicionado (id ${data.id}).` }],
      structuredContent: { comentario: data },
    };
  },
});
