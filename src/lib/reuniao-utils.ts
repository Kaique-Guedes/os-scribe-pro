import type { Database } from "@/integrations/supabase/types";
import { OS_STATUS_LABEL, ETAPA_LABEL, formatDate, type OsStatus, type EtapaTipo } from "@/lib/os-utils";

export type ReuniaoTipo = Database["public"]["Enums"]["reuniao_tipo"];
export type ReuniaoStatus = Database["public"]["Enums"]["reuniao_status"];

export const REUNIAO_TIPO_LABEL: Record<ReuniaoTipo, string> = {
  individual: "Ata de uma O.S.",
  geral: "Ata Geral (várias O.S.)",
};

export const REUNIAO_STATUS_LABEL: Record<ReuniaoStatus, string> = {
  rascunho: "Rascunho",
  finalizada: "Finalizada",
};

export type Participante = { nome: string; cargo?: string };

export type PlanoAcaoItem = {
  acao: string;
  responsavel: string;
  prazo: string | null;
  status: "pendente" | "concluido" | "atrasado";
};

// Um "item" de O.S. dentro do snapshot — usado tanto na ata individual (1 item)
// quanto na ata geral (lista, 1 por O.S. puxada no momento da criação).
export type OsSnapshotItem = {
  os_id: string;
  numero_os: string;
  cliente_nome: string;
  projeto: string | null;
  status: OsStatus;
  data_entrega_prev: string | null;
  data_entrega_real: string | null;
  data_solicitacao_material: string | null;
  material_chegou: boolean;
  data_chegada_material: string | null;
};

type OsParaSnapshot = {
  id: string;
  numero_os: string;
  projeto: string | null;
  status: OsStatus;
  data_entrega_prev: string | null;
  data_entrega_real: string | null;
  clientes: { nome: string } | null;
};

type EtapaParaSnapshot = { os_id: string; tipo: EtapaTipo; data: string | null; status: "pendente" | "concluido" };

// Congela, no momento da criação da ata, os dados da O.S. que interessam pra
// reunião (prazo, se material já chegou etc.). Depois de criada, a ata não
// muda mais junto com a O.S. — ver comentário na migration 20260819120000.
export function buildOsSnapshotItem(os: OsParaSnapshot, etapas: EtapaParaSnapshot[]): OsSnapshotItem {
  const daOs = etapas.filter((e) => e.os_id === os.id);
  const solicitacao = daOs.find((e) => e.tipo === "solicitacao_material");
  const chegada = daOs.find((e) => e.tipo === "chegada_material");
  return {
    os_id: os.id,
    numero_os: os.numero_os,
    cliente_nome: os.clientes?.nome ?? "—",
    projeto: os.projeto,
    status: os.status,
    data_entrega_prev: os.data_entrega_prev,
    data_entrega_real: os.data_entrega_real,
    data_solicitacao_material: solicitacao?.data ?? null,
    material_chegou: chegada?.status === "concluido",
    data_chegada_material: chegada?.data ?? null,
  };
}

export function resumoMaterial(item: OsSnapshotItem): string {
  if (!item.data_solicitacao_material) return "Material ainda não solicitado";
  if (item.material_chegou) return `Material chegou em ${formatDate(item.data_chegada_material)}`;
  return `Solicitado em ${formatDate(item.data_solicitacao_material)}, ainda não chegou`;
}

export { OS_STATUS_LABEL, ETAPA_LABEL };
