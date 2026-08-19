import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles, canEdit } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ArrowLeft, Printer, Plus, Trash2, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, OS_STATUS_LABEL } from "@/lib/os-utils";
import { resumoMaterial, type OsSnapshotItem, type Participante, type PlanoAcaoItem } from "@/lib/reuniao-utils";
import { SartoriLogo } from "@/components/sartori-logo";

export const Route = createFileRoute("/_app/reunioes/$id")({
  head: () => ({ meta: [{ title: "Ata de Reunião — Sartori Group" }] }),
  component: ReuniaoDetalhe,
});

function ReuniaoDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: roles = [] } = useRoles(user?.id);
  const podeEditar = canEdit(roles);

  const { data: reuniao, isLoading } = useQuery({
    queryKey: ["reuniao", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("reunioes").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const [pauta, setPauta] = useState("");
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [plano, setPlano] = useState<PlanoAcaoItem[]>([]);

  // Sincroniza o estado local sempre que os dados chegam do banco (primeira
  // carga) — depois disso, quem manda é o estado local até salvar de novo.
  useEffect(() => {
    if (!reuniao) return;
    setPauta(reuniao.pauta ?? "");
    setParticipantes(((reuniao.participantes as any) ?? []) as Participante[]);
    setPlano((((reuniao.dados_snapshot as any)?.plano_acao ?? []) as PlanoAcaoItem[]));
  }, [reuniao?.id]);

  const finalizada = reuniao?.status === "finalizada";
  const travado = !podeEditar || finalizada;

  const salvar = useMutation({
    mutationFn: async (novoStatus?: "finalizada") => {
      const dadosSnapshot = { ...(reuniao?.dados_snapshot as any), plano_acao: plano };
      const { error } = await supabase.from("reunioes").update({
        pauta, participantes: participantes as any, dados_snapshot: dadosSnapshot as any,
        ...(novoStatus ? { status: novoStatus } : {}),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, novoStatus) => {
      qc.invalidateQueries({ queryKey: ["reuniao", id] });
      qc.invalidateQueries({ queryKey: ["reunioes"] });
      toast.success(novoStatus === "finalizada" ? "Ata finalizada." : "Ata salva.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!reuniao) return <div className="p-6 text-sm text-muted-foreground">Ata não encontrada.</div>;

  const snapshot = reuniao.dados_snapshot as any;
  const itens: OsSnapshotItem[] = reuniao.tipo === "individual" ? [snapshot as OsSnapshotItem] : (snapshot?.itens ?? []);

  return (
    <div className="p-6 space-y-4 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/reunioes" className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Voltar
        </Link>
        <div className="flex items-center gap-2">
          {finalizada && <Badge className="gap-1"><Lock className="h-3 w-3" />Finalizada</Badge>}
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Imprimir / Salvar PDF</Button>
          {!travado && (
            <>
              <Button variant="outline" onClick={() => salvar.mutate(undefined)} disabled={salvar.isPending}>Salvar rascunho</Button>
              <Button onClick={() => salvar.mutate("finalizada")} disabled={salvar.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-2" />Finalizar ata
              </Button>
            </>
          )}
        </div>
      </div>

      {/* A partir daqui é o conteúdo que vai pro papel/PDF quando clicar em Imprimir */}
      <Card className="print:border-none print:shadow-none">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{reuniao.titulo}</CardTitle>
              <p className="text-sm text-muted-foreground">Ata de Reunião · {formatDate(reuniao.data_reuniao)}</p>
            </div>
            <SartoriLogo className="h-8 w-auto print:block hidden" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">

          <section>
            <h3 className="text-sm font-semibold mb-2">{reuniao.tipo === "individual" ? "Dados da O.S." : `O.S. envolvidas (${itens.length})`}</h3>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>O.S.</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entrega prevista</TableHead>
                    <TableHead>Material</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((it) => (
                    <TableRow key={it.os_id}>
                      <TableCell className="font-medium">{it.numero_os}</TableCell>
                      <TableCell>{it.cliente_nome}</TableCell>
                      <TableCell><Badge variant="outline">{OS_STATUS_LABEL[it.status]}</Badge></TableCell>
                      <TableCell>{it.data_entrega_real ? `Entregue em ${formatDate(it.data_entrega_real)}` : formatDate(it.data_entrega_prev)}</TableCell>
                      <TableCell className="text-xs">{resumoMaterial(it)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Pauta / Observações</h3>
            {travado ? (
              <p className="text-sm whitespace-pre-wrap">{pauta || "—"}</p>
            ) : (
              <Textarea rows={4} value={pauta} onChange={(e) => setPauta(e.target.value)} placeholder="O que foi discutido nessa reunião…" />
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Plano de Ação</h3>
              {!travado && (
                <Button size="sm" variant="outline" onClick={() => setPlano((p) => [...p, { acao: "", responsavel: "", prazo: null, status: "pendente" }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Adicionar linha
                </Button>
              )}
            </div>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Ação</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Status</TableHead>
                    {!travado && <TableHead className="w-8" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plano.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{travado ? item.acao : <Input value={item.acao} onChange={(e) => setPlano((p) => p.map((x, j) => j === i ? { ...x, acao: e.target.value } : x))} />}</TableCell>
                      <TableCell>{travado ? item.responsavel : <Input value={item.responsavel} onChange={(e) => setPlano((p) => p.map((x, j) => j === i ? { ...x, responsavel: e.target.value } : x))} />}</TableCell>
                      <TableCell>{travado ? formatDate(item.prazo) : <Input type="date" value={item.prazo ?? ""} onChange={(e) => setPlano((p) => p.map((x, j) => j === i ? { ...x, prazo: e.target.value || null } : x))} />}</TableCell>
                      <TableCell>
                        {travado ? (
                          <Badge variant={item.status === "concluido" ? "default" : item.status === "atrasado" ? "destructive" : "secondary"}>
                            {item.status === "concluido" ? "Concluído" : item.status === "atrasado" ? "Atrasado" : "Pendente"}
                          </Badge>
                        ) : (
                          <Select value={item.status} onValueChange={(v) => setPlano((p) => p.map((x, j) => j === i ? { ...x, status: v as PlanoAcaoItem["status"] } : x))}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendente">Pendente</SelectItem>
                              <SelectItem value="concluido">Concluído</SelectItem>
                              <SelectItem value="atrasado">Atrasado</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      {!travado && (
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => setPlano((p) => p.filter((_, j) => j !== i))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {plano.length === 0 && <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground text-center py-4">Nenhuma ação registrada.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Participantes</h3>
              {!travado && (
                <Button size="sm" variant="outline" onClick={() => setParticipantes((p) => [...p, { nome: "", cargo: "" }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Adicionar participante
                </Button>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {participantes.map((p, i) => (
                <div key={i} className="border rounded-md p-3 space-y-2">
                  {travado ? (
                    <div className="text-sm font-medium">{p.nome}{p.cargo ? ` — ${p.cargo}` : ""}</div>
                  ) : (
                    <div className="flex gap-2">
                      <Input placeholder="Nome" value={p.nome} onChange={(e) => setParticipantes((arr) => arr.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
                      <Input placeholder="Cargo / empresa" value={p.cargo ?? ""} onChange={(e) => setParticipantes((arr) => arr.map((x, j) => j === i ? { ...x, cargo: e.target.value } : x))} />
                      <Button size="icon" variant="ghost" onClick={() => setParticipantes((arr) => arr.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}
                  <div className="border-t pt-6 mt-2">
                    <div className="border-b border-foreground/40 h-8" />
                    <p className="text-xs text-muted-foreground mt-1">Assinatura</p>
                  </div>
                </div>
              ))}
              {participantes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum participante adicionado.</p>}
            </div>
          </section>

        </CardContent>
      </Card>
    </div>
  );
}
