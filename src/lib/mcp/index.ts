import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listOrdens from "./tools/list-ordens";
import getOrdem from "./tools/get-ordem";
import listClientes from "./tools/list-clientes";
import addComentario from "./tools/create-comentario";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "sartori-os-mcp",
  title: "Sartori OS — Ordens de Serviço",
  version: "0.1.0",
  instructions:
    "Ferramentas para consultar e comentar Ordens de Serviço (O.S.) e clientes do sistema Sartori Group. Todas as chamadas respeitam as permissões do usuário autenticado (RLS).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listOrdens, getOrdem, listClientes, addComentario],
});
