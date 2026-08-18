import type { Database } from "@/integrations/supabase/types";

export type OsStatus = Database["public"]["Enums"]["os_status"];
export type EtapaTipo = Database["public"]["Enums"]["etapa_tipo"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type MaterialCategoria = Database["public"]["Enums"]["material_categoria"];

export const OS_STATUS_LABEL: Record<OsStatus, string> = {
  aberta: "Aberta",
  aguardando_material: "Aguardando Material",
  em_producao: "Em Produção",
  em_pintura: "Em Pintura",
  pronta: "Pronta",
  entregue: "Entregue (não faturado)",
  faturado_parcialmente: "Faturado Parcialmente",
  faturado: "Faturado",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

export const OS_STATUS_LIST: OsStatus[] = [
  "aberta","aguardando_material","em_producao","em_pintura","pronta","entregue","faturado_parcialmente","faturado","atrasada","cancelada"
];

// Tailwind classes por status (usa tokens semânticos)
export const OS_STATUS_CLASS: Record<OsStatus, string> = {
  aberta: "bg-info/15 text-info border-info/30",
  aguardando_material: "bg-warning/15 text-warning-foreground border-warning/40",
  em_producao: "bg-primary/15 text-primary border-primary/30",
  em_pintura: "bg-accent text-accent-foreground border-accent",
  pronta: "bg-success/15 text-success border-success/30",
  entregue: "bg-muted text-muted-foreground border-border",
  faturado_parcialmente: "bg-warning/15 text-warning-foreground border-warning/40",
  faturado: "bg-success/15 text-success border-success/30",
  atrasada: "bg-destructive/15 text-destructive border-destructive/30",
  cancelada: "bg-muted text-muted-foreground border-border line-through",
};

export const ETAPA_LABEL: Record<EtapaTipo, string> = {
  abertura: "Abertura da O.S.",
  solicitacao_material: "Solicitação de Material",
  chegada_material: "Chegada do Material",
  pintura: "Subiu para Pintura",
  entrega: "Entrega Realizada",
};

export const ETAPA_ORDER: EtapaTipo[] = [
  "abertura","solicitacao_material","chegada_material","pintura","entrega"
];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  pcp: "PCP / Planejamento",
  producao: "Produção",
  viewer: "Visualizador",
  almoxarifado: "Almoxarifado",
};

export const MATERIAL_CATEGORIA_LABEL: Record<MaterialCategoria, string> = {
  longos: "Longos",
  planos: "Planos",
  fixadores: "Fixadores",
  acessorios: "Acessórios",
  consumo: "Consumo",
};

export const MATERIAL_CATEGORIA_LIST: MaterialCategoria[] = [
  "longos", "planos", "fixadores", "acessorios", "consumo"
];

// Etapas que o role 'almoxarifado' pode editar (usado em canEditEtapa, use-auth.ts)
export const ETAPAS_ALMOXARIFADO: EtapaTipo[] = ["solicitacao_material", "chegada_material"];

export function formatBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("pt-BR");
}

export function diffDays(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86400000);
}

// "faturado"/"faturado_parcialmente" vêm DEPOIS de "entregue" (mesma entrega, só
// que já com nota fiscal lançada) — então pra métricas de "foi entregue?" (prazo
// de entrega, lead time etc.) os três contam como entregue. Use isso em vez de
// checar só === "entregue", senão uma O.S. já faturada "some" das métricas de entrega.
export function foiEntregue(status: OsStatus) {
  return status === "entregue" || status === "faturado" || status === "faturado_parcialmente";
}

// Status que tiram a O.S. do "backlog em aberto" (carteira ativa, risco de atraso,
// próximas entregas etc.) — entregue/faturado/faturado_parcialmente/cancelada já
// não precisam de ação.
export function ehStatusFinalizado(status: OsStatus) {
  return foiEntregue(status) || status === "cancelada";
}

// Decide o status de faturamento a partir do valor já faturado (soma das notas
// fiscais) comparado ao valor do contrato (valor_total da O.S.):
// - nada faturado (0)              -> "entregue" (entregue, não faturado)
// - faturado < valor do contrato   -> "faturado_parcialmente"
// - faturado >= valor do contrato  -> "faturado"
// Usado toda vez que uma nota fiscal é lançada ou removida.
export function statusPorFaturamento(totalFaturado: number, valorTotal: number): OsStatus {
  if (totalFaturado <= 0) return "entregue";
  if (valorTotal > 0 && totalFaturado >= valorTotal) return "faturado";
  return "faturado_parcialmente";
}

export function isAtrasada(prev: string | null, real: string | null, status: OsStatus) {
  if (ehStatusFinalizado(status)) return false;
  if (!prev) return false;
  const today = new Date().toISOString().slice(0,10);
  const compareDate = real ?? today;
  return compareDate > prev;
}
