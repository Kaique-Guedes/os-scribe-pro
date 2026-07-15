import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OS_STATUS_LABEL, OS_STATUS_LIST, type OsStatus } from "@/lib/os-utils";
import { toast } from "sonner";
import { Upload, Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import type { TablesInsert } from "@/integrations/supabase/types";
import { extractOsFromDocument } from "@/lib/os-extract.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_app/ordens/nova")({
  head: () => ({ meta: [{ title: "Nova O.S. — Sartori Group" }] }),
  component: NovaOsPage,
});

type FormState = Partial<TablesInsert<"ordens_servico">>;

function NovaOsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>({ status: "aberta" });
  const [novoCliente, setNovoCliente] = useState("");
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extractFn = useServerFn(extractOsFromDocument);

  const { data: clientes } = useQuery({
    queryKey: ["clientes-simple"],
    queryFn: async () => (await supabase.from("clientes").select("id, nome").order("nome")).data ?? [],
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  async function handleFileUpload(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Arquivo grande demais (máx 15MB)");
      return;
    }
    setExtracting(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const dataBase64 = btoa(binary);
      const result = await extractFn({
        data: { filename: file.name, mimeType: file.type || "application/pdf", dataBase64 },
      });
      // Pré-preenche apenas campos que a IA retornou
      setForm(prev => {
        const next: FormState = { ...prev };
        const map: Array<[keyof FormState, unknown]> = [
          ["numero_os", result.numero_os],
          ["numero_ss", result.numero_ss],
          ["numero_pedido", result.numero_pedido],
          ["projeto", result.projeto],
          ["solicitante", result.solicitante],
          ["gestor", result.gestor],
          ["orcamentista", result.orcamentista],
          ["data_inicio_prev", result.data_inicio_prev],
          ["data_entrega_prev", result.data_entrega_prev],
          ["unidade", result.unidade],
          ["quantidade", result.quantidade],
          ["valor_unit", result.valor_unit],
          ["valor_total", result.valor_total],
          ["peso_kg", result.peso_kg],
          ["local_entrega", result.local_entrega],
          ["tipo_frete", result.tipo_frete],
          ["descricao", result.descricao],
          ["fora_escopo", result.fora_escopo],
        ];
        for (const [k, v] of map) if (v != null && v !== "") (next as Record<string, unknown>)[k as string] = v;
        return next;
      });
      if (result.cliente_nome) {
        const existing = (clientes ?? []).find(c => c.nome.toLowerCase() === result.cliente_nome!.toLowerCase());
        if (existing) set("cliente_id", existing.id);
        else setNovoCliente(result.cliente_nome);
      }
      toast.success("Dados extraídos! Revise antes de salvar.");
    } catch (e) {
      toast.error(`Falha na extração: ${(e as Error).message}`);
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      let cliente_id = form.cliente_id ?? null;
      if (!cliente_id && novoCliente.trim()) {
        const { data, error } = await supabase.from("clientes").insert({ nome: novoCliente.trim() }).select("id").single();
        if (error) throw error;
        cliente_id = data.id;
      }
      if (!form.numero_os?.trim()) throw new Error("Informe o número da O.S.");
      const payload: TablesInsert<"ordens_servico"> = {
        numero_os: form.numero_os!,
        cliente_id,
        solicitante: form.solicitante ?? null,
        numero_ss: form.numero_ss ?? null,
        numero_pedido: form.numero_pedido ?? null,
        projeto: form.projeto ?? null,
        gestor: form.gestor ?? null,
        orcamentista: form.orcamentista ?? null,
        data_inicio_prev: form.data_inicio_prev || null,
        data_entrega_prev: form.data_entrega_prev || null,
        unidade: form.unidade ?? null,
        quantidade: form.quantidade ?? null,
        valor_unit: form.valor_unit ?? null,
        valor_total: form.valor_total ?? null,
        peso_kg: form.peso_kg ?? null,
        local_entrega: form.local_entrega ?? null,
        tipo_frete: form.tipo_frete ?? null,
        descricao: form.descricao ?? null,
        fora_escopo: form.fora_escopo ?? null,
        status: (form.status ?? "aberta") as OsStatus,
      };
      const { data, error } = await supabase.from("ordens_servico").insert(payload).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["ordens"] });
      toast.success("O.S. criada com sucesso.");
      navigate({ to: "/ordens/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/ordens" })}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nova Ordem de Serviço</h1>
          <p className="text-sm text-muted-foreground">Cadastre manualmente ou envie um documento para extração automática.</p>
        </div>
      </div>

      <Card className="border-dashed border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />Extração automática por IA</CardTitle>
          <CardDescription>Envie um PDF ou imagem do pedido/orçamento e a IA preenche os campos automaticamente. Revise antes de salvar.</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
          />
          <Button variant="outline" disabled={extracting} className="gap-2" onClick={() => fileInputRef.current?.click()}>
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {extracting ? "Extraindo dados..." : "Enviar documento"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados da O.S.</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <Section title="Identificação">
            <Field label="Número da O.S. *"><Input value={form.numero_os ?? ""} onChange={e => set("numero_os", e.target.value)} /></Field>
            <Field label="Nº do orçamento (SS)"><Input value={form.numero_ss ?? ""} onChange={e => set("numero_ss", e.target.value)} /></Field>
            <Field label="Nº do pedido"><Input value={form.numero_pedido ?? ""} onChange={e => set("numero_pedido", e.target.value)} /></Field>
            <Field label="Projeto (código Sankhya)"><Input value={form.projeto ?? ""} onChange={e => set("projeto", e.target.value)} /></Field>
          </Section>

          <Section title="Cliente e responsáveis">
            <Field label="Cliente">
              <Select value={form.cliente_id ?? ""} onValueChange={v => set("cliente_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente existente" /></SelectTrigger>
                <SelectContent>
                  {(clientes ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Ou cadastrar novo cliente"><Input value={novoCliente} onChange={e => setNovoCliente(e.target.value)} placeholder="Nome do novo cliente" /></Field>
            <Field label="Solicitante / contato"><Input value={form.solicitante ?? ""} onChange={e => set("solicitante", e.target.value)} /></Field>
            <Field label="Gestor(a) responsável"><Input value={form.gestor ?? ""} onChange={e => set("gestor", e.target.value)} /></Field>
            <Field label="Orçamentista"><Input value={form.orcamentista ?? ""} onChange={e => set("orcamentista", e.target.value)} /></Field>
            <Field label="Status inicial">
              <Select value={form.status ?? "aberta"} onValueChange={v => set("status", v as OsStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OS_STATUS_LIST.map(s => <SelectItem key={s} value={s}>{OS_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </Section>

          <Section title="Prazos e quantidades">
            <Field label="Data de início prevista"><Input type="date" value={form.data_inicio_prev ?? ""} onChange={e => set("data_inicio_prev", e.target.value)} /></Field>
            <Field label="Data de entrega prevista"><Input type="date" value={form.data_entrega_prev ?? ""} onChange={e => set("data_entrega_prev", e.target.value)} /></Field>
            <Field label="Unidade"><Input value={form.unidade ?? ""} onChange={e => set("unidade", e.target.value)} placeholder="pç, kg, m..." /></Field>
            <Field label="Quantidade"><Input type="number" step="0.001" value={form.quantidade ?? ""} onChange={e => set("quantidade", e.target.value ? Number(e.target.value) : null)} /></Field>
            <Field label="Peso vendido (kg)"><Input type="number" step="0.001" value={form.peso_kg ?? ""} onChange={e => set("peso_kg", e.target.value ? Number(e.target.value) : null)} /></Field>
          </Section>

          <Section title="Valores">
            <Field label="Valor unitário (R$)"><Input type="number" step="0.01" value={form.valor_unit ?? ""} onChange={e => set("valor_unit", e.target.value ? Number(e.target.value) : null)} /></Field>
            <Field label="Valor total (R$)"><Input type="number" step="0.01" value={form.valor_total ?? ""} onChange={e => set("valor_total", e.target.value ? Number(e.target.value) : null)} /></Field>
          </Section>

          <Section title="Entrega">
            <Field label="Local de entrega"><Input value={form.local_entrega ?? ""} onChange={e => set("local_entrega", e.target.value)} /></Field>
            <Field label="Frete"><Input value={form.tipo_frete ?? ""} onChange={e => set("tipo_frete", e.target.value)} placeholder="CIF / FOB / EXW" /></Field>
          </Section>

          <div>
            <Label>Descrição do serviço / escopo</Label>
            <Textarea rows={4} value={form.descricao ?? ""} onChange={e => set("descricao", e.target.value)} placeholder="Ex: fabricação de barra de selagem conforme desenho X..." />
          </div>
          <div>
            <Label>Itens fora de escopo</Label>
            <Textarea rows={2} value={form.fora_escopo ?? ""} onChange={e => set("fora_escopo", e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate({ to: "/ordens" })}>Cancelar</Button>
            <Button disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Salvando..." : "Salvar O.S."}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
