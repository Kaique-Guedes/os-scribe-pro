--- original/src/routes/_app.ordens.index.tsx	2026-08-13 17:12:22.000000000 +0000
+++ repo/src/routes/_app.ordens.index.tsx	2026-08-14 10:36:33.355913486 +0000
@@ -1,6 +1,6 @@
 import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
 import { useQuery } from "@tanstack/react-query";
-import { useState } from "react";
+import { z } from "zod";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
@@ -11,16 +11,30 @@
 import { OS_STATUS_CLASS, OS_STATUS_LABEL, OS_STATUS_LIST, formatBRL, formatDate, isAtrasada, type OsStatus } from "@/lib/os-utils";
 import { Plus, Search, AlertTriangle } from "lucide-react";
 
+// Filtros ficam validados e tipados aqui. Guardar na URL (em vez de useState)
+// é o que faz o filtro sobreviver quando você entra numa O.S. e volta.
+const ordensSearchSchema = z.object({
+  busca: z.string().catch(""),
+  status: z.string().catch("all"),
+  cliente: z.string().catch("all"),
+});
+
 export const Route = createFileRoute("/_app/ordens/")({
   head: () => ({ meta: [{ title: "Ordens de Serviço — Sartori Group" }] }),
+  validateSearch: ordensSearchSchema,
   component: OrdensList,
 });
 
 function OrdensList() {
   const navigate = useNavigate();
-  const [search, setSearch] = useState("");
-  const [statusFilter, setStatusFilter] = useState<string>("all");
-  const [clienteFilter, setClienteFilter] = useState<string>("all");
+  const { busca: search, status: statusFilter, cliente: clienteFilter } = Route.useSearch();
+
+  const setSearch = (value: string) =>
+    navigate({ to: "/ordens", search: (prev) => ({ ...prev, busca: value }), replace: true });
+  const setStatusFilter = (value: string) =>
+    navigate({ to: "/ordens", search: (prev) => ({ ...prev, status: value }), replace: true });
+  const setClienteFilter = (value: string) =>
+    navigate({ to: "/ordens", search: (prev) => ({ ...prev, cliente: value }), replace: true });
 
   const { data: clientes } = useQuery({
     queryKey: ["clientes-simple"],
