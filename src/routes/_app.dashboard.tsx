import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  OS_STATUS_LABEL,
  OS_STATUS_CLASS,
  ETAPA_LABEL,
  ETAPA_ORDER,
  formatBRL,
  formatDate,
  isAtrasada,
  diffDays,
  type OsStatus,
  type EtapaTipo,
} from "@/lib/os-utils";
import {
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Wallet,
  Timer,
  TrendingUp,
  X,
  PauseCircle,
  Receipt,
  PackageCheck,
  Gauge,
  ListChecks,
} from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Sartori Group" }] }),
  component: DashboardPage,
});

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-os"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select(
          "id, numero_os, cliente_id, status, valor_total, data_inicio_prev, data_entrega_prev, data_entrega_real, valor_faturado_real, data_faturamento_real, created_at, updated_at, clientes(nome)",
        )
        .order("data_entrega_prev", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: etapasData } = useQuery({
    queryKey: ["dashboard-os-etapas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("os_etapas").select("os_id, tipo, status, data");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-simple"],
    queryFn: async () =>
      (await supabase.from("clientes").select("id, nome").order("nome")).data ?? [],
  });

  const allRows = data ?? [];

  // Progresso de etapas por O.S: quantas das 5 etapas já estão concluídas
  const etapasPorOs = useMemo(() => {
    const map = new Map<
      string,
      { concluidas: number; total: number; proximaPendente: EtapaTipo | null }
    >();
    (etapasData ?? []).forEach((e) => {
      const cur = map.get(e.os_id) ?? { concluidas: 0, total: 0, proximaPendente: null };
      cur.total += 1;
      if (e.status === "concluido") cur.concluidas += 1;
      map.set(e.os_id, cur);
    });
    // define a próxima etapa pendente, respeitando a ordem padrão
    const etapasPorOsRaw = new Map<string, Map<EtapaTipo, string>>();
    (etapasData ?? []).forEach((e) => {
      const m = etapasPorOsRaw.get(e.os_id) ?? new Map();
      m.set(e.tipo, e.status);
      etapasPorOsRaw.set(e.os_id, m);
    });
    etapasPorOsRaw.forEach((statusMap, osId) => {
      const proxima = ETAPA_ORDER.find((tipo) => statusMap.get(tipo) !== "concluido") ?? null;
      const cur = map.get(osId);
      if (cur) cur.proximaPendente = proxima;
    });
    return map;
  }, [etapasData]);

  // ---- Filtros ----
  const [clienteId, setClienteId] = useState<string>("todos");
  const [periodo, setPeriodo] = useState<string>("todos"); // "YYYY-MM"

  const periodosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => {
      if (r.data_entrega_prev) set.add(r.data_entrega_prev.slice(0, 7));
      if (r.created_at) set.add(r.created_at.slice(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [allRows]);

  const rows = useMemo(() => {
    return allRows.filter((r) => {
      if (clienteId !== "todos" && r.cliente_id !== clienteId) return false;
      if (periodo !== "todos") {
        const matchPrev = r.data_entrega_prev?.slice(0, 7) === periodo;
        const matchCriado = r.created_at?.slice(0, 7) === periodo;
        if (!matchPrev && !matchCriado) return false;
      }
      return true;
    });
  }, [allRows, clienteId, periodo]);

  const temFiltro = clienteId !== "todos" || periodo !== "todos";

  // ---- Métricas ----
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const abertas = rows.filter((r) => !["entregue", "cancelada"].includes(r.status)).length;
  const emProducao = rows.filter((r) =>
    ["em_producao", "em_pintura", "aguardando_material"].includes(r.status),
  ).length;
  const atrasadas = rows.filter((r) =>
    isAtrasada(r.data_entrega_prev, r.data_entrega_real, r.status as OsStatus),
  );
  const entregues = rows.filter((r) => r.status === "entregue");
  const valorCarteira = rows
    .filter((r) => !["entregue", "cancelada"].includes(r.status))
    .reduce((s, r) => s + Number(r.valor_total || 0), 0);

  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(statusCounts).map(([k, v]) => ({
    name: OS_STATUS_LABEL[k as OsStatus],
    value: v,
    key: k,
  }));
  const pieColors = [
    "oklch(0.42 0.13 253)",
    "oklch(0.62 0.15 150)",
    "oklch(0.72 0.15 70)",
    "oklch(0.58 0.22 27)",
    "oklch(0.55 0.1 290)",
    "oklch(0.5 0.02 260)",
    "oklch(0.7 0.02 260)",
    "oklch(0.3 0.02 260)",
  ];

  const proximos7 = rows
    .filter(
      (r) =>
        r.data_entrega_prev &&
        r.data_entrega_prev >= today &&
        r.data_entrega_prev <= in7 &&
        !["entregue", "cancelada"].includes(r.status),
    )
    .slice(0, 8);

  const valorPorStatus = Object.entries(
    rows.reduce<Record<string, number>>((a, r) => {
      if (!["entregue", "cancelada"].includes(r.status)) {
        a[r.status] = (a[r.status] || 0) + Number(r.valor_total || 0);
      }
      return a;
    }, {}),
  )
    .map(([k, v]) => ({ name: OS_STATUS_LABEL[k as OsStatus], valor: v }))
    .sort((a, b) => b.valor - a.valor);

  // ---- Risco de atraso: compara o quanto do prazo já passou com o quanto do trabalho já foi feito ----
  const riscoAtraso = useMemo(() => {
    return rows
      .filter((r) => !["entregue", "cancelada"].includes(r.status))
      .map((r) => {
        const progresso = etapasPorOs.get(r.id);
        const totalEtapas = progresso?.total || ETAPA_ORDER.length;
        const progressoEtapas = progresso ? progresso.concluidas / totalEtapas : 0;

        const inicio = r.data_inicio_prev ?? r.created_at?.slice(0, 10) ?? today;
        const prazoTotalDias = diffDays(inicio, r.data_entrega_prev) ?? null;
        const decorridoDias = diffDays(inicio, today) ?? 0;
        const progressoTempo =
          prazoTotalDias && prazoTotalDias > 0
            ? Math.min(1.3, Math.max(0, decorridoDias / prazoTotalDias))
            : decorridoDias > 0
              ? 1.2
              : 0;

        const gap = progressoTempo - progressoEtapas; // > 0 = atrasado em relação ao ritmo necessário
        const diasRestantes = r.data_entrega_prev ? diffDays(today, r.data_entrega_prev) : null;
        const jaAtrasada = isAtrasada(
          r.data_entrega_prev,
          r.data_entrega_real,
          r.status as OsStatus,
        );

        let nivel: "alto" | "medio" | "baixo" = "baixo";
        if (!jaAtrasada) {
          if (gap > 0.35 || (diasRestantes != null && diasRestantes <= 2 && progressoEtapas < 1))
            nivel = "alto";
          else if (gap > 0.15) nivel = "medio";
        }

        return {
          ...r,
          progressoEtapas,
          progressoTempo,
          gap,
          diasRestantes,
          jaAtrasada,
          nivel,
          proximaEtapa: progresso?.proximaPendente ? ETAPA_LABEL[progresso.proximaPendente] : "—",
        };
      })
      .filter((r) => !r.jaAtrasada && r.nivel !== "baixo" && r.data_entrega_prev)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 8);
  }, [rows, etapasPorOs, today]);

  // Ranking de clientes por quantidade de O.S, destacando quantas estão atrasadas
  const rankingClientes = useMemo(() => {
    const map: Record<string, { total: number; atrasadas: number }> = {};
    rows.forEach((r) => {
      const nome = r.clientes?.nome ?? "Sem cliente";
      const cur = map[nome] ?? { total: 0, atrasadas: 0 };
      cur.total += 1;
      if (isAtrasada(r.data_entrega_prev, r.data_entrega_real, r.status as OsStatus))
        cur.atrasadas += 1;
      map[nome] = cur;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 8)
      .map(([nome, v]) => ({ nome, "No prazo": v.total - v.atrasadas, Atrasadas: v.atrasadas }));
  }, [rows]);

  // Tempo médio de conclusão (dias) e % no prazo
  const temposEntrega = entregues
    .map((r) => diffDays(r.created_at?.slice(0, 10), r.data_entrega_real))
    .filter((d): d is number => d != null);
  const tempoMedioDias = temposEntrega.length
    ? Math.round(temposEntrega.reduce((s, d) => s + d, 0) / temposEntrega.length)
    : null;

  const entreguesNoPrazo = entregues.filter(
    (r) => r.data_entrega_prev && r.data_entrega_real && r.data_entrega_real <= r.data_entrega_prev,
  ).length;
  const pctNoPrazo = entregues.length
    ? Math.round((entreguesNoPrazo / entregues.length) * 100)
    : null;

  // O.S paradas há mais tempo sem atualização (ativas, ordenadas pela atualização mais antiga)
  const paradasHaMaisTempo = useMemo(() => {
    return rows
      .filter((r) => !["entregue", "cancelada"].includes(r.status))
      .map((r) => ({ ...r, diasParada: diffDays(r.updated_at?.slice(0, 10), today) ?? 0 }))
      .sort((a, b) => b.diasParada - a.diasParada)
      .slice(0, 6);
  }, [rows, today]);

  // Tabela detalhada (ordenada por prazo, mais urgentes primeiro)
  const tabelaRows = useMemo(() => {
    return [...rows].sort((a, b) =>
      (a.data_entrega_prev ?? "9999").localeCompare(b.data_entrega_prev ?? "9999"),
    );
  }, [rows]);

  // ---- Comparativo Previsto x Realizado (entregas e faturamento) ----
  // Respeita o filtro de cliente; usa o mês selecionado no filtro (ou o mês atual, se "todos")
  const rowsPorCliente = useMemo(
    () => allRows.filter((r) => clienteId === "todos" || r.cliente_id === clienteId),
    [allRows, clienteId],
  );
  const mesReferencia = periodo !== "todos" ? periodo : today.slice(0, 7);

  function calcularComparativo(rowsBase: typeof allRows, mes: string) {
    const previstasNoMes = rowsBase.filter((r) => r.data_entrega_prev?.slice(0, 7) === mes);
    const realizadasNoMes = rowsBase.filter((r) => r.data_entrega_real?.slice(0, 7) === mes);
    const faturamentoPrevisto = previstasNoMes.reduce((s, r) => s + Number(r.valor_total || 0), 0);
    const faturamentoRealizado = rowsBase
      .filter((r) => r.data_faturamento_real?.slice(0, 7) === mes)
      .reduce((s, r) => s + Number(r.valor_faturado_real || 0), 0);
    return {
      entregasPrevistas: previstasNoMes.length,
      entregasRealizadas: realizadasNoMes.length,
      faturamentoPrevisto,
      faturamentoRealizado,
    };
  }

  const comparativoMes = calcularComparativo(rowsPorCliente, mesReferencia);
  const mesReferenciaLabel = (() => {
    const [y, m] = mesReferencia.split("-");
    return `${MESES[Number(m) - 1]}/${y}`;
  })();

  // Tendência dos últimos 6 meses (a partir do mês de referência, para trás)
  const tendenciaComparativo = useMemo(() => {
    const meses: string[] = [];
    const [y, m] = mesReferencia.split("-").map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return meses.map((mes) => {
      const c = calcularComparativo(rowsPorCliente, mes);
      const [yy, mm] = mes.split("-");
      return {
        mes: `${MESES[Number(mm) - 1]?.slice(0, 3)}/${yy.slice(2)}`,
        "Entregas previstas": c.entregasPrevistas,
        "Entregas realizadas": c.entregasRealizadas,
        "Faturamento previsto": c.faturamentoPrevisto,
        "Faturamento realizado": c.faturamentoRealizado,
      };
    });
  }, [rowsPorCliente, mesReferencia]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral da produção e das Ordens de Serviço.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {(clientes ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os períodos</SelectItem>
              {periodosDisponiveis.map((p) => {
                const [y, m] = p.split("-");
                return (
                  <SelectItem key={p} value={p}>
                    {MESES[Number(m) - 1]}/{y}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {temFiltro && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setClienteId("todos");
                setPeriodo("todos");
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={ClipboardList} label="O.S. ativas" value={abertas} tone="primary" />
        <MetricCard icon={CalendarClock} label="Em produção" value={emProducao} tone="info" />
        <MetricCard
          icon={AlertTriangle}
          label="Atrasadas"
          value={atrasadas.length}
          tone="destructive"
        />
        <MetricCard icon={CheckCircle2} label="Entregues" value={entregues.length} tone="success" />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={Timer}
          label="Tempo médio de conclusão"
          value={tempoMedioDias != null ? `${tempoMedioDias} dias` : "—"}
          tone="info"
        />
        <MetricCard
          icon={TrendingUp}
          label="Entregues no prazo"
          value={pctNoPrazo != null ? `${pctNoPrazo}%` : "—"}
          tone={pctNoPrazo != null && pctNoPrazo < 70 ? "destructive" : "success"}
        />
        <MetricCard
          icon={Wallet}
          label="Valor em carteira"
          value={formatBRL(valorCarteira)}
          tone="primary"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            Previsto x Realizado — {mesReferenciaLabel}
          </CardTitle>
          <CardDescription>
            Compara o que estava programado no mês com o que de fato aconteceu (entregas e
            faturamento, com base nas notas fiscais anexadas).
            {periodo === "todos" &&
              " Mostrando o mês atual — selecione um mês no filtro acima para comparar outro período."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <ComparativoStat
              icon={PackageCheck}
              label="Entregas previstas"
              value={comparativoMes.entregasPrevistas}
            />
            <ComparativoStat
              icon={CheckCircle2}
              label="Entregas realizadas"
              value={comparativoMes.entregasRealizadas}
              tone={
                comparativoMes.entregasRealizadas < comparativoMes.entregasPrevistas
                  ? "warning"
                  : "success"
              }
            />
            <ComparativoStat
              icon={Wallet}
              label="Faturamento previsto"
              value={formatBRL(comparativoMes.faturamentoPrevisto)}
            />
            <ComparativoStat
              icon={Receipt}
              label="Faturamento realizado"
              value={formatBRL(comparativoMes.faturamentoRealizado)}
              tone={
                comparativoMes.faturamentoRealizado < comparativoMes.faturamentoPrevisto
                  ? "warning"
                  : "success"
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-56">
              <p className="text-xs text-muted-foreground mb-1">
                Entregas — previstas x realizadas (6 meses)
              </p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={tendenciaComparativo}
                  margin={{ left: 0, right: 10, top: 5, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="Entregas previstas"
                    fill="oklch(0.7 0.02 260)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Entregas realizadas"
                    fill="oklch(0.62 0.15 150)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-56">
              <p className="text-xs text-muted-foreground mb-1">
                Faturamento — previsto x realizado (6 meses)
              </p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={tendenciaComparativo}
                  margin={{ left: 0, right: 10, top: 5, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="Faturamento previsto"
                    fill="oklch(0.7 0.02 260)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Faturamento realizado"
                    fill="oklch(0.42 0.13 253)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-primary" />
              Valor em carteira por status
            </CardTitle>
            <CardDescription>
              Total: <b className="text-foreground">{formatBRL(valorCarteira)}</b>
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valorPorStatus} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="valor" fill="oklch(0.42 0.13 253)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="h-4 w-4 text-warning-foreground" />
              Risco de atraso
            </CardTitle>
            <CardDescription>
              O.S. ativas onde o prazo está andando mais rápido que o trabalho concluído.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {riscoAtraso.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                Nenhuma O.S. em risco no momento — o ritmo de produção está acompanhando os prazos.
                🎯
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={riscoAtraso.map((r) => ({
                    nome: r.numero_os,
                    risco: Math.round(r.gap * 100),
                  }))}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} unit="%" />
                  <YAxis type="category" dataKey="nome" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => [`${v}%`, "Ritmo abaixo do necessário"]}
                    labelFormatter={(l) => `O.S. ${l}`}
                  />
                  <Bar dataKey="risco" radius={[0, 6, 6, 0]}>
                    {riscoAtraso.map((r, i) => (
                      <Cell
                        key={i}
                        fill={r.nivel === "alto" ? "oklch(0.58 0.22 27)" : "oklch(0.72 0.15 70)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-warning-foreground">
              <ListChecks className="h-4 w-4" />
              Detalhe do risco de atraso
            </CardTitle>
            <CardDescription>
              Ordenado pelo maior descompasso entre tempo decorrido e etapas concluídas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {riscoAtraso.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma O.S. em risco identificado.</p>
            ) : (
              <ul className="divide-y">
                {riscoAtraso.map((r) => (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/ordens/$id"
                        params={{ id: r.id }}
                        className="font-medium hover:underline"
                      >
                        {r.numero_os}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.clientes?.nome ?? "—"} · próxima etapa: {r.proximaEtapa}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge
                        variant={r.nivel === "alto" ? "destructive" : "outline"}
                        className={
                          r.nivel === "medio"
                            ? "bg-warning/15 text-warning-foreground border-warning/40"
                            : undefined
                        }
                      >
                        {r.nivel === "alto" ? "Risco alto" : "Risco médio"}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {r.diasRestantes != null
                          ? `${r.diasRestantes} dia${r.diasRestantes === 1 ? "" : "s"} restantes`
                          : "sem prazo definido"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">O.S. por cliente</CardTitle>
            <CardDescription>
              Ranking no período/cliente filtrado — no prazo x atrasadas
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rankingClientes}
                layout="vertical"
                margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="No prazo"
                  stackId="a"
                  fill="oklch(0.55 0.1 290)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="Atrasadas"
                  stackId="a"
                  fill="oklch(0.58 0.22 27)"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-info" />
              Entregas nos próximos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : proximos7.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma entrega prevista.</p>
            ) : (
              <ul className="divide-y">
                {proximos7.map((r) => (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/ordens/$id"
                        params={{ id: r.id }}
                        className="font-medium hover:underline"
                      >
                        {r.numero_os}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.clientes?.nome ?? "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">{formatDate(r.data_entrega_prev)}</div>
                      <Badge variant="outline" className={OS_STATUS_CLASS[r.status as OsStatus]}>
                        {OS_STATUS_LABEL[r.status as OsStatus]}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Atrasadas
            </CardTitle>
            <CardDescription>Ordens com prazo estourado.</CardDescription>
          </CardHeader>
          <CardContent>
            {atrasadas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma O.S. atrasada. 🎯</p>
            ) : (
              <ul className="divide-y">
                {atrasadas.slice(0, 8).map((r) => (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/ordens/$id"
                        params={{ id: r.id }}
                        className="font-medium hover:underline text-destructive"
                      >
                        {r.numero_os}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.clientes?.nome ?? "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-destructive">
                        Previsto: {formatDate(r.data_entrega_prev)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {OS_STATUS_LABEL[r.status as OsStatus]}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-warning-foreground">
              <PauseCircle className="h-4 w-4" />
              Paradas há mais tempo
            </CardTitle>
            <CardDescription>
              O.S. ativas sem atualização recente — possíveis gargalos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paradasHaMaisTempo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma O.S. ativa.</p>
            ) : (
              <ul className="divide-y">
                {paradasHaMaisTempo.map((r) => (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/ordens/$id"
                        params={{ id: r.id }}
                        className="font-medium hover:underline"
                      >
                        {r.numero_os}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.clientes?.nome ?? "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">
                        {r.diasParada} dia{r.diasParada === 1 ? "" : "s"} sem atualização
                      </div>
                      <Badge variant="outline" className={OS_STATUS_CLASS[r.status as OsStatus]}>
                        {OS_STATUS_LABEL[r.status as OsStatus]}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todas as O.S. do filtro aplicado</CardTitle>
          <CardDescription>
            {tabelaRows.length} ordens listadas, ordenadas por prazo de entrega.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Entregue em</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tabelaRows.map((r) => {
                  const atrasada = isAtrasada(
                    r.data_entrega_prev,
                    r.data_entrega_real,
                    r.status as OsStatus,
                  );
                  return (
                    <TableRow key={r.id} className={atrasada ? "bg-destructive/5" : undefined}>
                      <TableCell>
                        <Link
                          to="/ordens/$id"
                          params={{ id: r.id }}
                          className="font-medium hover:underline"
                        >
                          {r.numero_os}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.clientes?.nome ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={OS_STATUS_CLASS[r.status as OsStatus]}>
                          {OS_STATUS_LABEL[r.status as OsStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className={atrasada ? "text-destructive font-medium" : undefined}>
                        {formatDate(r.data_entrega_prev)}
                      </TableCell>
                      <TableCell>{formatDate(r.data_entrega_real)}</TableCell>
                      <TableCell className="text-right">{formatBRL(r.valor_total)}</TableCell>
                    </TableRow>
                  );
                })}
                {tabelaRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      Nenhuma O.S. encontrada para o filtro selecionado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComparativoStat({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone?: "neutral" | "success" | "warning";
}) {
  const toneMap = {
    neutral: "bg-muted text-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning-foreground",
  } as const;
  return (
    <div className={`rounded-lg p-3 ${toneMap[tone]}`}>
      <div className="flex items-center gap-1.5 text-xs opacity-80 mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone: "primary" | "info" | "success" | "destructive";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
  } as const;
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
