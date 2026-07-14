import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ETAPA_LABEL, ETAPA_ORDER, OS_STATUS_CLASS, OS_STATUS_LABEL, formatDate, type EtapaTipo, type OsStatus } from "@/lib/os-utils";

export const Route = createFileRoute("/_app/producao")({
  head: () => ({ meta: [{ title: "Produção — Sartori Group" }] }),
  component: ProducaoPage,
});

function ProducaoPage() {
  const { data } = useQuery({
    queryKey: ["producao-etapas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("os_etapas")
        .select("*, ordens_servico(id, numero_os, status, clientes(nome))")
        .eq("status", "pendente");
      if (error) throw error;
      return data ?? [];
    },
  });

  const groups: Record<EtapaTipo, typeof data> = {
    abertura: [], solicitacao_material: [], chegada_material: [], pintura: [], entrega: [],
  };
  (data ?? []).forEach(e => { groups[e.tipo].push(e); });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Acompanhamento de produção</h1>
        <p className="text-sm text-muted-foreground">Etapas pendentes agrupadas por marco de produção.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {ETAPA_ORDER.map(tipo => (
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
