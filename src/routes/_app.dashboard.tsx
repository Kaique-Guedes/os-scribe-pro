import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { OS_STATUS_LABEL, OS_STATUS_CLASS, formatBRL, formatDate, isAtrasada, diffDays, type OsStatus } from "@/lib/os-utils";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";
import {
  AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Wallet,
  Timer, TrendingUp, X, PauseCircle,
} from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Sartori Group" }] }),
  component: DashboardPage,
});

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-os"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id, numero_os, cliente_id, status, valor_total, data_entrega_prev, data_entrega_real, created_at, updated_at, clientes(nome)")
        .order("data_entrega_prev", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-simple"],
    queryFn: async () => (await supabase.from("clientes").select("id, nome").order("nome")).data ?? [],
  });

  const allRows = data ?? [];

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
  const emProducao = rows.filter((r) => ["em_producao", "em_pintura", "aguardando_material"].includes(r.status)).length;
  const atrasadas = rows.filter((r) => isAtrasada(r.data_entrega_prev, r.data_entrega_real, r.status as OsStatus));
  const entregues = rows.filter((r) => r.status === "entregue");
  const valorCarteira = rows.filter((r) => !["entregue", "cancelada"].includes(r.status))
    .reduce((s, r) => s + Number(r.valor_total || 0), 0);

  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(statusCounts).map(([k, v]) => ({ name: OS_STATUS_LABEL[k as OsStatus], value: v, key: k }));
  const pieColors = ["oklch(0.42 0.13 253)", "oklch(0.62 0.15 150)", "oklch(0.72 0.15 70)", "oklch(0.58 0.22 27)", "oklch(0.55 0.1 290)", "oklch(0.5 0.02 260)", "oklch(0.7 0.02 260)", "oklch(0.3 0.02 260)"];

  const proximos7 = rows.filter((r) => r.data_entrega_prev && r.data_entrega_prev >= today && r.data_entrega_prev <= in7
    && !["entregue", "cancelada"].includes(r.status)).slice(0, 8);

  const valorPorStatus = Object.entries(rows.reduce<Record<string, number>>((a, r) => {
    if (!["entregue", "cancelada"].includes(r.status)) {
      a[r.status] = (a[r.status] || 0) + Number(r.valor_total || 0);
    }
    return a;
  }, {})).map(([k, v]) => ({ name: OS_STATUS_LABEL[k as OsStatus], valor: v }));

  // Evolução mensal: abertas (created_at) vs entregues (data_entrega_real)
  const evolucaoMensal = useMemo(() => {
    const map: Record<string, { abertas: number; entregues: number }> = {};
    rows.forEach((r) => {
      if (r.created_at) {
        const k = r.created_at.slice(0, 7);
        map[k] = map[k] || { abertas: 0, entregues: 0 };
        map[k].abertas += 1;
      }
      if (r.data_entrega_real) {
        const k = r.data_entrega_real.slice(0, 7);
        map[k] = map[k] || { abertas: 0, entregues: 0 };
        map[k].entregues += 1;
      }
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([k, v]) => {
        const [y, m] = k.split("-");
        return { mes: `${MESES[Number(m) - 1]?.slice(0, 3)}/${y.slice(2)}`, ...v };
      });
  }, [rows]);

  // Ranking de clientes por quantidade de O.S
  const rankingClientes = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((r) => {
      const nome = r.clientes?.nome ?? "Sem cliente";
      map[nome] = (map[nome] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([nome, total]) => ({ nome, total }));
  }, [rows]);

  // Tempo médio de conclusão (dias) e % no prazo
  const temposEntrega = entregues
    .map((r) => diffDays(r.created_at?.slice(0, 10), r.data_entrega_real))
    .filter((d): d is number => d != null);
  const tempoMedioDias = temposEntrega.length
    ? Math.round(temposEntrega.reduce((s, d) => s + d, 0) / temposEntrega.length)
    : null;

  const entreguesNoPrazo = entregues.filter((r) => r.data_entrega_prev && r.data_entrega_real && r.data_entrega_real <= r.data_entrega_prev).length;
  const pctNoPrazo = entregues.length ? Math.round((entreguesNoPrazo / entregues.length) * 100) : null;

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
    return [...rows].sort((a, b) => (a.data_entrega_prev ?? "9999").localeCompare(b.data_entrega_prev ?? "9999"));
  }, [rows]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral da produção e das Ordens de Serviço.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {(clientes ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
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
                return <SelectItem key={p} value={p}>{MESES[Number(m) - 1]}/{y}</SelectItem>;
              })}
            </SelectContent>
          </Select>

          {temFiltro && (
            <Button variant="ghost" size="sm" onClick={() => { setClienteId("todos"); setPeriodo("todos"); }}>
              <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={ClipboardList} label="O.S. ativas" value={abertas} tone="primary" />
        <MetricCard icon={CalendarClock} label="Em produção" value={emProducao} tone="info" />
        <MetricCard icon={AlertTriangle} label="Atrasadas" value={atrasadas.length} tone="destructive" />
        <MetricCard icon={CheckCircle2} label="Entregues" value={entregues.length} tone="success" />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <MetricCard icon={Timer} label="Tempo médio de conclusão" value={tempoMedioDias != null ? `${tempoMedioDias} dias` : "—"} tone="info" />
        <MetricCard icon={TrendingUp} label="Entregues no prazo" value={pctNoPrazo != null ? `${pctNoPrazo}%` : "—"} tone={pctNoPrazo != null && pctNoPrazo < 70 ? "destructive" : "success"} />
        <MetricCard icon={Wallet} label="Valor em carteira" value={formatBRL(valorCarteira)} tone="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-primary" />Valor em carteira por status</CardTitle>
            <CardDescription>Total: <b className="text-foreground">{formatBRL(valorCarteira)}</b></CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valorPorStatus} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="valor" fill="oklch(0.42 0.13 253)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">O.S. por status</CardTitle>
            <CardDescription>{rows.length} ordens no total</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Evolução mensal (abertas x entregues)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoMensal} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="abertas" name="Abertas" stroke="oklch(0.42 0.13 253)" strokeWidth={2} />
                <Line type="monotone" dataKey="entregues" name="Entregues" stroke="oklch(0.62 0.15 150)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">O.S. por cliente</CardTitle>
            <CardDescription>Ranking no período/cliente filtrado</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankingClientes} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="oklch(0.55 0.1 290)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4 text-info" />Entregas nos próximos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> :
              proximos7.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma entrega prevista.</p> :
                <ul className="divide-y">
                  {proximos7.map((r) => (
                    <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Link to="/ordens/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.numero_os}</Link>
                        <div className="text-xs text-muted-foreground truncate">{r.clientes?.nome ?? "—"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">{formatDate(r.data_entrega_prev)}</div>
                        <Badge variant="outline" className={OS_STATUS_CLASS[r.status as OsStatus]}>{OS_STATUS_LABEL[r.status as OsStatus]}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>}
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" />Atrasadas</CardTitle>
            <CardDescription>Ordens com prazo estourado.</CardDescription>
          </CardHeader>
          <CardContent>
            {atrasadas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma O.S. atrasada. 🎯</p> :
              <ul className="divide-y">
                {atrasadas.slice(0, 8).map((r) => (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link to="/ordens/$id" params={{ id: r.id }} className="font-medium hover:underline text-destructive">{r.numero_os}</Link>
                      <div className="text-xs text-muted-foreground truncate">{r.clientes?.nome ?? "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-destructive">Previsto: {formatDate(r.data_entrega_prev)}</div>
                      <div className="text-xs text-muted-foreground">{OS_STATUS_LABEL[r.status as OsStatus]}</div>
                    </div>
                  </li>
                ))}
              </ul>}
          </CardContent>
        </Card>

        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-warning-foreground"><PauseCircle className="h-4 w-4" />Paradas há mais tempo</CardTitle>
            <CardDescription>O.S. ativas sem atualização recente — possíveis gargalos.</CardDescription>
          </CardHeader>
          <CardContent>
            {paradasHaMaisTempo.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma O.S. ativa.</p> :
              <ul className="divide-y">
                {paradasHaMaisTempo.map((r) => (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link to="/ordens/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.numero_os}</Link>
                      <div className="text-xs text-muted-foreground truncate">{r.clientes?.nome ?? "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">{r.diasParada} dia{r.diasParada === 1 ? "" : "s"} sem atualização</div>
                      <Badge variant="outline" className={OS_STATUS_CLASS[r.status as OsStatus]}>{OS_STATUS_LABEL[r.status as OsStatus]}</Badge>
                    </div>
                  </li>
                ))}
              </ul>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todas as O.S. do filtro aplicado</CardTitle>
          <CardDescription>{tabelaRows.length} ordens listadas, ordenadas por prazo de entrega.</CardDescription>
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
                  const atrasada = isAtrasada(r.data_entrega_prev, r.data_entrega_real, r.status as OsStatus);
                  return (
                    <TableRow key={r.id} className={atrasada ? "bg-destructive/5" : undefined}>
                      <TableCell>
                        <Link to="/ordens/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.numero_os}</Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.clientes?.nome ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={OS_STATUS_CLASS[r.status as OsStatus]}>{OS_STATUS_LABEL[r.status as OsStatus]}</Badge>
                      </TableCell>
                      <TableCell className={atrasada ? "text-destructive font-medium" : undefined}>{formatDate(r.data_entrega_prev)}</TableCell>
                      <TableCell>{formatDate(r.data_entrega_real)}</TableCell>
                      <TableCell className="text-right">{formatBRL(r.valor_total)}</TableCell>
                    </TableRow>
                  );
                })}
                {tabelaRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
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

function MetricCard({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; tone: "primary" | "info" | "success" | "destructive" }) {
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
