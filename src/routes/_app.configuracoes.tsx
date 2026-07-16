import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession, useRoles, isAdmin } from "@/hooks/use-auth";
import { ROLE_LABEL, type AppRole } from "@/lib/os-utils";
import { inviteUser } from "@/lib/admin-users.functions";
import { toast } from "sonner";
import { Shield, Info, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Sartori Group" }] }),
  component: ConfigPage,
});

const ALL_ROLES: AppRole[] = ["admin","pcp","producao","viewer"];

function ConfigPage() {
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: myRoles = [] } = useRoles(user?.id);
  const admin = isAdmin(myRoles);

  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-config"],
    enabled: admin,
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("id, nome, email, created_at");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const rolesByUser = new Map<string, AppRole[]>();
      (roles ?? []).forEach(r => {
        const list = rolesByUser.get(r.user_id) ?? [];
        list.push(r.role as AppRole);
        rolesByUser.set(r.user_id, list);
      });
      return (profiles ?? []).map(p => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Permissão atualizada"); qc.invalidateQueries({ queryKey: ["usuarios-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Shield className="h-6 w-6 text-primary" />Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie usuários e permissões do sistema.</p>
      </div>

      {!admin && (
        <Card className="border-info/40 bg-info/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-info mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Acesso restrito</p>
              <p className="text-muted-foreground">Você não é administrador. Peça a um admin para promover sua conta e liberar o acesso completo.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Usuários</CardTitle>
            <CardDescription>Novos cadastros começam como <b>Visualizador</b>. Cada usuário tem um papel principal.</CardDescription>
          </div>
          {admin && <InviteUserDialog />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usuarios ?? []).map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome || "—"}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {u.roles.length > 0
                      ? u.roles.map(r => <Badge key={r} variant="secondary" className="mr-1">{ROLE_LABEL[r]}</Badge>)
                      : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell>
                    {admin && (
                      <Select value={u.roles[0] ?? ""} onValueChange={(v) => setRole.mutate({ userId: u.id, role: v as AppRole })}>
                        <SelectTrigger className="w-48"><SelectValue placeholder="Definir papel" /></SelectTrigger>
                        <SelectContent>{ALL_ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!usuarios || usuarios.length === 0) && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  {admin ? "Nenhum usuário cadastrado." : "Faça login como administrador para gerenciar usuários."}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Papéis e permissões</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><b>Administrador:</b> acesso total, gerencia usuários.</p>
          <p><b>PCP / Planejamento:</b> cria, edita e exclui O.S. e clientes.</p>
          <p><b>Produção:</b> atualiza etapas, datas e status de produção.</p>
          <p><b>Visualizador:</b> apenas consulta.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function InviteUserDialog() {
  const qc = useQueryClient();
  const invite = useServerFn(inviteUser);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await invite({ data: { email: email.trim(), nome: nome.trim() || undefined, role } });
      toast.success(`Convite enviado para ${email}`);
      setEmail(""); setNome(""); setRole("viewer"); setOpen(false);
      qc.invalidateQueries({ queryKey: ["usuarios-config"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao convidar usuário");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><UserPlus className="h-4 w-4 mr-2" />Convidar usuário</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar novo usuário</DialogTitle>
          <DialogDescription>Um e-mail com link de acesso será enviado. O usuário define a senha ao entrar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>E-mail</Label><Input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="usuario@sartorigroup.com.br" /></div>
          <div><Label>Nome (opcional)</Label><Input value={nome} onChange={(e)=>setNome(e.target.value)} placeholder="Nome do usuário" /></div>
          <div>
            <Label>Papel inicial</Label>
            <Select value={role} onValueChange={(v)=>setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ALL_ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={()=>setOpen(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading || !email}>{loading ? "Enviando..." : "Enviar convite"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
