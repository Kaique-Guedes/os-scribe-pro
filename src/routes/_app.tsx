import { createFileRoute, Outlet, Link, useNavigate, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/use-auth";
import { ROLE_LABEL } from "@/lib/os-utils";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { LayoutDashboard, ClipboardList, Users, Upload, Factory, Settings, LogOut } from "lucide-react";
import { SartoriLogo } from "@/components/sartori-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AppLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ordens", label: "Ordens de Serviço", icon: ClipboardList },
  { to: "/ordens/nova", label: "Nova O.S. (Upload)", icon: Upload },
  { to: "/producao", label: "Produção", icon: Factory },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

function AppLayout() {
  const { user } = useSession();
  const { data: roles = [] } = useRoles(user?.id);
  const [nome, setNome] = useState<string>("");
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("id", user.id).maybeSingle().then(({ data }) => {
      setNome(data?.nome || user.email || "");
    });
  }, [user]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (nome || user?.email || "?").slice(0, 2).toUpperCase();
  const primaryRole = roles[0];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b">
            <div className="flex items-center gap-2 px-2 py-3">
              <SartoriLogo className="h-9 w-auto" />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Operação</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV.map((item) => {
                    const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link to={item.to}>
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t">
            <div className="px-2 py-2 text-xs text-muted-foreground">
              PCP • Sartori Group
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-card px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="flex-1" />
            {primaryRole && (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {ROLE_LABEL[primaryRole]}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-2">
                  <Avatar className="h-7 w-7"><AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback></Avatar>
                  <span className="text-sm font-medium hidden sm:inline">{nome || user?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium">{nome}</div>
                  <div className="text-xs font-normal text-muted-foreground truncate">{user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
