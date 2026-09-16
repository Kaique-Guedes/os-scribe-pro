import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  OS_STATUS_LABEL,
  OS_STATUS_LIST,
  formatDate,
  isAtrasada,
  type OsStatus,
} from "@/lib/os-utils";
import { useSession, useRoles, canUpdateStages } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/producao/acompanhamento")({
  head: () => ({ meta: [{ title: "Acompanhamento de Produção — Sartori Group" }] }),
  component: AcompanhamentoProducaoPage,
});

// As duas únicas linhas que essa tela acompanha. "Atrasada" NÃO entra aqui
// porque não é um valor gravado em ordens_servico.status — é calculado na
// hora por isAtrasada() e vira só um selo em cima do status real (ver mais
// abaixo). Confirmado com o usuário: atraso só importa aqui dentro desses
// 2 status, não em qualquer O.S. atrasada do sistema.
const STATUS_ACOMPANHADOS: OsStatus[] = ["em_producao", "faturado_parcialmente"];

// Próximos status que fazem sentido oferecer a partir daqui. Deixei de fora
// "atrasada" (calculado, nunca gravado) e "cancelada" (cancelamento tem fluxo
// próprio na tela de detalhe da O.S., não deveria acontecer no meio do chão de
// fábrica sem contexto).
const PROXIMOS_STATUS: OsStatus[] = OS_STATUS_LIST.filter(
  (s) => s !== "atrasada" && s !== "cancelada",
);

type FiltroStatus = "todos" | "em_producao" | "faturado_parcialmente" | "atrasada";

const FILTROS: { valor: FiltroStatus; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "em_producao", label: "Em produção" },
  { valor: "faturado_parcialmente", label: "Faturado parcial" },
  { valor: "atrasada", label: "Atrasada" },
];

type OrdemRow = {
  id: string;
  numero_os: string;
  cliente_id: string | null;
  status: OsStatus;
  data_entrega_prev: string | null;
  data_entrega_real: string | null;
};

type AcompanhamentoRow = {
  id: string;
  os_id: string;
  observacao: string | null;
  status_anterior: OsStatus | null;
  status_novo: OsStatus | null;
  criado_em: string;
};

