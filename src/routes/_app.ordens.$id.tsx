import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  OS_STATUS_LABEL,
  OS_STATUS_LIST,
  OS_STATUS_CLASS,
  ETAPA_LABEL,
  ETAPA_ORDER,
  MATERIAL_CATEGORIA_LABEL,
  MATERIAL_CATEGORIA_LIST,
  formatBRL,
  formatDate,
  isAtrasada,
  diffDays,
  type OsStatus,
  type EtapaTipo,
  type MaterialCategoria,
} from "@/lib/os-utils";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { extractNotaFiscalFromDocument } from "@/lib/nota-fiscal-extract.functions";
import { extractCotacaoFromDocument, type ExtractedCotacaoItem } from "@/lib/cotacao-extract.functions";
import { iniciarConferencia, concluirConferencia } from "@/lib/conferencia-material.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  MessageSquare,
  AlertTriangle,
  Save,
  Paperclip,
  Upload,
  Trash2,
  History,
  Download,
  Receipt,
  FileWarning,
  X as XIcon,
  Plus,
  Star,
  Package,
  Printer,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import { useSession, useRoles, canEditEtapa } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/ordens/$id")({
  head: () => ({ meta: [{ title: "O.S. — Sartori Group" }] }),
  component: OsDetail,
});

function OsDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: roles = [] } = useRoles(user?.id);

  const { data: os, isLoading } = useQuery({
    queryKey: ["os", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*, clientes(id, nome)")
        .eq("id", id)
        .single();
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
      const { data: rows } = await supabase
        .from("os_comentarios")
        .select("*")
        .eq("os_id", id)
        .order("created_at", { ascending: false });
      const list = rows ?? [];
      const ids = Array.from(new Set(list.map((c) => c.user_id)));
      const profilesMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
        (profs ?? []).forEach((p) => profilesMap.set(p.id, p.nome));
      }
      return list.map((c) => ({ ...c, autor: profilesMap.get(c.user_id) ?? "Usuário" }));
    },
  });
  const { data: clientes } = useQuery({
    queryKey: ["clientes-simple"],
    queryFn: async () =>
      (await supabase.from("clientes").select("id, nome").order("nome")).data ?? [],
  });
  const { data: anexos } = useQuery({
    queryKey: ["os-anexos", id],
    queryFn: async () =>
      (
        await supabase
          .from("os_anexos")
          .select("*")
          .eq("os_id", id)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: cotacoes } = useQuery({
    queryKey: ["material-cotacoes", id],
    queryFn: async () =>
      (
        await supabase
          .from("material_cotacoes")
          .select("*, material_cotacao_itens(*)")
          .eq("os_id", id)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: conferencias } = useQuery({
    queryKey: ["material-conferencias", id],
    queryFn: async () =>
      (
        await supabase
          .from("material_conferencias")
          .select("*, material_conferencia_itens(*)")
          .eq("os_id", id)
      ).data ?? [],
  });
  const iniciarConferenciaFn = useServerFn(iniciarConferencia);
  const concluirConferenciaFn = useServerFn(concluirConferencia);
  const { data: historico } = useQuery({
    queryKey: ["os-historico", id],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("os_historico")
        .select("*")
        .eq("os_id", id)
        .order("created_at", { ascending: false });
      const list = rows ?? [];
      const ids = Array.from(new Set(list.map((h) => h.user_id).filter(Boolean) as string[]));
      const map = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
        (profs ?? []).forEach((p) => map.set(p.id, p.nome));
      }
      return list.map((h) => ({
        ...h,
        autor: h.user_id ? (map.get(h.user_id) ?? "Usuário") : "Sistema",
      }));
    },
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const pedidoCompraFileRef = useRef<HTMLInputElement>(null);
  const notaFiscalCompraFileRef = useRef<HTMLInputElement>(null);
  const uploadAnexo = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Sem sessão");
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("os-files")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.from("os_anexos").insert({
        os_id: id,
        storage_path: path,
        nome: file.name,
        mime_type: file.type,
        tamanho: file.size,
        uploaded_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Anexo enviado.");
      qc.invalidateQueries({ queryKey: ["os-anexos", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeAnexo = useMutation({
    mutationFn: async (anexo: { id: string; storage_path: string }) => {
      await supabase.storage.from("os-files").remove([anexo.storage_path]);
      const { error } = await supabase.from("os_anexos").delete().eq("id", anexo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Anexo removido.");
      qc.invalidateQueries({ queryKey: ["os-anexos", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function downloadAnexo(path: string, nome: string) {
    const { data, error } = await supabase.storage.from("os-files").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error(error?.message ?? "Falha");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = nome;
    a.target = "_blank";
    a.click();
  }

  // ---- Notas Fiscais: uma O.S. pode ter várias (faturamento parcial/múltiplo) ----
  const { data: notasFiscais } = useQuery({
    queryKey: ["os-notas-fiscais", id],
    queryFn: async () =>
      (
        await supabase
          .from("os_notas_fiscais")
          .select("*")
          .eq("os_id", id)
          .order("data_emissao", { ascending: false })
      ).data ?? [],
  });

  const nfFileRef = useRef<HTMLInputElement>(null);
  const [nfFormAberto, setNfFormAberto] = useState(false);
  const [nfArquivo, setNfArquivo] = useState<File | null>(null);
  const [nfProcessando, setNfProcessando] = useState(false);
  const [nfExtraiuAlgo, setNfExtraiuAlgo] = useState(true);
  const [nfData, setNfData] = useState("");
  const [nfValor, setNfValor] = useState("");
  const [nfNumero, setNfNumero] = useState("");
  const extractNfFn = useServerFn(extractNotaFiscalFromDocument);

  async function onSelecionarNf(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Arquivo grande demais (máx 15MB)");
      return;
    }
    setNfArquivo(file);
    setNfFormAberto(true);
    setNfProcessando(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const dataBase64 = btoa(binary);
      const r = await extractNfFn({
        data: { filename: file.name, mimeType: file.type || "application/pdf", dataBase64 },
      });
      setNfData(r.data_emissao ?? "");
      setNfValor(r.valor_total != null ? String(r.valor_total) : "");
      setNfNumero(r.numero_nota_fiscal ?? "");
      const extraiuAlgo = r.data_emissao != null || r.valor_total != null;
      setNfExtraiuAlgo(extraiuAlgo);
      if (!extraiuAlgo)
        toast.warning(
          "A IA não conseguiu identificar os dados dessa nota. Confira e preencha manualmente.",
        );
      else toast.success("Dados extraídos pela IA! Revise antes de salvar.");
    } catch (e) {
      setNfExtraiuAlgo(false);
      toast.error(`Falha na leitura por IA: ${(e as Error).message}. Preencha manualmente.`);
    } finally {
      setNfProcessando(false);
    }
  }

  function cancelarNf() {
    setNfArquivo(null);
    setNfFormAberto(false);
    setNfData("");
    setNfValor("");
    setNfNumero("");
    setNfExtraiuAlgo(true);
    if (nfFileRef.current) nfFileRef.current.value = "";
  }

  const salvarNf = useMutation({
    mutationFn: async () => {
      if (!nfArquivo || !user) throw new Error("Selecione o PDF da nota fiscal.");
      if (!nfData) throw new Error("Informe a data de emissão.");
      const valorNum = parseFloat(nfValor.replace(",", "."));
      if (!valorNum || Number.isNaN(valorNum)) throw new Error("Informe um valor válido.");

      const path = `${id}/nf-${Date.now()}-${nfArquivo.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("os-files")
        .upload(path, nfArquivo, { contentType: "application/pdf" });
      if (upErr) throw upErr;

      const { error: nfErr } = await supabase.from("os_notas_fiscais").insert({
        os_id: id,
        numero_nota_fiscal: nfNumero || null,
        valor: valorNum,
        data_emissao: nfData,
        storage_path: path,
        nome_arquivo: nfArquivo.name,
        uploaded_by: user.id,
      });
      if (nfErr) throw nfErr;
    },
    onSuccess: () => {
      toast.success("Nota fiscal anexada.");
      qc.invalidateQueries({ queryKey: ["os-notas-fiscais", id] });
      qc.invalidateQueries({ queryKey: ["ordens"] });
      qc.invalidateQueries({ queryKey: ["dashboard-os"] });
      cancelarNf();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerNf = useMutation({
    mutationFn: async (nf: { id: string; storage_path: string }) => {
      await supabase.storage.from("os-files").remove([nf.storage_path]);
      const { error } = await supabase.from("os_notas_fiscais").delete().eq("id", nf.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota fiscal removida.");
      qc.invalidateQueries({ queryKey: ["os-notas-fiscais", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-os"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function baixarNf(path: string, nome: string) {
    const { data, error } = await supabase.storage.from("os-files").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error(error?.message ?? "Falha");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = nome;
    a.target = "_blank";
    a.click();
  }

  const totalFaturadoNf = (notasFiscais ?? []).reduce((s, n) => s + Number(n.valor || 0), 0);

  const [edit, setEdit] = useState<Record<string, unknown>>({});
  useEffect(() => {
    setEdit({});
  }, [os?.id]);

  const merged = { ...(os ?? {}), ...edit };

  const save = useMutation({
    mutationFn: async () => {
      if (Object.keys(edit).length === 0) return;
      const { error } = await supabase
        .from("ordens_servico")
        .update(edit as never)
        .eq("id", id);
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
    mutationFn: async ({
      tipo,
      data,
      status,
    }: {
      tipo: EtapaTipo;
      data: string | null;
      status: "pendente" | "concluido";
    }) => {
      const { error } = await supabase
        .from("os_etapas")
        .update({ data, status, updated_by: user?.id })
        .eq("os_id", id)
        .eq("tipo", tipo);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-etapas", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Campos extras da etapa (data_pedido, anexos de compra) — usados por solicitacao_material/chegada_material
  const updateEtapaExtra = useMutation({
    mutationFn: async ({ tipo, patch }: { tipo: EtapaTipo; patch: TablesUpdate<"os_etapas"> }) => {
      const { error } = await supabase.from("os_etapas").update(patch).eq("os_id", id).eq("tipo", tipo);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-etapas", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Upload de anexo já vinculado direto a uma coluna de os_etapas (pedido de compra / NF de compra)
  const uploadEtapaAnexo = useMutation({
    mutationFn: async ({
      file,
      tipo,
      column,
    }: {
      file: File;
      tipo: EtapaTipo;
      column: "pedido_compra_anexo_id" | "nota_fiscal_compra_anexo_id";
    }) => {
      if (!user) throw new Error("Sem sessão");
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("os-files")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: anexo, error: insErr } = await supabase
        .from("os_anexos")
        .insert({
          os_id: id,
          storage_path: path,
          nome: file.name,
          mime_type: file.type,
          tamanho: file.size,
          uploaded_by: user.id,
        })
        .select()
        .single();
      if (insErr) throw insErr;
      const { error: updErr } = await supabase
        .from("os_etapas")
        .update({ [column]: anexo.id } as TablesUpdate<"os_etapas">)
        .eq("os_id", id)
        .eq("tipo", tipo);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success("Anexo vinculado.");
      qc.invalidateQueries({ queryKey: ["os-etapas", id] });
      qc.invalidateQueries({ queryKey: ["os-anexos", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Cotações de material (várias por categoria, comparação de fornecedores)
  const [showCotacaoDialog, setShowCotacaoDialog] = useState(false);
  const cotacaoFileRef = useRef<HTMLInputElement>(null);
  const [extraindoCotacao, setExtraindoCotacao] = useState(false);
  const extractCotacaoFn = useServerFn(extractCotacaoFromDocument);
  const [cotacaoForm, setCotacaoForm] = useState<{
    categoria: MaterialCategoria;
    fornecedor: string;
    valor: string;
    prazo_entrega_dias: string;
    observacoes: string;
    file: File | null;
    itens: ExtractedCotacaoItem[];
  }>({
    categoria: "longos",
    fornecedor: "",
    valor: "",
    prazo_entrega_dias: "",
    observacoes: "",
    file: null,
    itens: [],
  });

  async function onSelecionarPdfCotacao(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Arquivo grande demais (máx 15MB)");
      return;
    }
    setCotacaoForm((f) => ({ ...f, file }));
    setExtraindoCotacao(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const dataBase64 = btoa(binary);
      const r = await extractCotacaoFn({
        data: { filename: file.name, mimeType: file.type || "application/pdf", dataBase64 },
      });
      if (r.itens.length === 0) {
        toast.warning("A IA não conseguiu identificar itens nesse PDF. Preencha manualmente.");
      } else {
        setCotacaoForm((f) => ({
          ...f,
          itens: r.itens,
          valor: r.valor_liquido != null ? String(r.valor_liquido) : f.valor,
        }));
        toast.success(`${r.itens.length} item(ns) extraído(s) pela IA! Revise antes de salvar.`);
      }
    } catch (e) {
      toast.error(`Falha na leitura por IA: ${(e as Error).message}. Preencha os itens manualmente.`);
    } finally {
      setExtraindoCotacao(false);
    }
  }

  function atualizarItemCotacao(idx: number, patch: Partial<ExtractedCotacaoItem>) {
    setCotacaoForm((f) => ({
      ...f,
      itens: f.itens.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  }
  function removerItemCotacao(idx: number) {
    setCotacaoForm((f) => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }));
  }
  function adicionarItemCotacaoVazio() {
    setCotacaoForm((f) => ({
      ...f,
      itens: [...f.itens, { codigo: null, descricao: "", unidade: null, quantidade: 1 }],
    }));
  }

  const addCotacao = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem sessão");
      if (!cotacaoForm.fornecedor.trim() || !cotacaoForm.valor) {
        throw new Error("Preencha fornecedor e valor.");
      }
      let anexo_id: string | null = null;
      if (cotacaoForm.file) {
        const path = `${id}/cotacoes/${Date.now()}-${cotacaoForm.file.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("os-files")
          .upload(path, cotacaoForm.file, { contentType: cotacaoForm.file.type });
        if (upErr) throw upErr;
        const { data: anexo, error: insErr } = await supabase
          .from("os_anexos")
          .insert({
            os_id: id,
            storage_path: path,
            nome: cotacaoForm.file.name,
            mime_type: cotacaoForm.file.type,
            tamanho: cotacaoForm.file.size,
            uploaded_by: user.id,
          })
          .select()
          .single();
        if (insErr) throw insErr;
        anexo_id = anexo.id;
      }
      const { data: cotacao, error } = await supabase
        .from("material_cotacoes")
        .insert({
          os_id: id,
          categoria: cotacaoForm.categoria,
          fornecedor: cotacaoForm.fornecedor.trim(),
          valor: Number(cotacaoForm.valor),
          prazo_entrega_dias: cotacaoForm.prazo_entrega_dias ? Number(cotacaoForm.prazo_entrega_dias) : null,
          anexo_id,
          observacoes: cotacaoForm.observacoes.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      const itensValidos = cotacaoForm.itens.filter((it) => it.descricao.trim() && it.quantidade > 0);
      if (itensValidos.length > 0) {
        const { error: itensErr } = await supabase.from("material_cotacao_itens").insert(
          itensValidos.map((it) => ({
            cotacao_id: cotacao.id,
            descricao: it.descricao.trim(),
            quantidade: it.quantidade,
            unidade: it.unidade,
          })),
        );
        if (itensErr) throw itensErr;
      }
    },
    onSuccess: () => {
      toast.success("Cotação adicionada.");
      setShowCotacaoDialog(false);
      setCotacaoForm({
        categoria: "longos",
        fornecedor: "",
        valor: "",
        prazo_entrega_dias: "",
        observacoes: "",
        file: null,
        itens: [],
      });
      if (cotacaoFileRef.current) cotacaoFileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["material-cotacoes", id] });
      qc.invalidateQueries({ queryKey: ["os-anexos", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCotacao = useMutation({
    mutationFn: async (cotacaoId: string) => {
      const { error } = await supabase.from("material_cotacoes").delete().eq("id", cotacaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cotação removida.");
      qc.invalidateQueries({ queryKey: ["material-cotacoes", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSelecionadaCotacao = useMutation({
    mutationFn: async ({ cotacaoId, selecionada }: { cotacaoId: string; selecionada: boolean }) => {
      const { error } = await supabase.from("material_cotacoes").update({ selecionada }).eq("id", cotacaoId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["material-cotacoes", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Conferência física de material (checklist na chegada)
  const [showConferenciaDialog, setShowConferenciaDialog] = useState(false);
  const [conferenciaAtualId, setConferenciaAtualId] = useState<string | null>(null);
  const [checklistItens, setChecklistItens] = useState<
    { id: string; descricao: string; unidade: string | null; quantidade_esperada: number; veio_certo: boolean; quantidade_recebida: string; observacao: string }[]
  >([]);
  const [observacoesGeraisConferencia, setObservacoesGeraisConferencia] = useState("");

  const iniciarConferenciaMutation = useMutation({
    mutationFn: async (cotacaoId: string) => iniciarConferenciaFn({ data: { cotacaoId } }),
    onSuccess: (conf) => {
      qc.invalidateQueries({ queryKey: ["material-conferencias", id] });
      setConferenciaAtualId(conf.id);
      setObservacoesGeraisConferencia("");
      setChecklistItens(
        (conf.material_conferencia_itens ?? []).map((it) => ({
          id: it.id,
          descricao: it.descricao,
          unidade: it.unidade,
          quantidade_esperada: it.quantidade_esperada,
          veio_certo: true,
          quantidade_recebida: String(it.quantidade_esperada),
          observacao: "",
        })),
      );
      setShowConferenciaDialog(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function abrirConferenciaExistente(conf: NonNullable<typeof conferencias>[number]) {
    setConferenciaAtualId(conf.id);
    setObservacoesGeraisConferencia(conf.observacoes ?? "");
    setChecklistItens(
      (conf.material_conferencia_itens ?? []).map((it) => ({
        id: it.id,
        descricao: it.descricao,
        unidade: it.unidade,
        quantidade_esperada: it.quantidade_esperada,
        veio_certo: it.veio_certo ?? true,
        quantidade_recebida: String(it.quantidade_recebida ?? it.quantidade_esperada),
        observacao: it.observacao ?? "",
      })),
    );
    setShowConferenciaDialog(true);
  }

  const concluirConferenciaMutation = useMutation({
    mutationFn: async () => {
      if (!conferenciaAtualId) throw new Error("Nenhuma conferência aberta");
      return concluirConferenciaFn({
        data: {
          conferenciaId: conferenciaAtualId,
          itens: checklistItens.map((it) => ({
            id: it.id,
            veio_certo: it.veio_certo,
            quantidade_recebida: it.quantidade_recebida ? Number(it.quantidade_recebida) : null,
            observacao: it.veio_certo ? null : it.observacao || null,
          })),
          observacoesGerais: observacoesGeraisConferencia || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Conferência concluída. E-mail enviado pra admin/PCP.");
      setShowConferenciaDialog(false);
      setConferenciaAtualId(null);
      qc.invalidateQueries({ queryKey: ["material-conferencias", id] });
      qc.invalidateQueries({ queryKey: ["os-etapas", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function imprimirChecklist(cotacao: { fornecedor: string; categoria: MaterialCategoria }) {
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("O navegador bloqueou a janela de impressão.");
      return;
    }
    const linhas = checklistItens
      .map(
        (it) => `
        <tr>
          <td style="border:1px solid #999;padding:6px 8px;">${it.descricao}</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:center;">${it.quantidade_esperada}${it.unidade ? " " + it.unidade : ""}</td>
          <td style="border:1px solid #999;padding:6px 8px;text-align:center;width:60px;"><div style="width:22px;height:22px;border:2px solid #333;margin:0 auto;"></div></td>
        </tr>`,
      )
      .join("");
    win.document.write(`
      <html>
        <head>
          <title>Checklist de conferência</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            p { margin: 2px 0; font-size: 13px; color: #333; }
            table { border-collapse: collapse; width: 100%; margin-top: 16px; }
            th { border: 1px solid #999; padding: 6px 8px; background: #eee; text-align: left; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>Checklist de conferência de material — O.S. ${os?.numero_os ?? ""}</h1>
          <p><b>Categoria:</b> ${MATERIAL_CATEGORIA_LABEL[cotacao.categoria]}</p>
          <p><b>Fornecedor:</b> ${cotacao.fornecedor}</p>
          <p><b>Data:</b> ${new Date().toLocaleDateString("pt-BR")}</p>
          <table>
            <thead><tr><th>Item</th><th>Qtd. pedida</th><th>Veio certo?</th></tr></thead>
            <tbody>${linhas}</tbody>
          </table>
          <p style="margin-top:24px;">Conferido por: _______________________________</p>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  const [novoComentario, setNovoComentario] = useState("");
  const addComentario = useMutation({
    mutationFn: async () => {
      if (!novoComentario.trim() || !user) return;
      const { error } = await supabase
        .from("os_comentarios")
        .insert({ os_id: id, user_id: user.id, texto: novoComentario.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovoComentario("");
      qc.invalidateQueries({ queryKey: ["os-comentarios", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeOs = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ordens_servico").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("O.S. excluída");
      navigate({ to: "/ordens" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !os) return <div className="p-6 text-muted-foreground">Carregando O.S...</div>;

  const atrasada = isAtrasada(os.data_entrega_prev, os.data_entrega_real, os.status);
  const dias = diffDays(
    os.data_entrega_prev,
    os.data_entrega_real ?? new Date().toISOString().slice(0, 10),
  );

  const setField = (k: string, v: unknown) => setEdit((e) => ({ ...e, [k]: v }));
  const val = (k: string) => (merged as Record<string, unknown>)[k];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/ordens" })}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Ordens
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">O.S. {os.numero_os}</h1>
              <Badge variant="outline" className={OS_STATUS_CLASS[os.status]}>
                {OS_STATUS_LABEL[os.status]}
              </Badge>
              {atrasada && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Atrasada
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {os.clientes?.nome && (
                <Link
                  to="/clientes/$id"
                  params={{ id: os.clientes.id }}
                  className="hover:underline"
                >
                  {os.clientes.nome}
                </Link>
              )}
              {os.projeto && <> • {os.projeto}</>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => confirm("Excluir esta O.S.?") && removeOs.mutate()}
          >
            Excluir
          </Button>
          {Object.keys(edit).length > 0 && (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {save.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard label="Valor total" value={formatBRL(Number(os.valor_total))} />
        <SummaryCard
          label="Entrega prevista"
          value={formatDate(os.data_entrega_prev)}
          tone={atrasada ? "danger" : undefined}
        />
        <SummaryCard
          label={os.data_entrega_real ? "Entregue em" : "Prazo (dias)"}
          value={
            os.data_entrega_real
              ? formatDate(os.data_entrega_real)
              : dias == null
                ? "—"
                : `${dias > 0 ? "+" : ""}${dias} dias`
          }
          tone={dias != null && dias > 0 && !os.data_entrega_real ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Section title="Identificação">
                <Field label="Nº O.S.">
                  <Input
                    value={String(val("numero_os") ?? "")}
                    onChange={(e) => setField("numero_os", e.target.value)}
                  />
                </Field>
                <Field label="Nº orçamento (SS)">
                  <Input
                    value={String(val("numero_ss") ?? "")}
                    onChange={(e) => setField("numero_ss", e.target.value)}
                  />
                </Field>
                <Field label="Nº pedido">
                  <Input
                    value={String(val("numero_pedido") ?? "")}
                    onChange={(e) => setField("numero_pedido", e.target.value)}
                  />
                </Field>
                <Field label="Projeto">
                  <Input
                    value={String(val("projeto") ?? "")}
                    onChange={(e) => setField("projeto", e.target.value)}
                  />
                </Field>
              </Section>
              <Section title="Cliente e responsáveis">
                <Field label="Cliente">
                  <Select
                    value={String(val("cliente_id") ?? "")}
                    onValueChange={(v) => setField("cliente_id", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(clientes ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Solicitante">
                  <Input
                    value={String(val("solicitante") ?? "")}
                    onChange={(e) => setField("solicitante", e.target.value)}
                  />
                </Field>
                <Field label="Gestor(a)">
                  <Input
                    value={String(val("gestor") ?? "")}
                    onChange={(e) => setField("gestor", e.target.value)}
                  />
                </Field>
                <Field label="Orçamentista">
                  <Input
                    value={String(val("orcamentista") ?? "")}
                    onChange={(e) => setField("orcamentista", e.target.value)}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={String(val("status"))}
                    onValueChange={(v) => setField("status", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OS_STATUS_LIST.map((s) => (
                        <SelectItem key={s} value={s}>
                          {OS_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </Section>
              <Section title="Prazos e quantidades">
                <Field label="Início previsto">
                  <Input
                    type="date"
                    value={String(val("data_inicio_prev") ?? "")}
                    onChange={(e) => setField("data_inicio_prev", e.target.value)}
                  />
                </Field>
                <Field label="Entrega prevista">
                  <Input
                    type="date"
                    value={String(val("data_entrega_prev") ?? "")}
                    onChange={(e) => setField("data_entrega_prev", e.target.value)}
                  />
                </Field>
                <Field label="Entrega real">
                  <Input
                    type="date"
                    value={String(val("data_entrega_real") ?? "")}
                    onChange={(e) => setField("data_entrega_real", e.target.value)}
                  />
                </Field>
                <Field label="Unidade">
                  <Input
                    value={String(val("unidade") ?? "")}
                    onChange={(e) => setField("unidade", e.target.value)}
                  />
                </Field>
                <Field label="Quantidade">
                  <Input
                    type="number"
                    step="0.001"
                    value={String(val("quantidade") ?? "")}
                    onChange={(e) =>
                      setField("quantidade", e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </Field>
                <Field label="Peso (kg)">
                  <Input
                    type="number"
                    step="0.001"
                    value={String(val("peso_kg") ?? "")}
                    onChange={(e) =>
                      setField("peso_kg", e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </Field>
              </Section>
              <Section title="Valores e entrega">
                <Field label="Valor unitário">
                  <Input
                    type="number"
                    step="0.01"
                    value={String(val("valor_unit") ?? "")}
                    onChange={(e) =>
                      setField("valor_unit", e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </Field>
                <Field label="Valor total">
                  <Input
                    type="number"
                    step="0.01"
                    value={String(val("valor_total") ?? "")}
                    onChange={(e) =>
                      setField("valor_total", e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </Field>
                <Field label="Local de entrega">
                  <Input
                    value={String(val("local_entrega") ?? "")}
                    onChange={(e) => setField("local_entrega", e.target.value)}
                  />
                </Field>
                <Field label="Frete">
                  <Input
                    value={String(val("tipo_frete") ?? "")}
                    onChange={(e) => setField("tipo_frete", e.target.value)}
                  />
                </Field>
              </Section>
              <div>
                <Label>Descrição do escopo</Label>
                <Textarea
                  rows={4}
                  value={String(val("descricao") ?? "")}
                  onChange={(e) => setField("descricao", e.target.value)}
                />
              </div>
              <div>
                <Label>Fora de escopo</Label>
                <Textarea
                  rows={2}
                  value={String(val("fora_escopo") ?? "")}
                  onChange={(e) => setField("fora_escopo", e.target.value)}
                />
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
                const e = etapas?.find((x) => x.tipo === tipo);
                const done = e?.status === "concluido";
                const editavel = canEditEtapa(roles, tipo);
                const pedidoCompraAnexo = anexos?.find((a) => a.id === e?.pedido_compra_anexo_id);
                const notaFiscalCompraAnexo = anexos?.find((a) => a.id === e?.nota_fiscal_compra_anexo_id);
                const cotacoesDaOs = cotacoes ?? [];

                return (
                  <div key={tipo} className="flex items-start gap-3">
                    <button
                      onClick={() =>
                        editavel &&
                        updateEtapa.mutate({
                          tipo,
                          data: e?.data ?? new Date().toISOString().slice(0, 10),
                          status: done ? "pendente" : "concluido",
                        })
                      }
                      disabled={!editavel}
                      className="mt-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        !editavel
                          ? "Seu perfil não pode editar esta etapa"
                          : done
                          ? "Marcar como pendente"
                          : "Marcar como concluído"
                      }
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="text-sm font-medium">{ETAPA_LABEL[tipo]}</div>
                      <Input
                        type="date"
                        className="h-8 mt-1"
                        value={e?.data ?? ""}
                        disabled={!editavel}
                        onChange={(ev) =>
                          updateEtapa.mutate({
                            tipo,
                            data: ev.target.value || null,
                            status: e?.status ?? "pendente",
                          })
                        }
                      />

                      {/* Campos extras — só na etapa de solicitação de material (almoxarifado) */}
                      {tipo === "solicitacao_material" && (
                        <div className="space-y-2 pt-1">
                          <div>
                            <Label className="text-xs text-muted-foreground">Data do pedido de material</Label>
                            <Input
                              type="date"
                              className="h-8 mt-1"
                              value={e?.data_pedido ?? ""}
                              disabled={!editavel}
                              onChange={(ev) =>
                                updateEtapaExtra.mutate({
                                  tipo,
                                  patch: { data_pedido: ev.target.value || null },
                                })
                              }
                            />
                          </div>

                          <div className="rounded-md border p-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-medium flex items-center gap-1">
                                <Package className="h-3.5 w-3.5" /> Cotações de material
                              </div>
                              {editavel && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  onClick={() => setShowCotacaoDialog(true)}
                                >
                                  <Plus className="h-3.5 w-3.5 mr-1" /> Cotação
                                </Button>
                              )}
                            </div>
                            {cotacoesDaOs.length === 0 ? (
                              <div className="text-xs text-muted-foreground">Nenhuma cotação ainda.</div>
                            ) : (
                              MATERIAL_CATEGORIA_LIST.filter((cat) =>
                                cotacoesDaOs.some((c) => c.categoria === cat),
                              ).map((cat) => (
                                <div key={cat} className="space-y-1">
                                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    {MATERIAL_CATEGORIA_LABEL[cat]}
                                  </div>
                                  {cotacoesDaOs
                                    .filter((c) => c.categoria === cat)
                                    .map((c) => (
                                      <div
                                        key={c.id}
                                        className="flex items-center justify-between gap-2 text-xs rounded border px-2 py-1"
                                      >
                                        <button
                                          disabled={!editavel}
                                          onClick={() =>
                                            toggleSelecionadaCotacao.mutate({
                                              cotacaoId: c.id,
                                              selecionada: !c.selecionada,
                                            })
                                          }
                                          title={c.selecionada ? "Selecionada" : "Marcar como selecionada"}
                                          className="disabled:opacity-40"
                                        >
                                          <Star
                                            className={`h-3.5 w-3.5 ${c.selecionada ? "fill-warning text-warning" : "text-muted-foreground"}`}
                                          />
                                        </button>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium truncate">{c.fornecedor}</div>
                                          <div className="text-muted-foreground">
                                            {formatBRL(c.valor)}
                                            {c.prazo_entrega_dias != null && ` · ${c.prazo_entrega_dias}d`}
                                          </div>
                                        </div>
                                        {editavel && (
                                          <button onClick={() => removeCotacao.mutate(c.id)} title="Remover cotação">
                                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* Campos extras — só na etapa de chegada de material (almoxarifado) */}
                      {tipo === "chegada_material" && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs">
                            <span className="flex items-center gap-1 truncate">
                              <Paperclip className="h-3.5 w-3.5" />
                              {pedidoCompraAnexo ? pedidoCompraAnexo.nome : "Pedido de compra — sem anexo"}
                            </span>
                            {editavel && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2"
                                onClick={() => pedidoCompraFileRef.current?.click()}
                              >
                                <Upload className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <input
                              ref={pedidoCompraFileRef}
                              type="file"
                              className="hidden"
                              onChange={(ev) => {
                                const f = ev.target.files?.[0];
                                if (f) uploadEtapaAnexo.mutate({ file: f, tipo, column: "pedido_compra_anexo_id" });
                                ev.target.value = "";
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs">
                            <span className="flex items-center gap-1 truncate">
                              <Receipt className="h-3.5 w-3.5" />
                              {notaFiscalCompraAnexo ? notaFiscalCompraAnexo.nome : "Nota fiscal de compra — sem anexo"}
                            </span>
                            {editavel && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2"
                                onClick={() => notaFiscalCompraFileRef.current?.click()}
                              >
                                <Upload className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <input
                              ref={notaFiscalCompraFileRef}
                              type="file"
                              className="hidden"
                              onChange={(ev) => {
                                const f = ev.target.files?.[0];
                                if (f)
                                  uploadEtapaAnexo.mutate({ file: f, tipo, column: "nota_fiscal_compra_anexo_id" });
                                ev.target.value = "";
                              }}
                            />
                          </div>

                          <div className="rounded-md border p-2 space-y-2">
                            <div className="text-xs font-medium flex items-center gap-1">
                              <ClipboardCheck className="h-3.5 w-3.5" /> Conferência física de material
                            </div>
                            {cotacoesDaOs.filter((c) => c.selecionada).length === 0 ? (
                              <div className="text-xs text-muted-foreground">
                                Nenhuma cotação fechada ainda — marque uma cotação como selecionada na etapa
                                de solicitação de material pra liberar a conferência.
                              </div>
                            ) : (
                              cotacoesDaOs
                                .filter((c) => c.selecionada)
                                .map((c) => {
                                  const conf = conferencias?.find((cf) => cf.cotacao_id === c.id);
                                  return (
                                    <div
                                      key={c.id}
                                      className="flex items-center justify-between gap-2 text-xs rounded border px-2 py-1.5"
                                    >
                                      <div className="min-w-0">
                                        <div className="font-medium truncate">
                                          {MATERIAL_CATEGORIA_LABEL[c.categoria]} · {c.fornecedor}
                                        </div>
                                        {conf?.status === "concluida" && (
                                          <div
                                            className={`flex items-center gap-1 mt-0.5 ${conf.resultado === "ok" ? "text-success" : "text-destructive"}`}
                                          >
                                            {conf.resultado === "ok" ? (
                                              <CheckCircle2 className="h-3 w-3" />
                                            ) : (
                                              <AlertTriangle className="h-3 w-3" />
                                            )}
                                            {conf.resultado === "ok" ? "Conferido — tudo certo" : "Conferido — divergência"}
                                          </div>
                                        )}
                                        {conf?.status === "em_andamento" && (
                                          <div className="text-muted-foreground mt-0.5">Conferência em andamento</div>
                                        )}
                                      </div>
                                      {editavel && (
                                        <div className="flex items-center gap-1 shrink-0">
                                          {!conf && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 px-2"
                                              onClick={() => iniciarConferenciaMutation.mutate(c.id)}
                                              disabled={iniciarConferenciaMutation.isPending}
                                            >
                                              Iniciar conferência
                                            </Button>
                                          )}
                                          {conf?.status === "em_andamento" && (
                                            <>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2"
                                                onClick={() => imprimirChecklist(c)}
                                                title="Imprimir checklist"
                                              >
                                                <Printer className="h-3.5 w-3.5" />
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 px-2"
                                                onClick={() => abrirConferenciaExistente(conf)}
                                              >
                                                Continuar
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comentários
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={2}
                placeholder="Adicione um comentário..."
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!novoComentario.trim() || addComentario.isPending}
                  onClick={() => addComentario.mutate()}
                >
                  Publicar
                </Button>
              </div>
              <Separator />
              <ul className="space-y-3 max-h-80 overflow-auto pr-1">
                {(comentarios ?? []).length === 0 && (
                  <li className="text-sm text-muted-foreground">Nenhum comentário ainda.</li>
                )}
                {(comentarios ?? []).map((c) => (
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

          <Card
            className={notasFiscais && notasFiscais.length > 0 ? "border-success/40" : undefined}
          >
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Notas Fiscais / Faturamento real
              </CardTitle>
              <CardDescription>
                Anexe uma ou mais notas fiscais (PDF) desta O.S. — útil para faturamento parcelado.
                {notasFiscais && notasFiscais.length > 0 && (
                  <>
                    {" "}
                    Total faturado: <b className="text-foreground">
                      {formatBRL(totalFaturadoNf)}
                    </b>{" "}
                    em {notasFiscais.length} nota{notasFiscais.length === 1 ? "" : "s"}.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {notasFiscais && notasFiscais.length > 0 && (
                <ul className="space-y-2">
                  {notasFiscais.map((nf) => (
                    <li
                      key={nf.id}
                      className="flex items-center justify-between gap-2 text-sm border rounded-md p-2"
                    >
                      <button
                        className="flex-1 min-w-0 text-left hover:underline"
                        onClick={() => baixarNf(nf.storage_path, nf.nome_arquivo)}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {nf.numero_nota_fiscal
                              ? `NF ${nf.numero_nota_fiscal}`
                              : nf.nome_arquivo}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(nf.data_emissao)} · {formatBRL(nf.valor)}
                        </div>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        onClick={() => baixarNf(nf.storage_path, nf.nome_arquivo)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-destructive"
                        onClick={() =>
                          confirm("Remover esta nota fiscal?") &&
                          removerNf.mutate({ id: nf.id, storage_path: nf.storage_path })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <input
                ref={nfFileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onSelecionarNf(f);
                }}
              />

              {!nfFormAberto ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={nfProcessando}
                  onClick={() => nfFileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Anexar nota fiscal (PDF)
                </Button>
              ) : (
                <div className="space-y-3 border rounded-md p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 min-w-0 truncate">
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                      {nfArquivo?.name}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={cancelarNf}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {nfProcessando ? (
                    <p className="text-sm text-muted-foreground">
                      Analisando a nota fiscal com IA...
                    </p>
                  ) : (
                    <>
                      {!nfExtraiuAlgo && (
                        <div className="flex items-start gap-2 text-xs text-warning-foreground bg-warning/10 border border-warning/30 rounded-md p-2">
                          <FileWarning className="h-3.5 w-3.5 shrink-0 mt-0.5" />A IA não conseguiu
                          identificar os dados desta nota (documento ilegível ou fora do padrão).
                          Preencha os campos manualmente.
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Confira os dados extraídos pela IA antes de salvar — sempre revise antes de
                        confirmar.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Data de emissão</Label>
                          <Input
                            type="date"
                            value={nfData}
                            onChange={(e) => setNfData(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Valor total (R$)</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={nfValor}
                            onChange={(e) => setNfValor(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Número da NF (opcional)</Label>
                        <Input
                          type="text"
                          value={nfNumero}
                          onChange={(e) => setNfNumero(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5"
                          disabled={salvarNf.isPending}
                          onClick={() => salvarNf.mutate()}
                        >
                          <Save className="h-3.5 w-3.5" />
                          {salvarNf.isPending ? "Salvando..." : "Salvar nota fiscal"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelarNf}>
                          Cancelar
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Anexos
              </CardTitle>
              <CardDescription>PDFs, imagens, planilhas do pedido.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    uploadAnexo.mutate(f);
                    e.target.value = "";
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2"
                disabled={uploadAnexo.isPending}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploadAnexo.isPending ? "Enviando..." : "Enviar arquivo"}
              </Button>
              <ul className="space-y-2 max-h-72 overflow-auto pr-1">
                {(anexos ?? []).length === 0 && (
                  <li className="text-sm text-muted-foreground">Nenhum anexo.</li>
                )}
                {(anexos ?? []).map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm border rounded-md p-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <button
                      className="flex-1 min-w-0 text-left hover:underline truncate"
                      onClick={() => downloadAnexo(a.storage_path, a.nome)}
                    >
                      {a.nome}
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => downloadAnexo(a.storage_path, a.nome)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() =>
                        confirm("Remover anexo?") &&
                        removeAnexo.mutate({ id: a.id, storage_path: a.storage_path })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico de versões
              </CardTitle>
              <CardDescription>Auditoria de alterações da O.S.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 max-h-96 overflow-auto pr-1">
                {(historico ?? []).length === 0 && (
                  <li className="text-sm text-muted-foreground">Sem histórico.</li>
                )}
                {(historico ?? []).map((h) => (
                  <li key={h.id} className="text-xs border-l-2 border-primary/30 pl-3">
                    <div className="flex justify-between text-muted-foreground">
                      <span className="font-medium text-foreground">{h.autor}</span>
                      <span>{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="text-foreground mt-0.5 font-medium capitalize">
                      {h.acao.replace(/_/g, " ")}
                    </div>
                    {h.payload && typeof h.payload === "object" && (
                      <ul className="mt-1 space-y-0.5">
                        {Object.entries(h.payload as Record<string, unknown>).map(([k, v]) => {
                          const change = v as { de?: unknown; para?: unknown };
                          if (change && typeof change === "object" && "de" in change) {
                            return (
                              <li key={k} className="text-muted-foreground">
                                <b className="text-foreground">{k}:</b> {String(change.de ?? "—")} →{" "}
                                {String(change.para ?? "—")}
                              </li>
                            );
                          }
                          return (
                            <li key={k} className="text-muted-foreground">
                              <b className="text-foreground">{k}:</b> {String(v)}
                            </li>
                          );
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

      <Dialog open={showCotacaoDialog} onOpenChange={setShowCotacaoDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova cotação de material</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-dashed p-3 text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                Anexe o PDF do pedido de cotação (modelo padrão) e a IA lista os itens automaticamente.
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => cotacaoFileRef.current?.click()}
                disabled={extraindoCotacao}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {extraindoCotacao ? "Lendo PDF..." : cotacaoForm.file ? "Trocar PDF" : "Anexar PDF e extrair itens"}
              </Button>
              {cotacaoForm.file && (
                <p className="text-xs text-muted-foreground truncate">{cotacaoForm.file.name}</p>
              )}
              <input
                ref={cotacaoFileRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f) onSelecionarPdfCotacao(f);
                }}
              />
            </div>

            <div>
              <Label>Categoria</Label>
              <Select
                value={cotacaoForm.categoria}
                onValueChange={(v) => setCotacaoForm((f) => ({ ...f, categoria: v as MaterialCategoria }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_CATEGORIA_LIST.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {MATERIAL_CATEGORIA_LABEL[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input
                className="mt-1"
                value={cotacaoForm.fornecedor}
                onChange={(ev) => setCotacaoForm((f) => ({ ...f, fornecedor: ev.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="mt-1"
                  value={cotacaoForm.valor}
                  onChange={(ev) => setCotacaoForm((f) => ({ ...f, valor: ev.target.value }))}
                />
              </div>
              <div>
                <Label>Prazo de entrega (dias)</Label>
                <Input
                  type="number"
                  className="mt-1"
                  value={cotacaoForm.prazo_entrega_dias}
                  onChange={(ev) => setCotacaoForm((f) => ({ ...f, prazo_entrega_dias: ev.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                rows={2}
                className="mt-1"
                value={cotacaoForm.observacoes}
                onChange={(ev) => setCotacaoForm((f) => ({ ...f, observacoes: ev.target.value }))}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Itens</Label>
                <Button type="button" size="sm" variant="ghost" className="h-6 px-2" onClick={adicionarItemCotacaoVazio}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> item
                </Button>
              </div>
              {cotacaoForm.itens.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum item ainda. Anexe o PDF acima ou adicione manualmente.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {cotacaoForm.itens.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <Input
                        className="h-8 flex-1"
                        placeholder="Descrição"
                        value={it.descricao}
                        onChange={(ev) => atualizarItemCotacao(idx, { descricao: ev.target.value })}
                      />
                      <Input
                        className="h-8 w-20"
                        type="number"
                        placeholder="Qtd"
                        value={it.quantidade}
                        onChange={(ev) => atualizarItemCotacao(idx, { quantidade: Number(ev.target.value) })}
                      />
                      <Input
                        className="h-8 w-16"
                        placeholder="Un"
                        value={it.unidade ?? ""}
                        onChange={(ev) => atualizarItemCotacao(idx, { unidade: ev.target.value || null })}
                      />
                      <button onClick={() => removerItemCotacao(idx)} title="Remover item">
                        <XIcon className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCotacaoDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => addCotacao.mutate()} disabled={addCotacao.isPending}>
              {addCotacao.isPending ? "Salvando..." : "Salvar cotação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConferenciaDialog} onOpenChange={setShowConferenciaDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conferência de material</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {checklistItens.map((it, idx) => (
              <div key={it.id} className="rounded-md border p-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm min-w-0">
                    <div className="font-medium truncate">{it.descricao}</div>
                    <div className="text-xs text-muted-foreground">
                      Pedido: {it.quantidade_esperada}
                      {it.unidade ? ` ${it.unidade}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant={it.veio_certo ? "default" : "outline"}
                      className="h-7 px-2"
                      onClick={() =>
                        setChecklistItens((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, veio_certo: true } : x)),
                        )
                      }
                    >
                      Certo
                    </Button>
                    <Button
                      size="sm"
                      variant={!it.veio_certo ? "destructive" : "outline"}
                      className="h-7 px-2"
                      onClick={() =>
                        setChecklistItens((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, veio_certo: false } : x)),
                        )
                      }
                    >
                      Errado
                    </Button>
                  </div>
                </div>
                {!it.veio_certo && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      className="h-8"
                      type="number"
                      placeholder="Qtd. recebida"
                      value={it.quantidade_recebida}
                      onChange={(ev) =>
                        setChecklistItens((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, quantidade_recebida: ev.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      className="h-8"
                      placeholder="O que veio errado?"
                      value={it.observacao}
                      onChange={(ev) =>
                        setChecklistItens((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, observacao: ev.target.value } : x)),
                        )
                      }
                    />
                  </div>
                )}
              </div>
            ))}
            <div>
              <Label>Observações gerais</Label>
              <Textarea
                rows={2}
                className="mt-1"
                value={observacoesGeraisConferencia}
                onChange={(ev) => setObservacoesGeraisConferencia(ev.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConferenciaDialog(false)}>
              Fechar
            </Button>
            <Button onClick={() => concluirConferenciaMutation.mutate()} disabled={concluirConferenciaMutation.isPending}>
              {concluirConferenciaMutation.isPending ? "Salvando..." : "Concluir conferência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success";
}) {
  const cls =
    tone === "danger"
      ? "text-destructive"
      : tone === "success"
        ? "text-success"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-xl font-semibold mt-1 ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        {title}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
