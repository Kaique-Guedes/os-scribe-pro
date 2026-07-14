import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import type { TablesInsert } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — Sartori Group" }] }),
  component: ClientesList,
});

function ClientesList() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<TablesInsert<"clientes">>>({});

  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("*, ordens_servico(count)").order("nome")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.nome?.trim()) throw new Error("Informe o nome");
      const { error } = await supabase.from("clientes").insert({ nome: form.nome, contato: form.contato ?? null, email: form.email ?? null, telefone: form.telefone ?? null, cnpj: form.cnpj ?? null, observacoes: form.observacoes ?? null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); qc.invalidateQueries({ queryKey: ["clientes-simple"] }); setOpen(false); setForm({}); toast.success("Cliente cadastrado."); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Users className="h-6 w-6 text-primary" />Clientes</h1>
          <p className="text-sm text-muted-foreground">{clientes?.length ?? 0} clientes cadastrados</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo cliente</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome ?? ""} onChange={e => setForm(f => ({...f, nome: e.target.value}))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contato</Label><Input value={form.contato ?? ""} onChange={e => setForm(f => ({...f, contato: e.target.value}))} /></div>
                <div><Label>CNPJ</Label><Input value={form.cnpj ?? ""} onChange={e => setForm(f => ({...f, cnpj: e.target.value}))} /></div>
                <div><Label>E-mail</Label><Input type="email" value={form.email ?? ""} onChange={e => setForm(f => ({...f, email: e.target.value}))} /></div>
                <div><Label>Telefone</Label><Input value={form.telefone ?? ""} onChange={e => setForm(f => ({...f, telefone: e.target.value}))} /></div>
              </div>
              <div><Label>Observações</Label><Textarea rows={2} value={form.observacoes ?? ""} onChange={e => setForm(f => ({...f, observacoes: e.target.value}))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead className="text-right">O.S.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(clientes ?? []).map(c => (
                <TableRow key={c.id}>
                  <TableCell><Link to="/clientes/$id" params={{id: c.id}} className="font-medium hover:underline text-primary">{c.nome}</Link></TableCell>
                  <TableCell>{c.contato ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.cnpj ?? "—"}</TableCell>
                  <TableCell className="text-right">{(c as unknown as { ordens_servico: { count: number }[] }).ordens_servico?.[0]?.count ?? 0}</TableCell>
                </TableRow>
              ))}
              {(!clientes || clientes.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum cliente cadastrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
