import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileEdit, PackageSearch, Truck, PaintBucket, Send, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ETAPA_LABEL,
  ETAPA_ORDER,
  ETAPAS_ALMOXARIFADO,
  OS_STATUS_CLASS,
  OS_STATUS_LABEL,
  formatDate,
  formatBRL,
  diffDays,
  type EtapaTipo,
  type OsStatus,
} from "@/lib/os-utils";
import { useSession, useRoles, isOnlyAlmoxarifado } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/producao")({
  head: () => ({ meta: [{ title: "Produção — Sartori Group" }] }),
  component: ProducaoPage,
});

// Ícone por etapa — ajuda a reconhecer a coluna de relance, sem precisar ler o texto.
const ETAPA_ICON: Record<EtapaTipo, React.ComponentType<{ className?: string }>> = {
  abertura: FileEdit,
  solicitacao_material: PackageSearch,
  chegada_material: Truck,
  pintura: PaintBucket,
  entrega: Send,
};

function ProducaoPage() {
  const { user } = useSession();
  const { data: roles = [] } = useRoles(user?.id);
  // Almoxarifado só acompanha as 2 etapas que ele mexe — o resto do fluxo
  // (pintura, entrega) não é da alçada dele, então nem mostramos a coluna.
  const restrito = isOnlyAlmoxarifado(roles);
  const colunasVisiveis = restrito ? ETAPAS_ALMOXARIFADO : ETAPA_ORDER;

  const { data } = useQuery({
    queryKey: ["producao-etapas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("os_etapas")
        .select("*, ordens_servico(id, numero_os, status, valor_total, data_entrega_prev, clientes(nome))")
        .eq("status", "pendente");
      if (error) throw error;
      return data ?? [];
    },
  });

  type Row = NonNullable<typeof data>[number];
  const groups: Record<EtapaTipo, Row[]> = {
    abertura: [], solicitacao_material: [], chegada_material: [], pintura: [], entrega: [],
  };
  (data ?? []).forEach((e) => { groups[e.tipo as EtapaTipo].push(e); });

  const hoje = new Date().toISOString().slice(0, 10);
  // Urgência: quanto falta (ou quanto já passou) até o prazo previsto. Usado
  // pra ordenar cada coluna com o mais urgente no topo e pra colorir a borda do card.
  const diasAte = (r: Row) => diffDays(hoje, r.ordens_servico?.data_entrega_prev ?? null);

  // Layout simples (o que já existia) — mantido pro almoxarifado, sem mudança.
  if (restrito) {
    return (
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Acompanhamento de produção</h1>
          <p className="text-sm text-muted-foreground">Etapas pendentes agrupadas por marco de produção.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {colunasVisiveis.map(tipo => (
            <Card key={tipo} className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{ETAPA_LABEL[tipo]}</CardTitle>
                <div className="text-xs text-muted-foreground">{groups[tipo].length} pendentes</div>
              </CardHeader>
              <CardContent className="space-y-2 flex-1">
                {groups[tipo].length === 0 && <p className="text-xs text-muted-foreground">Nenhuma pendência.</p>}
                {groups[tipo].map(e => {
                  const os = e.ordens_servico;
                  if (!os) return null;
                  return (
                    <Link key={e.id} to="/ordens/$id" params={{ id: os.id }} className="block rounded-md border p-2.5 hover:border-primary/50 hover:bg-accent transition">
                      <div className="text-sm font-medium">{os.numero_os}</div>
                      <div className="text-xs text-muted-foreground truncate">{os.clientes?.nome ?? "—"}</div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <Badge variant="outline" className={`text-[10px] ${OS_STATUS_CLASS[os.status as OsStatus]}`}>{OS_STATUS_LABEL[os.status as OsStatus]}</Badge>
                        <span className="text-[10px] text-muted-foreground">{e.data ? formatDate(e.data) : "sem data"}</span>
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Layout novo — pipeline visual, ordenado por urgência, com valor parado em cada etapa.
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Acompanhamento de produção</h1>
        <p className="text-sm text-muted-foreground">
          Fluxo das O.S. pelas 5 etapas — mais urgente primeiro em cada coluna.
        </p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {colunasVisiveis.map((tipo, i) => {
          const Icon = ETAPA_ICON[tipo];
          const itens = [...groups[tipo]].sort((a, b) => {
            const da = diasAte(a) ?? Infinity;
            const db = diasAte(b) ?? Infinity;
            return da - db;
          });
          const valorNaEtapa = itens.reduce((sum, e) => sum + (e.ordens_servico?.valor_total ?? 0), 0);
          const atrasadas = itens.filter((e) => (diasAte(e) ?? 0) < 0).length;

          return (
            <div key={tipo} className="flex items-stretch shrink-0">
              <Card className="w-72 flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {ETAPA_LABEL[tipo]}
                  </CardTitle>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {itens.length} pendente{itens.length === 1 ? "" : "s"}
                      {atrasadas > 0 && (
                        <span className="text-destructive font-medium"> · {atrasadas} atrasada{atrasadas === 1 ? "" : "s"}</span>
                      )}
                    </span>
                  </div>
                  {valorNaEtapa > 0 && (
                    <div className="text-xs font-medium text-foreground">{formatBRL(valorNaEtapa)} parado aqui</div>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 flex-1 max-h-[60vh] overflow-y-auto">
                  {itens.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma pendência.</p>}
                  {itens.map((e) => {
                    const os = e.ordens_servico;
                    if (!os) return null;
                    const dias = diasAte(e);
                    const atrasada = dias != null && dias < 0;
                    const proximo = dias != null && dias >= 0 && dias <= 3;
                    return (
                      <Link
                        key={e.id}
                        to="/ordens/$id"
                        params={{ id: os.id }}
                        className={`block rounded-md border-l-4 border p-2.5 hover:bg-accent transition ${
                          atrasada
                            ? "border-l-destructive bg-destructive/5"
                            : proximo
                            ? "border-l-warning bg-warning/5"
                            : "border-l-border"
                        }`}
                      >
                        <div className="text-sm font-medium">{os.numero_os}</div>
                        <div className="text-xs text-muted-foreground truncate">{os.clientes?.nome ?? "—"}</div>
                        <div className="mt-1.5 flex items-center justify-between gap-1">
                          <Badge variant="outline" className={`text-[10px] ${OS_STATUS_CLASS[os.status as OsStatus]}`}>
                            {OS_STATUS_LABEL[os.status as OsStatus]}
                          </Badge>
                          {dias != null ? (
                            <span className={`text-[10px] flex items-center gap-0.5 ${atrasada ? "text-destructive font-medium" : proximo ? "text-warning-foreground font-medium" : "text-muted-foreground"}`}>
                              {atrasada && <AlertTriangle className="h-2.5 w-2.5" />}
                              {atrasada ? `${Math.abs(dias)}d atrasado` : dias === 0 ? "prazo hoje" : `${dias}d restantes`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">sem prazo</span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>

              {i < colunasVisiveis.length - 1 && (
                <div className="flex items-center px-1 text-muted-foreground/40">
                  <ChevronRight className="h-5 w-5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
