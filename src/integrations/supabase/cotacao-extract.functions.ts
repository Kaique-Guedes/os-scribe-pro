import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  dataBase64: z.string().min(10),
});

export type ExtractedCotacaoItem = {
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
};

export type ExtractedCotacao = {
  numero_pedido: string | null;
  data: string | null;
  observacao: string | null;
  valor_liquido: number | null;
  itens: ExtractedCotacaoItem[];
};

// Modelo próprio da Sartori: documento "PEDIDO DE" com tabela PRODUTOS/SERVIÇOS
// (colunas: CÓDIGO, DESCRIÇÃO, UN, QTD, VLR, VLR TOT, DESC, VLR LIQ), campo OBSERVAÇÃO e bloco TOTAIS.
const SYSTEM_PROMPT = `Você é um assistente que extrai informações de documentos "PEDIDO DE" (cotação/pedido de material) no modelo interno da empresa Sartori Group (usinagem e fabricação industrial).
O documento tem uma tabela "PRODUTOS / SERVIÇOS" com colunas CÓDIGO, DESCRIÇÃO, UN, QTD, VLR, VLR TOT, DESC, VLR LIQ, um campo "OBSERVAÇÃO" e um bloco "TOTAIS" com "VALOR LIQUIDO".
Retorne:
- numero_pedido: o número do pedido (campo "NÚMERO"), como string, apenas dígitos.
- data: a data do documento (campo "DATA"), em formato ISO YYYY-MM-DD.
- observacao: o texto do campo "OBSERVAÇÃO", ou null se vazio.
- valor_liquido: o valor de "VALOR LIQUIDO" em TOTAIS, como número, sem "R$", ponto como separador decimal.
- itens: uma lista com cada linha da tabela de produtos, cada uma com:
  - codigo: o valor da coluna CÓDIGO (string), ou null se não houver.
  - descricao: o valor da coluna DESCRIÇÃO.
  - unidade: o valor da coluna UN (ex: "UN", "PC", "KG"), ou null.
  - quantidade: o valor da coluna QTD, como número (use ponto decimal).
Se a mesma descrição/código aparecer em mais de uma linha (ex: mesmo produto com quantidades diferentes), NÃO agrupe — retorne cada linha da tabela como um item separado, exatamente como está impressa.
Se um campo não estiver presente ou legível, retorne null nesse campo. Não invente informação. Se o documento não parecer ser um "PEDIDO DE" desse modelo, retorne itens como lista vazia e os demais campos como null.`;

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

export const extractCotacaoFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ExtractedCotacao> => {
    let cfApiKey: string | undefined;
    try {
      const cfWorkers = (await import("cloudflare:workers")) as { env?: Record<string, string> };
      cfApiKey = cfWorkers.env?.GEMINI_API_KEY;
    } catch {
      // Não estamos rodando no runtime do Cloudflare Workers (ex: dev local) — ignora.
    }
    const apiKey = process.env.GEMINI_API_KEY || cfApiKey;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente");

    const schema = {
      type: "OBJECT",
      properties: {
        numero_pedido: { type: "STRING", nullable: true },
        data: { type: "STRING", nullable: true },
        observacao: { type: "STRING", nullable: true },
        valor_liquido: { type: "NUMBER", nullable: true },
        itens: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              codigo: { type: "STRING", nullable: true },
              descricao: { type: "STRING" },
              unidade: { type: "STRING", nullable: true },
              quantidade: { type: "NUMBER" },
            },
            required: ["descricao", "quantidade"],
          },
        },
      },
      required: ["numero_pedido", "data", "observacao", "valor_liquido", "itens"],
    };

    const body = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: "Extraia os dados e a lista de itens deste pedido de cotação de material." },
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
    let parsed: ExtractedCotacao;
    try {
      parsed = typeof text === "string" ? JSON.parse(text) : text;
    } catch {
      throw new Error("A IA não retornou JSON válido");
    }
    return parsed;
  });
