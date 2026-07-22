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
  name: "get_ordem_servico",
  title: "Detalhar ordem de serviço",
  description: "Retorna os detalhes completos de uma O.S., incluindo etapas, comentários e histórico.",
  inputSchema: { id: z.string().uuid().describe("ID (UUID) da ordem de serviço.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const client = sb(ctx);
    const [os, etapas, comentarios, historico] = await Promise.all([
      client.from("ordens_servico").select("*").eq("id", id).maybeSingle(),
      client.from("os_etapas").select("*").eq("os_id", id).order("created_at"),
      client.from("os_comentarios").select("*").eq("os_id", id).order("created_at"),
      client.from("os_historico").select("*").eq("os_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (os.error) return { content: [{ type: "text", text: os.error.message }], isError: true };
    if (!os.data) return { content: [{ type: "text", text: "O.S. não encontrada." }], isError: true };
    const payload = { ordem: os.data, etapas: etapas.data ?? [], comentarios: comentarios.data ?? [], historico: historico.data ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
