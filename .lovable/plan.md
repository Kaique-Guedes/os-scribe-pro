
# SaaS de O.S. — Sartori Group

Sistema interno de PCP/produção para gerenciar Ordens de Serviço da Sartori Group, com extração automática de dados via IA a partir de PDFs/imagens, acompanhamento de etapas, dashboards e controle por cliente.

## Identidade visual

- Azul institucional `#1E4E8C` (primário), grafite `#2B2B2B` (texto), fundo `#F5F6F8`.
- Tipografia sem serifa (Inter). Cantos suavemente arredondados, sem gradientes.
- Sidebar fixa à esquerda + conteúdo à direita. Modo claro. Logo enviada no header.
- Todos os tokens em `src/styles.css` (oklch), variantes shadcn — nada de cores hardcoded.

## Backend (Lovable Cloud)

Ativar Cloud. Modelo de dados:

- `profiles` (id, nome, email)
- `user_roles` (user_id, role: `admin | pcp | producao | viewer`) + função `has_role`
- `clientes` (id, nome, contato, cnpj, obs)
- `ordens_servico` (todos os campos extraídos: numero_os, cliente_id, solicitante, numero_ss, numero_pedido, projeto, gestor, orcamentista, data_inicio_prev, data_entrega_prev, data_entrega_real, unidade, quantidade, valor_unit, valor_total, peso_kg, local_entrega, tipo_frete, descricao, fora_escopo, status, created_at)
- `os_etapas` (os_id, tipo: abertura/solicitacao_material/chegada_material/pintura/entrega, data, status, obs) — timeline
- `os_anexos` (os_id, storage_path, tipo, nome) — Storage bucket `os-files`
- `os_historico` (os_id, user_id, acao, payload_json, created_at) — log/versionamento
- `os_comentarios` (os_id, user_id, texto, created_at)

RLS: autenticados leem/escrevem conforme role (`admin` full; `pcp` full; `producao` update etapas; `viewer` só SELECT). GRANTs corretos.

## Extração automática por IA

- Server function `extractOsFromDocument` recebe arquivo (PDF/imagem), envia ao Lovable AI Gateway (`google/gemini-3-flash-preview`) com structured output (schema Zod com todos os campos da O.S.).
- Fluxo: upload → armazena em Storage → chama server fn → retorna JSON → pré-preenche formulário de cadastro (campos faltantes destacados em amarelo).
- Arquivo original fica anexado à O.S. após salvar.

## Rotas (TanStack Start)

```
/auth                          login/cadastro
/_authenticated/               layout com sidebar
  ├── dashboard                visão geral
  ├── ordens                   lista + filtros
  ├── ordens/nova              upload + extração + form
  ├── ordens/$id               ficha completa + timeline + anexos + comentários
  ├── clientes                 lista
  ├── clientes/$id             dashboard por cliente
  ├── producao                 kanban/tabela de etapas
  └── configuracoes            usuários, perfis, convites
```

## Funcionalidades por tela

**Dashboard geral:** cards (abertas, em produção, atrasadas, entregues no período), gráfico valor em carteira, gráfico status (pizza), lista próximos 7 dias, lista atrasadas em vermelho.

**Lista de O.S.:** filtros (cliente, status, período, gestor), busca, exportação PDF/Excel, badges de status coloridos.

**Ficha O.S.:** dados editáveis, timeline de 5 marcos com data/status, comparativo previsto x real com indicador, comentários, anexos (fotos, NF), histórico de versões.

**Dashboard cliente:** total O.S., valor faturado/carteira, lead time médio previsto x real, timeline últimas O.S.

**Alertas:** badge/toast quando etapa parada há > N dias ou entrega vencendo (calculado em query, exibido no dashboard).

**Lead time:** função SQL agregando diferença entre etapas por O.S. para identificar gargalos.

## Detalhes técnicos

- Frontend: TanStack Start + shadcn/ui + Tailwind v4, todo em pt-BR.
- Auth: email/senha via Cloud, convite por admin (Auth Admin API via server fn com role check).
- Charts: Recharts.
- Tabelas: shadcn Table + TanStack Table para filtros/ordenação.
- Export: `xlsx` para Excel, `jspdf` para PDF.
- IA: Lovable AI Gateway (chat completions com PDF/imagem multimodal).
- Storage: bucket privado `os-files`, signed URLs.
- Responsivo (tablet/celular no chão de fábrica).

## Fases de entrega

Pelo tamanho, vou entregar em ondas e você valida entre elas:

1. **Fase 1 (esta entrega):** Cloud ativo, schema completo + RLS, design system + logo, auth, layout autenticado com sidebar, CRUD de Clientes, CRUD de O.S. manual (sem IA ainda), timeline de etapas, dashboard básico.
2. **Fase 2:** Extração automática via IA no upload de documento, anexos, comentários, histórico.
3. **Fase 3:** Dashboard por cliente com lead time, filtros avançados, exportações PDF/Excel, alertas.
4. **Fase 4:** Convite de usuários, perfis/permissões refinadas, versionamento de O.S., polimento responsivo.

## Perguntas antes de começar

1. Confirmo o e-mail do primeiro **administrador** para eu criar/atribuir a role `admin` no seed? (ou você prefere se cadastrar e depois promover pelo SQL?)
2. Os **status da O.S.** ficam como listados (Aberta, Aguardando Material, Em Produção, Em Pintura, Pronta, Entregue, Atrasada, Cancelada) ou quer ajustar?
3. Ok começar pela **Fase 1** e seguir para as próximas ondas depois da sua validação?
