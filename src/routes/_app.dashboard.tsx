import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OS_STATUS_LABEL, OS_STATUS_CLASS, formatBRL, formatDate, isAtrasada, type OsStatus } from "@/lib/os-utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Wallet } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Sartori Group" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-os"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id, numero_os, cliente_id, status, valor_total, data_entrega_prev, data_entrega_real, clientes(nome)")
        .order("data_entrega_prev", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = data ?? [];
  const today = new Date().toISOString().slice(0,10);
  const in7 = new Date(Date.now() + 7*86400000).toISOString().slice(0,10);

  const abertas = rows.filter(r => !["entregue","cancelada"].includes(r.status)).length;
  const emProducao = rows.filter(r => ["em_producao","em_pintura","aguardando_material"].includes(r.status)).length;
  const atrasadas = rows.filter(r => isAtrasada(r.data_entrega_prev, r.data_entrega_real, r.status as OsStatus));
  const entregues = rows.filter(r => r.status === "entregue").length;
  const valorCarteira = rows.filter(r => !["entregue","cancelada"].includes(r.status))
    .reduce((s, r) => s + Number(r.valor_total || 0), 0);

  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(statusCounts).map(([k, v]) => ({ name: OS_STATUS_LABEL[k as OsStatus], value: v, key: k }));
  const COLORS = ["hsl(var(--chart-1))","hsl(var(--chart-2))","hsl(var(--chart-3))","hsl(var(--chart-4))","hsl(var(--chart-5))"];
  const pieColors = ["oklch(0.42 0.13 253)","oklch(0.62 0.15 150)","oklch(0.72 0.15 70)","oklch(0.58 0.22 27)","oklch(0.55 0.1 290)","oklch(0.5 0.02 260)","oklch(0.7 0.02 260)","oklch(0.3 0.02 260)"];

  const proximos7 = rows.filter(r => r.data_entrega_prev && r.data_entrega_prev >= today && r.data_entrega_prev <= in7
    && !["entregue","cancelada"].includes(r.status)).slice(0, 8);

  const valorPorStatus = Object.entries(rows.reduce<Record<string, number>>((a, r) => {
    if (!["entregue","cancelada"].includes(r.status)) {
      a[r.status] = (a[r.status] || 0) + Number(r.valor_total || 0);
    }
    return a;
  }, {})).map(([k, v]) => ({ name: OS_STATUS_LABEL[k as OsStatus], valor: v }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da produção e das Ordens de Serviço ativas.</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={ClipboardList} label="O.S. ativas" value={abertas} tone="primary" />
        <MetricCard icon={CalendarClock} label="Em produção" value={emProducao} tone="info" />
        <MetricCard icon={AlertTriangle} label="Atrasadas" value={atrasadas.length} tone="destructive" />
        <MetricCard icon={CheckCircle2} label="Entregues" value={entregues} tone="success" />
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
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$ ${Math.round(v/1000)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="valor" fill="oklch(0.42 0.13 253)" radius={[6,6,0,0]} />
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
            <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4 text-info" />Entregas nos próximos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> :
             proximos7.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma entrega prevista.</p> :
             <ul className="divide-y">
                {proximos7.map(r => (
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
                {atrasadas.slice(0,8).map(r => (
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
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{className?:string}>; label: string; value: number | string; tone: "primary"|"info"|"success"|"destructive" }) {
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
