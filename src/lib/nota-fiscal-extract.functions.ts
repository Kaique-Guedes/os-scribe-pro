import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGemini, getGeminiApiKey } from "@/lib/gemini-client";

const Input = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  dataBase64: z.string().min(10),
});

export type ExtractedNotaFiscal = {
  numero_nota_fiscal: string | null;
  data_emissao: string | null;
  valor_total: number | null;
};

const SYSTEM_PROMPT = `Você é um assistente que extrai informações de Notas Fiscais eletrônicas (NF-e/DANFE) brasileiras para a empresa Sartori Group (usinagem e fabricação industrial).
Analise o documento anexado (pode ser a nota fiscal completa ou o DANFE) e retorne:
- numero_nota_fiscal: o número da nota fiscal (apenas os dígitos, sem série, sem pontuação).
- data_emissao: a data de emissão da nota, em formato ISO YYYY-MM-DD.
- valor_total: o valor total da nota (o "VALOR TOTAL DA NOTA" ou "VALOR TOTAL DA NF-e"), como número, sem "R$", com ponto como separador decimal.
Se um campo não estiver presente ou legível, retorne null. Não invente informação. Se o documento não parecer ser uma nota fiscal, retorne todos os campos como null.`;

export const extractNotaFiscalFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ExtractedNotaFiscal> => {
    const apiKey = await getGeminiApiKey();

    const schema = {
      type: "OBJECT",
      properties: {
        numero_nota_fiscal: { type: "STRING", nullable: true },
        data_emissao: { type: "STRING", nullable: true },
        valor_total: { type: "NUMBER", nullable: true },
      },
      required: ["numero_nota_fiscal", "data_emissao", "valor_total"],
    };

    const body = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: "Extraia o número, a data de emissão e o valor total desta nota fiscal." },
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
    let parsed: ExtractedNotaFiscal;
    try {
      parsed = typeof text === "string" ? JSON.parse(text) : text;
    } catch {
      throw new Error("A IA não retornou JSON válido");
    }
    return parsed;
  });
