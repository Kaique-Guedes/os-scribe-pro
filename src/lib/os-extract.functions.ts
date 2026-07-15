import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  dataBase64: z.string().min(10),
});

export type ExtractedOs = {
  numero_os: string | null;
  numero_ss: string | null;
  numero_pedido: string | null;
  projeto: string | null;
  cliente_nome: string | null;
  solicitante: string | null;
  gestor: string | null;
  orcamentista: string | null;
  data_inicio_prev: string | null;
  data_entrega_prev: string | null;
  unidade: string | null;
  quantidade: number | null;
  valor_unit: number | null;
  valor_total: number | null;
  peso_kg: number | null;
  local_entrega: string | null;
  tipo_frete: string | null;
  descricao: string | null;
  fora_escopo: string | null;
};

const SYSTEM_PROMPT = `Você é um assistente que extrai informações de pedidos, orçamentos e ordens de serviço para a empresa Sartori Group (usinagem e fabricação industrial).
Analise o documento anexado e retorne os dados estruturados. Se um campo não estiver presente, retorne null.
Datas devem estar em formato ISO YYYY-MM-DD. Valores monetários devem ser números em reais (sem R$, ponto como separador decimal). Não invente informação.`;

async function callGateway(apiKey: string, body: unknown) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

export const extractOsFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ExtractedOs> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const dataUrl = `data:${data.mimeType};base64,${data.dataBase64}`;
    const isImage = data.mimeType.startsWith("image/");

    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: "Extraia os dados do documento anexo para preencher uma Ordem de Serviço.",
      },
    ];
    if (isImage) {
      userContent.push({ type: "image_url", image_url: { url: dataUrl } });
    } else {
      userContent.push({
        type: "file",
        file: { filename: data.filename, file_data: dataUrl },
      });
    }

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        numero_os: { type: ["string", "null"] },
        numero_ss: { type: ["string", "null"] },
        numero_pedido: { type: ["string", "null"] },
        projeto: { type: ["string", "null"] },
        cliente_nome: { type: ["string", "null"] },
        solicitante: { type: ["string", "null"] },
        gestor: { type: ["string", "null"] },
        orcamentista: { type: ["string", "null"] },
        data_inicio_prev: { type: ["string", "null"] },
        data_entrega_prev: { type: ["string", "null"] },
        unidade: { type: ["string", "null"] },
        quantidade: { type: ["number", "null"] },
        valor_unit: { type: ["number", "null"] },
        valor_total: { type: ["number", "null"] },
        peso_kg: { type: ["number", "null"] },
        local_entrega: { type: ["string", "null"] },
        tipo_frete: { type: ["string", "null"] },
        descricao: { type: ["string", "null"] },
        fora_escopo: { type: ["string", "null"] },
      },
      required: [
        "numero_os","numero_ss","numero_pedido","projeto","cliente_nome",
        "solicitante","gestor","orcamentista","data_inicio_prev","data_entrega_prev",
        "unidade","quantidade","valor_unit","valor_total","peso_kg",
        "local_entrega","tipo_frete","descricao","fora_escopo",
      ],
    };

    const body = {
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "ordem_servico", strict: true, schema },
      },
    };

    const json = await callGateway(apiKey, body);
    const text = json?.choices?.[0]?.message?.content;
    if (!text) throw new Error("Resposta vazia da IA");
    let parsed: ExtractedOs;
    try {
      parsed = typeof text === "string" ? JSON.parse(text) : text;
    } catch {
      throw new Error("A IA não retornou JSON válido");
    }
    return parsed;
  });