function AcompanhamentoProducaoPage() {
  const { user } = useSession();
  const { data: roles = [] } = useRoles(user?.id);
  const podeAcessar = canUpdateStages(roles);
  const queryClient = useQueryClient();

  const [filtro, setFiltro] = useState<FiltroStatus>("todos");
  // Rascunho por O.S. — texto ainda não salvo + status escolhido no <Select>.
  // "" no status significa "manter o status atual".
  const [rascunhos, setRascunhos] = useState<Record<string, { observacao: string; status: OsStatus | "" }>>(
    {},
  );

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-nomes"],
    queryFn: async () => (await supabase.from("clientes").select("id, nome")).data ?? [],
    enabled: podeAcessar,
  });

  // View mascarada em vez da tabela crua: mesma regra de segurança já usada
  // no resto do projeto (ver ordens_servico_com_acesso). Aqui nem usamos as
  // colunas financeiras, mas a tabela crua nega SELECT pra quem não é
  // admin/pcp/producao — teria que ser a view de qualquer forma.
  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ["acompanhamento-ordens"],
    queryFn: async (): Promise<OrdemRow[]> => {
      const { data, error } = await supabase
        .from("ordens_servico_com_acesso")
        .select("id, numero_os, cliente_id, status, data_entrega_prev, data_entrega_real")
        .in("status", STATUS_ACOMPANHADOS)
        .order("data_entrega_prev", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: podeAcessar,
  });

  const osIds = ordens.map((o) => o.id);

  const { data: historico = [] } = useQuery({
    queryKey: ["acompanhamento-historico", osIds],
    queryFn: async (): Promise<AcompanhamentoRow[]> => {
      if (osIds.length === 0) return [];
      const { data, error } = await supabase
        .from("os_acompanhamento_producao")
        .select("id, os_id, observacao, status_anterior, status_novo, criado_em")
        .in("os_id", osIds)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: podeAcessar && osIds.length > 0,
  });

  const salvar = useMutation({
    mutationFn: async ({ os, observacao, novoStatus }: { os: OrdemRow; observacao: string; novoStatus: OsStatus | "" }) => {
      if (!user) throw new Error("Sem usuário logado");
      const statusFinal = novoStatus || os.status;

      const { error: erroInsert } = await supabase.from("os_acompanhamento_producao").insert({
        os_id: os.id,
        observacao: observacao || null,
        status_anterior: os.status,
        status_novo: statusFinal,
        criado_por: user.id,
      });
      if (erroInsert) throw erroInsert;

      // Update direto na tabela crua, sem passar pela lógica de etapas de
      // _app.ordens.$id.tsx (é proposital — ver conversa com o professor:
      // essa tela é pra registro rápido, não pra reabrir a timeline inteira).
      // Efeito colateral conhecido: mudar pra "entregue"/"faturado..." por
      // aqui NÃO preenche data_entrega_real automaticamente, diferente do
      // fluxo manual da timeline ou do lançamento de nota fiscal.
      if (statusFinal !== os.status) {
        const { error: erroUpdate } = await supabase
          .from("ordens_servico")
          .update({ status: statusFinal })
          .eq("id", os.id);
        if (erroUpdate) throw erroUpdate;
      }
    },
    onSuccess: (_data, { os }) => {
      setRascunhos((prev) => ({ ...prev, [os.id]: { observacao: "", status: "" } }));
      queryClient.invalidateQueries({ queryKey: ["acompanhamento-ordens"] });
      queryClient.invalidateQueries({ queryKey: ["acompanhamento-historico"] });
    },
  });

  if (!podeAcessar) {
    return <p className="p-6 text-sm text-muted-foreground">Você não tem acesso a esta tela.</p>;
  }
  if (isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando...</p>;
  }

  const clientesPorId = new Map(clientes.map((c) => [c.id, c.nome]));
  const historicoPorOs = new Map<string, AcompanhamentoRow[]>();
  for (const h of historico) {
    const lista = historicoPorOs.get(h.os_id) ?? [];
    lista.push(h);
    historicoPorOs.set(h.os_id, lista);
  }

  const ordensComAtraso = ordens.map((os) => ({
    ...os,
    atrasada: isAtrasada(os.data_entrega_prev, os.data_entrega_real, os.status),
  }));

  const ordensFiltradas = ordensComAtraso.filter((os) => {
    if (filtro === "todos") return true;
    if (filtro === "atrasada") return os.atrasada;
    return os.status === filtro;
  });

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-medium">Acompanhamento de produção</h1>
        <p className="text-sm text-muted-foreground">{formatDate(new Date().toISOString())}</p>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {FILTROS.map((f) => (
          <Button
            key={f.valor}
            variant={filtro === f.valor ? "default" : "outline"}
            size="sm"
            className={f.valor === "atrasada" && filtro !== f.valor ? "text-destructive border-destructive/40" : ""}
            onClick={() => setFiltro(f.valor)}
          >
            {f.valor === "atrasada" && <AlertTriangle className="h-3.5 w-3.5 mr-1" />}
            {f.label}
          </Button>
        ))}
      </div>

      {ordensFiltradas.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma O.S. nesse filtro.</p>
      )}

      {ordensFiltradas.map((os) => {
        const historicoOs = historicoPorOs.get(os.id) ?? [];
        const rascunho = rascunhos[os.id] ?? { observacao: "", status: "" as OsStatus | "" };
        const salvando = salvar.isPending && salvar.variables?.os.id === os.id;

        return (
          <Card key={os.id} className={os.atrasada ? "border-destructive/40" : undefined}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">O.S. {os.numero_os}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {clientesPorId.get(os.cliente_id ?? "") ?? "—"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary">{OS_STATUS_LABEL[os.status]}</Badge>
                  {os.atrasada && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      atrasada
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {historicoOs.length > 0 ? (
                <div className="space-y-1 border-t pt-2">
                  {historicoOs.slice(0, 3).map((h) => (
                    <p key={h.id} className="text-sm text-muted-foreground">
                      <span className="text-muted-foreground/70">
                        {new Date(h.criado_em).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                      </span>
                      {h.observacao ?? (
                        <em>status alterado{h.status_novo ? ` para ${OS_STATUS_LABEL[h.status_novo]}` : ""}</em>
                      )}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sem observação registrada ainda.</p>
              )}

              <Textarea
                placeholder="Nova observação de hoje..."
                rows={2}
                value={rascunho.observacao}
                onChange={(e) =>
                  setRascunhos((prev) => ({ ...prev, [os.id]: { ...rascunho, observacao: e.target.value } }))
                }
              />

              <div className="flex gap-2">
                <Select
                  value={rascunho.status}
                  onValueChange={(value) =>
                    setRascunhos((prev) => ({ ...prev, [os.id]: { ...rascunho, status: value as OsStatus } }))
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Manter status" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROXIMOS_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {OS_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={salvando || (!rascunho.observacao.trim() && !rascunho.status)}
                  onClick={() => salvar.mutate({ os, observacao: rascunho.observacao.trim(), novoStatus: rascunho.status })}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {salvando ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
