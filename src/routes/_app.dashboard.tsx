import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  OS_STATUS_CLASS,
  OS_STATUS_LABEL,
  formatBRL,
  formatDate,
  diffDays,
  type OsStatus,
} from "@/lib/os-utils";
import { toast } from "sonner";
import { ArrowLeft, Wallet, ClipboardList, TrendingUp, Pencil } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Cliente — Sartori Group" }] }),
  component: ClienteDetail,
});

function ClienteDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: cliente } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => (await supabase.from("clientes").select("*").eq("id", id).single()).data,
  });
  const { data: ordens } = useQuery({
    queryKey: ["cliente-ordens", id],
    queryFn: async () =>
      (
        await supabase
          .from("ordens_servico")
          .select("*")
          .eq("cliente_id", id)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const rows = ordens ?? [];
  const ativas = rows.filter((r) => !["entregue", "cancelada"].includes(r.status));
  const valorCarteira = ativas.reduce((s, r) => s + Number(r.valor_total || 0), 0);
  const valorTotal = rows.reduce((s, r) => s + Number(r.valor_total || 0), 0);

  const entregues = rows.filter(
    (r) => r.status === "entregue" && r.data_entrega_prev && r.data_entrega_real,
  );
  const leadTimes = entregues
    .map((r) => diffDays(r.data_entrega_prev, r.data_entrega_real))
    .filter((v): v is number => v != null);
  const leadMedio = leadTimes.length
    ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
    : null;

  // ---- Edição dos dados do cliente ----
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  function abrirEdicao() {
    setForm({
      nome: cliente?.nome ?? "",
      contato: cliente?.contato ?? "",
      cnpj: cliente?.cnpj ?? "",
      email: cliente?.email ?? "",
      telefone: cliente?.telefone ?? "",
      observacoes: cliente?.observacoes ?? "",
    });
    setEditOpen(true);
  }

  const salvarEdicao = useMutation({
    mutationFn: async () => {
      if (!form.nome?.trim()) throw new Error("Informe o nome");
      const { error } = await supabase
        .from("clientes")
        .update({
          nome: form.nome.trim(),
          contato: form.contato || null,
          cnpj: form.cnpj || null,
          email: form.email || null,
          telefone: form.telefone || null,
          observacoes: form.observacoes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente atualizado.");
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setEditOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!cliente) return <div className="p-6 text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/clientes" })}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Clientes
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{cliente.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {cliente.contato && <>{cliente.contato} • </>}
              {cliente.email && <>{cliente.email} • </>}
              {cliente.telefone}
            </p>
          </div>
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={abrirEdicao}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={form.nome ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Contato</Label>
                  <Input
                    value={form.contato ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, contato: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input
                    value={form.cnpj ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={form.telefone ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={form.observacoes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={salvarEdicao.isPending} onClick={() => salvarEdicao.mutate()}>
                {salvarEdicao.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={ClipboardList} label="Total de O.S." value={rows.length} />
        <Metric icon={ClipboardList} label="Ativas" value={ativas.length} tone="primary" />
        <Metric icon={Wallet} label="Em carteira" value={formatBRL(valorCarteira)} tone="primary" />
        <Metric
          icon={TrendingUp}
          label="Lead time médio (dias vs. previsto)"
          value={leadMedio == null ? "—" : `${leadMedio > 0 ? "+" : ""}${leadMedio}`}
          tone={leadMedio != null && leadMedio > 0 ? "danger" : "success"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Ordens de Serviço</CardTitle>
          <CardDescription>
            Valor total histórico: <b className="text-foreground">{formatBRL(valorTotal)}</b>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº O.S.</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entrega prev.</TableHead>
                <TableHead>Entrega real</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      to="/ordens/$id"
                      params={{ id: r.id }}
                      className="font-medium hover:underline"
                    >
                      {r.numero_os}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate">{r.projeto ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={OS_STATUS_CLASS[r.status as OsStatus]}>
                      {OS_STATUS_LABEL[r.status as OsStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(r.data_entrega_prev)}</TableCell>
                  <TableCell>{formatDate(r.data_entrega_real)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(Number(r.valor_total))}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Sem O.S. para este cliente.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone?: "primary" | "danger" | "success";
}) {
  const t =
    tone === "primary"
      ? "text-primary"
      : tone === "danger"
        ? "text-destructive"
        : tone === "success"
          ? "text-success"
          : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <div className={`text-2xl font-semibold mt-2 ${t}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
