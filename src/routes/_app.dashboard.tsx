import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  OS_STATUS_CLASS, OS_STATUS_LABEL, OS_STATUS_LIST,
  formatBRL, formatDate, isAtrasada, type OsStatus,
} from "@/lib/os-utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ClipboardList, Wallet, AlertTriangle, CheckCircle2, Plus,
} from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Sartori Group" }] }),
  component: DashboardPage,
});

const STATUS_COLORS: Record<OsStatus, string> = {
  aberta: "hsl(var(--info))",
  aguardando_material: "hsl(var(--warning))",
  em_producao: "hsl(var(--primary))",
  em_pintura: "hsl(var(--accent-foreground))",
  pronta: "hsl(var(--success))",
  entregue: "hsl(var(--muted-foreground))",
  atrasada: "hsl(var(--destructive))",
  cancelada: "hsl(var(--muted-foreground))",
};

function DashboardPage() {
  const { data: ordens = [] } = useQuery({
    queryKey: ["dashboard-os"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id, numero_os, status, data_entrega_prev, data_entrega_real, valor_total, cliente_id, descricao, created_at, clientes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = ordens.length;
  const emAndamento = ordens.filter(o => !["entregue","cancelada"].includes(o.status)).length;
  const atrasadas = ordens.filter(o => isAtrasada(o.data_entrega_prev, o.data_entrega_real, o.status as OsStatus)).length;
  const entregues = ordens.filter(o => o.status === "entregue").length;
  const valorTotal = ordens.reduce((s, o) => s + (Number(o.valor_total) || 0), 0);

  const statusCount = OS_STATUS_LIST.map(s => ({
    status: s,
    label: OS_STATUS_LABEL[s],
    count: ordens.filter(o => o.status === s).length,
  })).filter(x => x.count > 0);

  const recentes = ordens.slice(0, 8);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral das ordens de serviço.</p>
        </div>
        <Button asChild><Link to="/ordens/nova"><Plus className="h-4 w-4 mr-2" />Nova O.S.</Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total de O.S." value={total.toString()} icon={<ClipboardList className="h-5 w-5 text-primary" />} />
        <MetricCard title="Em andamento" value={emAndamento.toString()} icon={<ClipboardList className="h-5 w-5 text-info" />} />
        <MetricCard title="Atrasadas" value={atrasadas.toString()} icon={<AlertTriangle className="h-5 w-5 text-destructive" />} tone={atrasadas > 0 ? "danger" : undefined} />
        <MetricCard title="Entregues" value={entregues.toString()} icon={<CheckCircle2 className="h-5 w-5 text-success" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">O.S. por status</CardTitle>
            <CardDescription>Distribuição atual do pipeline</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {statusCount.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusCount}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6,6,0,0]}>
                    {statusCount.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status as OsStatus]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" />Valor total em O.S.</CardTitle>
            <CardDescription>Soma dos valores previstos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{formatBRL(valorTotal)}</div>
            <div className="h-52 mt-4">
              {statusCount.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusCount} dataKey="count" nameKey="label" innerRadius={40} outerRadius={70}>
                      {statusCount.map(e => <Cell key={e.status} fill={STATUS_COLORS[e.status as OsStatus]} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O.S. recentes</CardTitle>
          <CardDescription>Últimas ordens de serviço criadas</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº O.S.</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entrega prev.</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentes.map(o => {
                const atrasada = isAtrasada(o.data_entrega_prev, o.data_entrega_real, o.status as OsStatus);
                return (
                  <TableRow key={o.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link to="/ordens/$id" params={{ id: o.id }} className="hover:underline">{o.numero_os}</Link>
                    </TableCell>
                    <TableCell>{o.clientes?.nome ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={OS_STATUS_CLASS[o.status as OsStatus]}>
                        {OS_STATUS_LABEL[o.status as OsStatus]}
                      </Badge>
                      {atrasada && <Badge variant="outline" className="ml-2 bg-destructive/15 text-destructive border-destructive/30">Atrasada</Badge>}
                    </TableCell>
                    <TableCell>{formatDate(o.data_entrega_prev)}</TableCell>
                    <TableCell className="text-right">{formatBRL(Number(o.valor_total) || 0)}</TableCell>
                  </TableRow>
                );
              })}
              {recentes.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma O.S. cadastrada ainda.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, icon, tone }: { title: string; value: string; icon: React.ReactNode; tone?: "danger" }) {
  return (
    <Card className={tone === "danger" ? "border-destructive/40" : ""}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{title}</div>
          {icon}
        </div>
        <div className="text-2xl font-semibold mt-2">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados para exibir</div>;
}
