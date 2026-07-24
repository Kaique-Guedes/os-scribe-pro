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

// Chama a API do Gemini diretamente (Google AI Studio), sem depender do gateway da Lovable.
// Requer a variável de ambiente GEMINI_API_KEY (gerada em https://aistudio.google.com/apikey).
const GEMINI_MODEL = "gemini-3.5-flash-lite";

async function callGemini(apiKey: string, body: unknown) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini API ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

export const extractOsFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ExtractedOs> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente");

    // Schema no formato aceito pela API nativa do Gemini (subconjunto de OpenAPI 3.0,
    // usa "nullable" em vez de union type com "null").
    const schema = {
      type: "OBJECT",
      properties: {
        numero_os: { type: "STRING", nullable: true },
        numero_ss: { type: "STRING", nullable: true },
        numero_pedido: { type: "STRING", nullable: true },
        projeto: { type: "STRING", nullable: true },
        cliente_nome: { type: "STRING", nullable: true },
        solicitante: { type: "STRING", nullable: true },
        gestor: { type: "STRING", nullable: true },
        orcamentista: { type: "STRING", nullable: true },
        data_inicio_prev: { type: "STRING", nullable: true },
        data_entrega_prev: { type: "STRING", nullable: true },
        unidade: { type: "STRING", nullable: true },
        quantidade: { type: "NUMBER", nullable: true },
        valor_unit: { type: "NUMBER", nullable: true },
        valor_total: { type: "NUMBER", nullable: true },
        peso_kg: { type: "NUMBER", nullable: true },
        local_entrega: { type: "STRING", nullable: true },
        tipo_frete: { type: "STRING", nullable: true },
        descricao: { type: "STRING", nullable: true },
        fora_escopo: { type: "STRING", nullable: true },
      },
      required: [
        "numero_os",
        "numero_ss",
        "numero_pedido",
        "projeto",
        "cliente_nome",
        "solicitante",
        "gestor",
        "orcamentista",
        "data_inicio_prev",
        "data_entrega_prev",
        "unidade",
        "quantidade",
        "valor_unit",
        "valor_total",
        "peso_kg",
        "local_entrega",
        "tipo_frete",
        "descricao",
        "fora_escopo",
      ],
    };

    const body = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: "Extraia os dados do documento anexo para preencher uma Ordem de Serviço." },
            {
              inlineData: {
                mimeType: data.mimeType,
                data: data.dataBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    };

    const json = await callGemini(apiKey, body);
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Resposta vazia da IA");
    let parsed: ExtractedOs;
    try {
      parsed = typeof text === "string" ? JSON.parse(text) : text;
    } catch {
      throw new Error("A IA não retornou JSON válido");
    }
    return parsed;
  });
