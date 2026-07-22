import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SartoriLogo } from "@/components/sartori-logo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acessar — Sartori Group" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : "",
  }),
  component: AuthPage,
});

function safeNext(next: string): string {
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

function AuthPage() {
  const { next } = Route.useSearch();

  const target = safeNext(next);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace(target);
    });
  }, [target]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bem-vindo!");
    window.location.replace(target);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const redirectTo = `${window.location.origin}${target}`;
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectTo, data: { nome } },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta criada. Peça ao administrador para liberar seu acesso.");
  }


  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground">
        <div className="flex items-center">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <SartoriLogo variant="transparent" className="h-24 w-auto" />
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Gestão de Ordens de Serviço</h1>
          <p className="mt-4 text-primary-foreground/80 max-w-md">
            Controle o ciclo de vida de cada O.S. — da abertura à entrega — com dashboards, timeline de produção e extração automática de documentos.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">© Sartori Group — Uso interno</p>
      </div>

      <div className="flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md shadow-[var(--shadow-elevated)]">
          <CardHeader>
            <div className="lg:hidden mb-4 flex justify-center"><SartoriLogo variant="transparent" className="h-16 w-auto" /></div>
            <CardTitle>Acesso</CardTitle>
            <CardDescription>Entre com sua conta corporativa Sartori.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div><Label>E-mail</Label><Input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
                  <div><Label>Senha</Label><Input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 mt-4">
                  <div><Label>Nome</Label><Input required value={nome} onChange={(e)=>setNome(e.target.value)} /></div>
                  <div><Label>E-mail</Label><Input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
                  <div><Label>Senha</Label><Input type="password" required minLength={6} value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</Button>
                  <p className="text-xs text-muted-foreground">Novas contas iniciam como <b>Visualizador</b>. Um administrador libera as permissões.</p>
                </form>
              </TabsContent>
            </Tabs>
            <p className="text-xs text-muted-foreground mt-6 text-center">
              <Link to="/dashboard" className="underline">Voltar ao início</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
