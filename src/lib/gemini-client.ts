// Módulo central de acesso à API do Gemini (Google AI Studio).
// Antes, cada arquivo de extração (os-extract, nota-fiscal-extract, cotacao-extract)
// tinha sua própria cópia de callGemini + busca de API key. Centralizado aqui pra:
// 1) corrigir em um lugar só quando algo mudar (ex: trocar de modelo)
// 2) adicionar retry para erros temporários do Gemini (ex: 503 "model overloaded")

export const GEMINI_MODEL = "gemini-3.5-flash-lite";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, depois 2s, depois 4s (backoff exponencial)

// Só faz sentido tentar de novo em erros que são "temporários" do lado do Google.
// 503 = servidor sobrecarregado (o erro do print). 429 = rate limit (limite de pedidos por minuto).
// Erros como 400 (prompt inválido) ou 401 (chave errada) nunca vão se resolver tentando de novo.
const RETRYABLE_STATUS = new Set([429, 503]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Busca a GEMINI_API_KEY tanto em runtime Cloudflare Workers (produção)
 * quanto em process.env (dev local). Lança erro claro se não achar.
 */
export async function getGeminiApiKey(): Promise<string> {
  let cfApiKey: string | undefined;
  try {
    const cfWorkers = (await import("cloudflare:workers")) as { env?: Record<string, string> };
    cfApiKey = cfWorkers.env?.GEMINI_API_KEY;
  } catch {
    // Não estamos rodando no runtime do Cloudflare Workers (ex: dev local) — ignora.
  }
  const apiKey = process.env.GEMINI_API_KEY || cfApiKey;
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente");
  return apiKey;
}

/**
 * Chama a API generateContent do Gemini, com retry automático (backoff exponencial)
 * para erros temporários (503 sobrecarregado, 429 rate limit).
 */
export async function callGemini(apiKey: string, body: unknown) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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

    if (res.ok) return res.json();

    const t = await res.text();
    lastError = new Error(`Gemini API ${res.status}: ${t.slice(0, 300)}`);

    const isRetryable = RETRYABLE_STATUS.has(res.status);
    const isLastAttempt = attempt === MAX_RETRIES;
    if (!isRetryable || isLastAttempt) throw lastError;

    // Backoff exponencial: espera 1s, depois 2s, depois 4s antes de tentar de novo.
    await sleep(BASE_DELAY_MS * 2 ** attempt);
  }

  // Inalcançável na prática (o loop sempre retorna ou lança antes), mas satisfaz o TypeScript.
  throw lastError ?? new Error("Falha desconhecida ao chamar Gemini API");
}
