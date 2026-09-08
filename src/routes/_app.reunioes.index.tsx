import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/use-auth";
import { canEdit, isAdmin } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users2, Search, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, OS_STATUS_LABEL } from "@/lib/os-utils";
import { REUNIAO_TIPO_LABEL, REUNIAO_STATUS_LABEL, buildOsSnapshotItem, type OsSnapshotItem } from "@/lib/reuniao-utils";

export const Route = createFileRoute("/_app/reunioes/")({
  head: () => ({ meta: [{ title: "Reunião — Sartori Group" }] }),
  component: ReunioesList,
});

function ReunioesList() {
  const { user } = useSession();
  const { data: roles = [] } = useRoles(user?.id);
  const podeCriar = canEdit(roles);
  const podeExcluir = isAdmin(roles);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"individual" | "geral">("individual");
  const [busca, setBusca] = useState("");
  const [osSelecionadaId, setOsSelecionadaId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");

  const { data: reunioes } = useQuery({
    queryKey: ["reunioes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reunioes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Lista de O.S. pra busca ao criar uma ata individual. Não precisa de
  // useQuery/cache elaborado — é só pra escolher, some quando o dialog fecha.
  // Trocado de "ordens_servico" pra "ordens_servico_com_acesso": a tabela crua
  // hoje só é lida por admin/pcp/producao, viewer/almoxarifado não conseguiriam
  // nem abrir o dialog de criar ata. Como a view não tem o embed "clientes(nome)"
  // do PostgREST, buscamos os clientes à parte e cruzamos abaixo, em `ordensComCliente`.
  const { data: ordensRaw } = useQuery({
    queryKey: ["ordens-para-reuniao"],
    enabled: open && tipo === "individual",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico_com_acesso")
        .select("id, numero_os, projeto, status, data_entrega_prev, data_entrega_real, cliente_id")
        .order("numero_os", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  const { data: clientesSimples } = useQuery({
    queryKey: ["clientes-simple"],
    enabled: open && tipo === "individual",
    queryFn: async () => (await supabase.from("clientes").select("id, nome").order("nome")).data ?? [],
  });

  const ordens = useMemo(() => {
    const clientesPorId = new Map((clientesSimples ?? []).map((c) => [c.id, c.nome]));
    return (ordensRaw ?? []).map((o) => ({
      ...o,
      clientes: clientesPorId.has(o.cliente_id) ? { nome: clientesPorId.get(o.cliente_id)! } : null,
    }));
  }, [ordensRaw, clientesSimples]);

  const ordensFiltradas = useMemo(() => {
    if (!ordens) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return ordens.slice(0, 30);
    return ordens.filter(
      (o) => o.numero_os.toLowerCase().includes(termo) || (o.clientes?.nome ?? "").toLowerCase().includes(termo)
    ).slice(0, 30);
  }, [ordens, busca]);

  const criar = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error("Dê um título pra ata.");

      if (tipo === "individual") {
        if (!osSelecionadaId) throw new Error("Selecione a O.S.");
        const os = ordens?.find((o) => o.id === osSelecionadaId);
        if (!os) throw new Error("O.S. não encontrada.");
        const { data: etapas, error: eErr } = await supabase
          .from("os_etapas").select("os_id, tipo, data, status").eq("os_id", os.id);
        if (eErr) throw eErr;
        const snapshot = buildOsSnapshotItem(os, etapas ?? []);
        const { data: inserted, error } = await supabase.from("reunioes").insert({
          tipo: "individual", os_id: os.id, titulo, dados_snapshot: snapshot as any,
        }).select("id").single();
        if (error) throw error;
        return inserted.id;
      }

      // Ata geral: puxa todas as O.S. exceto as já totalmente faturadas.
      // Mesma troca de tabela crua -> view mascarada, mas aqui buscamos os
      // clientes em paralelo (Promise.all) porque essa mutation pode rodar
      // sem o dialog "individual" ter aberto (aquela busca de clientes acima
      // só liga com enabled: tipo === "individual").
      const [{ data: todasOs, error: oErr }, { data: clientesData, error: cErr }] = await Promise.all([
        supabase
          .from("ordens_servico_com_acesso")
          .select("id, numero_os, projeto, status, data_entrega_prev, data_entrega_real, cliente_id")
          .neq("status", "faturado")
          .order("numero_os"),
        supabase.from("clientes").select("id, nome"),
      ]);
      if (oErr) throw oErr;
      if (cErr) throw cErr;
      const clientesPorIdGeral = new Map((clientesData ?? []).map((c) => [c.id, c.nome]));
      const todasOsComCliente = (todasOs ?? []).map((os) => ({
        ...os,
        clientes: clientesPorIdGeral.has(os.cliente_id) ? { nome: clientesPorIdGeral.get(os.cliente_id)! } : null,
      }));
      const { data: etapas, error: eErr } = await supabase.from("os_etapas").select("os_id, tipo, data, status");
      if (eErr) throw eErr;
      const itens: OsSnapshotItem[] = todasOsComCliente.map((os) => buildOsSnapshotItem(os, etapas ?? []));
      const { data: inserted, error } = await supabase.from("reunioes").insert({
        tipo: "geral", titulo, dados_snapshot: { itens } as any,
      }).select("id").single();
      if (error) throw error;
      return inserted.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["reunioes"] });
      setOpen(false);
      navigate({ to: "/reunioes/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (reuniaoId: string) => {
      const { error } = await supabase.from("reunioes").delete().eq("id", reuniaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reunioes"] });
      toast.success("Ata excluída.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users2 className="h-6 w-6 text-primary" />Reunião
          </h1>
          <p className="text-sm text-muted-foreground">Atas de reunião vinculadas às O.S.</p>
        </div>
        {podeCriar && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setBusca(""); setOsSelecionadaId(null); setTitulo(""); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Criar reunião</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nova ata de reunião</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Tabs value={tipo} onValueChange={(v) => { setTipo(v as any); setOsSelecionadaId(null); }}>
                  <TabsList className="w-full">
                    <TabsTrigger value="individual" className="flex-1">Uma O.S.</TabsTrigger>
                    <TabsTrigger value="geral" className="flex-1">Geral (várias O.S.)</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div>
                  <Label>Título da ata *</Label>
                  <Input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder={tipo === "individual" ? "Ex: Reunião de acompanhamento" : "Ex: Reunião geral de produção — semana 34"}
                  />
                </div>

                {tipo === "individual" && (
                  <div className="space-y-2">
                    <Label>Selecione a O.S. *</Label>
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                      <Input className="pl-8" placeholder="Buscar por número da O.S. ou cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} />
                    </div>
                    <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
                      {ordensFiltradas.length === 0 && <div className="p-3 text-sm text-muted-foreground">Nenhuma O.S. encontrada.</div>}
                      {ordensFiltradas.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setOsSelecionadaId(o.id)}
                          className={`w-full text-left p-3 text-sm hover:bg-muted transition-colors ${osSelecionadaId === o.id ? "bg-muted" : ""}`}
                        >
                          <div className="font-medium">{o.numero_os} — {o.clientes?.nome ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{OS_STATUS_LABEL[o.status]}{o.projeto ? ` · ${o.projeto}` : ""}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {tipo === "geral" && (
                  <p className="text-sm text-muted-foreground">
                    Essa ata vai puxar automaticamente todas as O.S. com status diferente de "Faturado".
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                  {criar.isPending ? "Criando…" : "Criar e abrir ata"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-3">
        {(reunioes ?? []).map((r) => {
          const snap = r.dados_snapshot as any;
          const subtitulo = r.tipo === "individual"
            ? `O.S. ${snap?.numero_os ?? "—"} — ${snap?.cliente_nome ?? "—"}`
            : `${snap?.itens?.length ?? 0} O.S. envolvidas`;
          return (
            <Card key={r.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate({ to: "/reunioes/$id", params: { id: r.id } })}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="font-medium">{r.titulo}</div>
                    <div className="text-xs text-muted-foreground">{subtitulo} · {formatDate(r.data_reuniao)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{REUNIAO_TIPO_LABEL[r.tipo]}</Badge>
                  <Badge variant={r.status === "finalizada" ? "default" : "secondary"}>{REUNIAO_STATUS_LABEL[r.status]}</Badge>
                  {podeExcluir && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir "{r.titulo}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {r.status === "finalizada"
                              ? "Essa ata já foi finalizada. Excluir remove o registro permanentemente, sem volta."
                              : "Isso remove o rascunho permanentemente."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => excluir.mutate(r.id)} className="bg-destructive hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {reunioes?.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma ata criada ainda.</p>}
      </div>
    </div>
  );
}
