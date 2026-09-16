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
import { formatDate, OS_STATUS_LABEL, OS_STATUS_LIST, type OsStatus } from "@/lib/os-utils";
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
  // Ata geral: por padrão entram todos os status, menos "Faturado" (mesmo
  // comportamento de antes). O usuário pode religar/desligar cada status aqui.
  const [statusFiltro, setStatusFiltro] = useState<OsStatus[]>(OS_STATUS_LIST.filter((s) => s !== "faturado"));
  // Guarda só quem foi TIRADO da seleção (em vez de quem foi marcado) — assim,
  // por padrão, toda O.S. que passa no filtro de status já entra na ata.
  const [excluidasGeral, setExcluidasGeral] = useState<Set<string>>(new Set());

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
    enabled: open,
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
    enabled: open,
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

  // Ata geral: mesma busca por texto, mas cruzada com o filtro de status —
  // sem o limite de 30, porque aqui é pra revisar/desmarcar a lista toda antes
  // de gerar a ata, não só escolher uma.
  const ordensGeralFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return ordens.filter((o) => statusFiltro.includes(o.status)).filter(
      (o) => !termo || o.numero_os.toLowerCase().includes(termo) || (o.clientes?.nome ?? "").toLowerCase().includes(termo)
    );
  }, [ordens, statusFiltro, busca]);

  // Conjunto que realmente vai pra ata: todo status filtrado, menos quem foi
  // desmarcado manualmente — independe da busca (a busca só esconde da tela,
  // não tira da seleção).
  const osGeralIncluidas = useMemo(
    () => ordens.filter((o) => statusFiltro.includes(o.status) && !excluidasGeral.has(o.id)),
    [ordens, statusFiltro, excluidasGeral]
  );

  const toggleStatusFiltro = (s: OsStatus) => {
    setStatusFiltro((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const toggleOsGeral = (id: string) => {
    setExcluidasGeral((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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

      // Ata geral: entra quem passou no filtro de status E não foi desmarcado
      // manualmente na lista (osGeralIncluidas, calculado a partir do mesmo
      // `ordens` já usado pela aba "Uma O.S.", clientes já cruzados ali).
      if (osGeralIncluidas.length === 0) throw new Error("Selecione pelo menos uma O.S.");
      const idsIncluidos = osGeralIncluidas.map((o) => o.id);
      const { data: etapas, error: eErr } = await supabase
        .from("os_etapas").select("os_id, tipo, data, status").in("os_id", idsIncluidos);
      if (eErr) throw eErr;
      const itens: OsSnapshotItem[] = osGeralIncluidas.map((os) => buildOsSnapshotItem(os, etapas ?? []));
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
          <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setBusca("");
              setOsSelecionadaId(null);
              setTitulo("");
              setExcluidasGeral(new Set());
              setStatusFiltro(OS_STATUS_LIST.filter((s) => s !== "faturado"));
            }
          }}>
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
                  <div className="space-y-3">
                    <div>
                      <Label>Filtrar por status</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {OS_STATUS_LIST.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleStatusFiltro(s)}
                            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                              statusFiltro.includes(s)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "text-muted-foreground border-input"
                            }`}
                          >
                            {OS_STATUS_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                      <Input className="pl-8" placeholder="Buscar por número da O.S. ou cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{osGeralIncluidas.length} O.S. selecionada{osGeralIncluidas.length === 1 ? "" : "s"}</span>
                      <div className="flex gap-3">
                        <button type="button" className="underline hover:text-foreground" onClick={() => setExcluidasGeral(new Set())}>
                          Marcar todas
                        </button>
                        <button
                          type="button"
                          className="underline hover:text-foreground"
                          onClick={() => setExcluidasGeral((prev) => {
                            const next = new Set(prev);
                            ordensGeralFiltradas.forEach((o) => next.add(o.id));
                            return next;
                          })}
                        >
                          Desmarcar todas
                        </button>
                      </div>
                    </div>

                    <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
                      {ordensGeralFiltradas.length === 0 && (
                        <div className="p-3 text-sm text-muted-foreground">Nenhuma O.S. encontrada com esse filtro.</div>
                      )}
                      {ordensGeralFiltradas.map((o) => (
                        <label key={o.id} className="flex items-center gap-3 p-3 text-sm cursor-pointer hover:bg-muted transition-colors">
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 accent-primary"
                            checked={!excluidasGeral.has(o.id)}
                            onChange={() => toggleOsGeral(o.id)}
                          />
                          <div>
                            <div className="font-medium">{o.numero_os} — {o.clientes?.nome ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">{OS_STATUS_LABEL[o.status]}{o.projeto ? ` · ${o.projeto}` : ""}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
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
