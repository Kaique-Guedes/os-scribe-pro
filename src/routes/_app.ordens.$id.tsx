--- original/src/routes/_app.ordens.$id.tsx	2026-08-13 17:12:22.000000000 +0000
+++ repo/src/routes/_app.ordens.$id.tsx	2026-08-14 10:37:19.743602210 +0000
@@ -1,4 +1,4 @@
-import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
+import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { useState, useEffect, useRef } from "react";
 import { supabase } from "@/integrations/supabase/client";
@@ -78,6 +78,13 @@
 function OsDetail() {
   const { id } = Route.useParams();
   const navigate = useNavigate();
+  const router = useRouter();
+  // Volta pro histórico anterior (preserva o filtro/URL de onde a pessoa veio),
+  // com fallback pra lista de O.S. caso não haja histórico (ex: acesso direto por link).
+  const voltarParaLista = () => {
+    if (window.history.length > 1) router.history.back();
+    else navigate({ to: "/ordens" });
+  };
   const qc = useQueryClient();
   const { user } = useSession();
   const { data: roles = [] } = useRoles(user?.id);
@@ -796,7 +803,7 @@
     <div className="p-6 max-w-6xl mx-auto space-y-5">
       <div className="flex items-start justify-between gap-4 flex-wrap">
         <div className="flex items-center gap-3">
-          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/ordens" })}>
+          <Button variant="ghost" size="sm" onClick={voltarParaLista}>
             <ArrowLeft className="h-4 w-4 mr-1" />
             Ordens
           </Button>
