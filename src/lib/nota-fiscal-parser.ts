import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export interface NotaFiscalExtracao {
  /** Data de emissão encontrada no PDF, no formato YYYY-MM-DD (para <input type="date">) */
  data: string | null;
  /** Valor total da nota, em número (ex: 1234.56) */
  valor: number | null;
  /** Número da nota fiscal, se encontrado */
  numero: string | null;
  /** Texto bruto extraído, útil para depuração/conferência manual */
  textoBruto: string;
  /** Indica se algo relevante foi encontrado */
  sucesso: boolean;
}

/** Extrai todo o texto de um PDF (todas as páginas), concatenado. */
async function extrairTextoPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let texto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return texto;
}

function parseValorBR(raw: string): number {
  // remove tudo que não for dígito, vírgula ou ponto
  const limpo = raw.replace(/[^\d.,]/g, "");
  // formato brasileiro: milhar com ponto, decimal com vírgula
  const semMilhar = limpo.replace(/\.(?=\d{3}(\D|$))/g, "");
  return parseFloat(semMilhar.replace(",", "."));
}

function paraISO(dia: string, mes: string, ano: string): string {
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
  return `${anoCompleto}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

/**
 * Tenta localizar a data de emissão e o valor total num texto de DANFE/NFe.
 * Cobre os rótulos mais comuns; como cada emissor formata de um jeito,
 * o resultado deve sempre ser revisado pelo usuário antes de salvar.
 */
export function extrairCamposNotaFiscal(
  texto: string,
): Omit<NotaFiscalExtracao, "textoBruto" | "sucesso"> {
  const normalizado = texto.replace(/\s+/g, " ");

  // ---- Valor total ----
  let valor: number | null = null;
  const padroesValor = [
    /VALOR\s+TOTAL\s+DA\s+NOTA\s*[:-]?\s*R?\$?\s*([\d.,]+)/i,
    /VALOR\s+TOTAL\s+DA\s+NF-?E?\s*[:-]?\s*R?\$?\s*([\d.,]+)/i,
    /V\.?\s*TOTAL\s+DA\s+NOTA\s*[:-]?\s*R?\$?\s*([\d.,]+)/i,
    /VALOR\s+TOTAL\s*[:-]?\s*R\$\s*([\d.,]+)/i,
  ];
  for (const re of padroesValor) {
    const m = normalizado.match(re);
    if (m) {
      valor = parseValorBR(m[1]);
      break;
    }
  }

  // ---- Data de emissão ----
  let data: string | null = null;
  const padroesData = [
    /DATA\s+DE\s+EMISS[ÃA]O\s*[:-]?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/i,
    /EMISS[ÃA]O\s*[:-]?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/i,
    /DATA\s+EMISS[ÃA]O\s*[:-]?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/i,
  ];
  for (const re of padroesData) {
    const m = normalizado.match(re);
    if (m) {
      data = paraISO(m[1], m[2], m[3]);
      break;
    }
  }
  // fallback: primeira data no formato dd/mm/aaaa do documento
  if (!data) {
    const m = normalizado.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
    if (m) data = paraISO(m[1], m[2], m[3]);
  }

  // ---- Número da nota ----
  let numero: string | null = null;
  const mNumero =
    normalizado.match(/N[ºO°]?\s*\.?\s*(\d{3,9})/i) ??
    normalizado.match(/N[ÚU]MERO\s*[:-]?\s*(\d{3,9})/i);
  if (mNumero) numero = mNumero[1];

  return { data, valor, numero };
}

/** Lê o arquivo PDF e retorna os campos extraídos + texto bruto. */
export async function processarNotaFiscalPdf(file: File): Promise<NotaFiscalExtracao> {
  try {
    const textoBruto = await extrairTextoPdf(file);
    const campos = extrairCamposNotaFiscal(textoBruto);
    return {
      ...campos,
      textoBruto,
      sucesso: campos.data != null || campos.valor != null,
    };
  } catch (e) {
    return { data: null, valor: null, numero: null, textoBruto: "", sucesso: false };
  }
}
