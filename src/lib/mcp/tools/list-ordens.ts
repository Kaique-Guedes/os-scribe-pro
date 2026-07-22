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
  name: "list_ordens_servico",
  title: "Listar ordens de serviço",
  description:
    "Lista ordens de serviço (O.S.) do usuário autenticado. Suporta filtro por status e busca textual em código/projeto.",
  inputSchema: {
    status: z
      .enum([
        "aberta",
        "aguardando_material",
        "em_producao",
        "em_pintura",
        "pronta",
        "entregue",
        "atrasada",
        "cancelada",
      ])
      .optional()
      .describe("Filtrar por status."),
    search: z.string().optional().describe("Texto para busca em código ou projeto."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de registros (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    let q = sb(ctx)
      .from("ordens_servico")
      .select("id, codigo, projeto, status, cliente_id, data_abertura, data_previsao_entrega, valor_total")
      .order("data_abertura", { ascending: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    if (search) q = q.or(`codigo.ilike.%${search}%,projeto.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { ordens: data ?? [] },
    };
  },
});
