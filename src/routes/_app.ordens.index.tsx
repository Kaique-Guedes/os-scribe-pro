import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { OS_STATUS_CLASS, OS_STATUS_LABEL, OS_STATUS_LIST, formatBRL, formatDate, isAtrasada, type OsStatus } from "@/lib/os-utils";
import { Plus, Search, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/ordens/")({
  head: () => ({ meta: [{ title: "Ordens de Serviço — Sartori Group" }] }),
  component: OrdensList,
});

function OrdensList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clienteFilter, setClienteFilter] = useState<string>("all");

  const { data: clientes } = useQuery({
    queryKey: ["clientes-simple"],
    queryFn: async () => (await supabase.from("clientes").select("id, nome").order("nome")).data ?? [],
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["ordens", statusFilter, clienteFilter],
    queryFn: async () => {
      let q = supabase.from("ordens_servico")
        .select("id, numero_os, projeto, cliente_id, gestor, status, valor_total, data_entrega_prev, data_entrega_real, clientes(nome)")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter as OsStatus);
      if (clienteFilter !== "all") q = q.eq("cliente_id", clienteFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (rows ?? []).filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.numero_os?.toLowerCase().includes(s) ||
      r.projeto?.toLowerCase().includes(s) ||
      r.clientes?.nome?.toLowerCase().includes(s) ||
      r.gestor?.toLowerCase().includes(s);
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {rows?.length ?? 0} ordens</p>
        </div>
        <Button asChild><Link to="/ordens/nova"><Plus className="h-4 w-4 mr-2" />Nova O.S.</Link></Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="grid gap-3 md:grid-cols-[1fr_200px_240px]">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por número, projeto, cliente, gestor..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {OS_STATUS_LIST.map(s => <SelectItem key={s} value={s}>{OS_STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={clienteFilter} onValueChange={setClienteFilter}>
              <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {(clientes ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº O.S.</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Gestor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Entrega prev.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma O.S. encontrada.</TableCell></TableRow>
                ) : filtered.map(r => {
                  const atrasada = isAtrasada(r.data_entrega_prev, r.data_entrega_real, r.status as OsStatus);
                  return (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate({ to: "/ordens/$id", params: { id: r.id } })}>
                      <TableCell className="font-medium">{r.numero_os}</TableCell>
                      <TableCell>{r.clientes?.nome ?? "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{r.projeto ?? "—"}</TableCell>
                      <TableCell>{r.gestor ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={OS_STATUS_CLASS[r.status as OsStatus]}>{OS_STATUS_LABEL[r.status as OsStatus]}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(Number(r.valor_total))}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {atrasada && <AlertTriangle className="h-4 w-4 text-destructive" />}
                          <span className={atrasada ? "text-destructive" : ""}>{formatDate(r.data_entrega_prev)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
