import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { OS_STATUS_LABEL, OS_STATUS_LIST, OS_STATUS_CLASS, ETAPA_LABEL, ETAPA_ORDER, formatBRL, formatDate, isAtrasada, diffDays, type OsStatus, type EtapaTipo } from "@/lib/os-utils";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Circle, MessageSquare, AlertTriangle, Save, Paperclip, Upload, Trash2, History, Download } from "lucide-react";
import { useSession } from "@/hooks/use-auth";
import { useRef } from "react";

export const Route = createFileRoute("/_app/ordens/$id")({
  head: () => ({ meta: [{ title: "O.S. — Sartori Group" }] }),
  component: OsDetail,
});

function OsDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useSession();

  const { data: os, isLoading } = useQuery({
    queryKey: ["os", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("ordens_servico")
        .select("*, clientes(id, nome)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const { data: etapas } = useQuery({
    queryKey: ["os-etapas", id],
    queryFn: async () => (await supabase.from("os_etapas").select("*").eq("os_id", id)).data ?? [],
  });
  const { data: comentarios } = useQuery({
    queryKey: ["os-comentarios", id],
    queryFn: async () => {
      const { data: rows } = await supabase.from("os_comentarios").select("*").eq("os_id", id).order("created_at",{ascending:false});
      const list = rows ?? [];
      const ids = Array.from(new Set(list.map(c => c.user_id)));
      const profilesMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
        (profs ?? []).forEach(p => profilesMap.set(p.id, p.nome));
      }
      return list.map(c => ({ ...c, autor: profilesMap.get(c.user_id) ?? "Usuário" }));
    },
  });
  const { data: clientes } = useQuery({
    queryKey: ["clientes-simple"],
    queryFn: async () => (await supabase.from("clientes").select("id, nome").order("nome")).data ?? [],
  });
  const { data: anexos } = useQuery({
    queryKey: ["os-anexos", id],
    queryFn: async () => (await supabase.from("os_anexos").select("*").eq("os_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: historico } = useQuery({
    queryKey: ["os-historico", id],
    queryFn: async () => {
      const { data: rows } = await supabase.from("os_historico").select("*").eq("os_id", id).order("created_at", { ascending: false });
      const list = rows ?? [];
      const ids = Array.from(new Set(list.map(h => h.user_id).filter(Boolean) as string[]));
      const map = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
        (profs ?? []).forEach(p => map.set(p.id, p.nome));
      }
      return list.map(h => ({ ...h, autor: h.user_id ? (map.get(h.user_id) ?? "Usuário") : "Sistema" }));
    },
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const uploadAnexo = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Sem sessão");
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("os-files").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.from("os_anexos").insert({
        os_id: id, storage_path: path, nome: file.name, mime_type: file.type, tamanho: file.size, uploaded_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Anexo enviado."); qc.invalidateQueries({ queryKey: ["os-anexos", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeAnexo = useMutation({
    mutationFn: async (anexo: { id: string; storage_path: string }) => {
      await supabase.storage.from("os-files").remove([anexo.storage_path]);
      const { error } = await supabase.from("os_anexos").delete().eq("id", anexo.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Anexo removido."); qc.invalidateQueries({ queryKey: ["os-anexos", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function downloadAnexo(path: string, nome: string) {
    const { data, error } = await supabase.storage.from("os-files").createSignedUrl(path, 60);
    if (error || !data) { toast.error(error?.message ?? "Falha"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = nome; a.target = "_blank"; a.click();
  }

  const [edit, setEdit] = useState<Record<string, unknown>>({});
  useEffect(() => { setEdit({}); }, [os?.id]);

  const merged = { ...(os ?? {}), ...edit };

  const save = useMutation({
    mutationFn: async () => {
      if (Object.keys(edit).length === 0) return;
      const { error } = await supabase.from("ordens_servico").update(edit as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("O.S. atualizada.");
      qc.invalidateQueries({ queryKey: ["os", id] });
      qc.invalidateQueries({ queryKey: ["ordens"] });
      qc.invalidateQueries({ queryKey: ["os-historico", id] });
      setEdit({});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEtapa = useMutation({
    mutationFn: async ({ tipo, data, status }: { tipo: EtapaTipo; data: string | null; status: "pendente"|"concluido" }) => {
      const { error } = await supabase.from("os_etapas").update({ data, status, updated_by: user?.id }).eq("os_id", id).eq("tipo", tipo);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-etapas", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const [novoComentario, setNovoComentario] = useState("");
  const addComentario = useMutation({
    mutationFn: async () => {
      if (!novoComentario.trim() || !user) return;
      const { error } = await supabase.from("os_comentarios").insert({ os_id: id, user_id: user.id, texto: novoComentario.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setNovoComentario(""); qc.invalidateQueries({ queryKey: ["os-comentarios", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeOs = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ordens_servico").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("O.S. excluída"); navigate({ to: "/ordens" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !os) return <div className="p-6 text-muted-foreground">Carregando O.S...</div>;

  const atrasada = isAtrasada(os.data_entrega_prev, os.data_entrega_real, os.status);
  const dias = diffDays(os.data_entrega_prev, os.data_entrega_real ?? new Date().toISOString().slice(0,10));

  const setField = (k: string, v: unknown) => setEdit(e => ({ ...e, [k]: v }));
  const val = (k: string) => (merged as Record<string, unknown>)[k];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/ordens" })}><ArrowLeft className="h-4 w-4 mr-1" />Ordens</Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">O.S. {os.numero_os}</h1>
              <Badge variant="outline" className={OS_STATUS_CLASS[os.status]}>{OS_STATUS_LABEL[os.status]}</Badge>
              {atrasada && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Atrasada</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {os.clientes?.nome && <Link to="/clientes/$id" params={{ id: os.clientes.id }} className="hover:underline">{os.clientes.nome}</Link>}
              {os.projeto && <> • {os.projeto}</>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={() => confirm("Excluir esta O.S.?") && removeOs.mutate()}>Excluir</Button>
          {Object.keys(edit).length > 0 && (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="h-4 w-4 mr-2" />{save.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard label="Valor total" value={formatBRL(Number(os.valor_total))} />
        <SummaryCard label="Entrega prevista" value={formatDate(os.data_entrega_prev)} tone={atrasada ? "danger" : undefined} />
        <SummaryCard label={os.data_entrega_real ? "Entregue em" : "Prazo (dias)"} value={os.data_entrega_real ? formatDate(os.data_entrega_real) : (dias == null ? "—" : `${dias > 0 ? "+" : ""}${dias} dias`)} tone={dias != null && dias > 0 && !os.data_entrega_real ? "danger" : "success"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Dados gerais</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <Section title="Identificação">
                <Field label="Nº O.S."><Input value={String(val("numero_os") ?? "")} onChange={e => setField("numero_os", e.target.value)} /></Field>
                <Field label="Nº orçamento (SS)"><Input value={String(val("numero_ss") ?? "")} onChange={e => setField("numero_ss", e.target.value)} /></Field>
                <Field label="Nº pedido"><Input value={String(val("numero_pedido") ?? "")} onChange={e => setField("numero_pedido", e.target.value)} /></Field>
                <Field label="Projeto"><Input value={String(val("projeto") ?? "")} onChange={e => setField("projeto", e.target.value)} /></Field>
              </Section>
              <Section title="Cliente e responsáveis">
                <Field label="Cliente">
                  <Select value={String(val("cliente_id") ?? "")} onValueChange={v => setField("cliente_id", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(clientes ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Solicitante"><Input value={String(val("solicitante") ?? "")} onChange={e => setField("solicitante", e.target.value)} /></Field>
                <Field label="Gestor(a)"><Input value={String(val("gestor") ?? "")} onChange={e => setField("gestor", e.target.value)} /></Field>
                <Field label="Orçamentista"><Input value={String(val("orcamentista") ?? "")} onChange={e => setField("orcamentista", e.target.value)} /></Field>
                <Field label="Status">
                  <Select value={String(val("status"))} onValueChange={v => setField("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{OS_STATUS_LIST.map(s => <SelectItem key={s} value={s}>{OS_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </Section>
              <Section title="Prazos e quantidades">
                <Field label="Início previsto"><Input type="date" value={String(val("data_inicio_prev") ?? "")} onChange={e => setField("data_inicio_prev", e.target.value)} /></Field>
                <Field label="Entrega prevista"><Input type="date" value={String(val("data_entrega_prev") ?? "")} onChange={e => setField("data_entrega_prev", e.target.value)} /></Field>
                <Field label="Entrega real"><Input type="date" value={String(val("data_entrega_real") ?? "")} onChange={e => setField("data_entrega_real", e.target.value)} /></Field>
                <Field label="Unidade"><Input value={String(val("unidade") ?? "")} onChange={e => setField("unidade", e.target.value)} /></Field>
                <Field label="Quantidade"><Input type="number" step="0.001" value={String(val("quantidade") ?? "")} onChange={e => setField("quantidade", e.target.value ? Number(e.target.value) : null)} /></Field>
                <Field label="Peso (kg)"><Input type="number" step="0.001" value={String(val("peso_kg") ?? "")} onChange={e => setField("peso_kg", e.target.value ? Number(e.target.value) : null)} /></Field>
              </Section>
              <Section title="Valores e entrega">
                <Field label="Valor unitário"><Input type="number" step="0.01" value={String(val("valor_unit") ?? "")} onChange={e => setField("valor_unit", e.target.value ? Number(e.target.value) : null)} /></Field>
                <Field label="Valor total"><Input type="number" step="0.01" value={String(val("valor_total") ?? "")} onChange={e => setField("valor_total", e.target.value ? Number(e.target.value) : null)} /></Field>
                <Field label="Local de entrega"><Input value={String(val("local_entrega") ?? "")} onChange={e => setField("local_entrega", e.target.value)} /></Field>
                <Field label="Frete"><Input value={String(val("tipo_frete") ?? "")} onChange={e => setField("tipo_frete", e.target.value)} /></Field>
              </Section>
              <div>
                <Label>Descrição do escopo</Label>
                <Textarea rows={4} value={String(val("descricao") ?? "")} onChange={e => setField("descricao", e.target.value)} />
              </div>
              <div>
                <Label>Fora de escopo</Label>
                <Textarea rows={2} value={String(val("fora_escopo") ?? "")} onChange={e => setField("fora_escopo", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline de produção</CardTitle>
              <CardDescription>Marcos do ciclo de vida da O.S.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ETAPA_ORDER.map((tipo) => {
                const e = etapas?.find(x => x.tipo === tipo);
                const done = e?.status === "concluido";
                return (
                  <div key={tipo} className="flex items-start gap-3">
                    <button
                      onClick={() => updateEtapa.mutate({ tipo, data: e?.data ?? new Date().toISOString().slice(0,10), status: done ? "pendente" : "concluido" })}
                      className="mt-0.5"
                      title={done ? "Marcar como pendente" : "Marcar como concluído"}
                    >
                      {done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{ETAPA_LABEL[tipo]}</div>
                      <Input
                        type="date"
                        className="h-8 mt-1"
                        value={e?.data ?? ""}
                        onChange={(ev) => updateEtapa.mutate({ tipo, data: ev.target.value || null, status: e?.status ?? "pendente" })}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" />Comentários</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea rows={2} placeholder="Adicione um comentário..." value={novoComentario} onChange={e => setNovoComentario(e.target.value)} />
              <div className="flex justify-end">
                <Button size="sm" disabled={!novoComentario.trim() || addComentario.isPending} onClick={() => addComentario.mutate()}>Publicar</Button>
              </div>
              <Separator />
              <ul className="space-y-3 max-h-80 overflow-auto pr-1">
                {(comentarios ?? []).length === 0 && <li className="text-sm text-muted-foreground">Nenhum comentário ainda.</li>}
                {(comentarios ?? []).map(c => (
                  <li key={c.id} className="text-sm">
                    <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                      <span className="font-medium text-foreground">{c.autor}</span>
                      <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{c.texto}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Paperclip className="h-4 w-4" />Anexos</CardTitle>
              <CardDescription>PDFs, imagens, planilhas do pedido.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { uploadAnexo.mutate(f); e.target.value = ""; } }}
              />
              <Button size="sm" variant="outline" className="w-full gap-2" disabled={uploadAnexo.isPending} onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" />{uploadAnexo.isPending ? "Enviando..." : "Enviar arquivo"}
              </Button>
              <ul className="space-y-2 max-h-72 overflow-auto pr-1">
                {(anexos ?? []).length === 0 && <li className="text-sm text-muted-foreground">Nenhum anexo.</li>}
                {(anexos ?? []).map(a => (
                  <li key={a.id} className="flex items-center gap-2 text-sm border rounded-md p-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <button className="flex-1 min-w-0 text-left hover:underline truncate" onClick={() => downloadAnexo(a.storage_path, a.nome)}>{a.nome}</button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadAnexo(a.storage_path, a.nome)}><Download className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => confirm("Remover anexo?") && removeAnexo.mutate({ id: a.id, storage_path: a.storage_path })}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" />Histórico de versões</CardTitle>
              <CardDescription>Auditoria de alterações da O.S.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 max-h-96 overflow-auto pr-1">
                {(historico ?? []).length === 0 && <li className="text-sm text-muted-foreground">Sem histórico.</li>}
                {(historico ?? []).map(h => (
                  <li key={h.id} className="text-xs border-l-2 border-primary/30 pl-3">
                    <div className="flex justify-between text-muted-foreground">
                      <span className="font-medium text-foreground">{h.autor}</span>
                      <span>{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="text-foreground mt-0.5 font-medium capitalize">{h.acao.replace(/_/g, " ")}</div>
                    {h.payload && typeof h.payload === "object" && (
                      <ul className="mt-1 space-y-0.5">
                        {Object.entries(h.payload as Record<string, unknown>).map(([k, v]) => {
                          const change = v as { de?: unknown; para?: unknown };
                          if (change && typeof change === "object" && "de" in change) {
                            return <li key={k} className="text-muted-foreground"><b className="text-foreground">{k}:</b> {String(change.de ?? "—")} → {String(change.para ?? "—")}</li>;
                          }
                          return <li key={k} className="text-muted-foreground"><b className="text-foreground">{k}:</b> {String(v)}</li>;
                        })}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "danger"|"success" }) {
  const cls = tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : "text-foreground";
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`text-xl font-semibold mt-1 ${cls}`}>{value}</div></CardContent></Card>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
