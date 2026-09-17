-- Permite cadastrar vários e-mails por cliente (financeiro, comprador,
-- diretoria etc.) e escolher, em cada O.S., qual desses e-mails é o
-- "dono" dela. Antes só existia um `clientes.email` único, compartilhado
-- por todas as O.S. do mesmo cliente — a pesquisa de satisfação sempre ia
-- pro mesmo endereço, não importa quem pediu aquela O.S. específica.

create table public.cliente_emails (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  email text not null,
  rotulo text, -- rótulo livre pra identificar na lista, ex: "Financeiro", "Comprador". Opcional.
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.cliente_emails to authenticated;
grant all on public.cliente_emails to service_role;
alter table public.cliente_emails enable row level security;
-- Mesma regra de acesso da tabela clientes: todo autenticado lê, só admin/pcp
-- cadastra, edita ou apaga e-mail.
create policy "cliente_emails select" on public.cliente_emails for select to authenticated using (true);
create policy "cliente_emails write" on public.cliente_emails for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','pcp']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','pcp']::public.app_role[]));
create index on public.cliente_emails (cliente_id);

-- Migra pro novo formato os e-mails que já existiam no campo único de
-- clientes, pra ninguém perder o que já tinha cadastrado.
insert into public.cliente_emails (cliente_id, email)
select id, email from public.clientes where email is not null and trim(email) <> '';

-- Cada O.S. passa a guardar qual desses e-mails é o dela. Fica NULL nas O.S.
-- antigas (não tem como saber qual seria) — nesses casos o código volta a
-- usar o clientes.email de antes, como fallback (ver pesquisa-satisfacao.functions.ts).
alter table public.ordens_servico
  add column email_contato_id uuid references public.cliente_emails(id) on delete set null;

-- A view mascarada de ordens_servico lista as colunas manualmente (não faz
-- "select *"), então a coluna nova precisa ser incluída aqui, senão o front
-- não consegue ler o e-mail escolhido. Não é dado financeiro, não precisa
-- de máscara por role.
create or replace view public.ordens_servico_com_acesso as
select
  id,
  numero_os,
  cliente_id,
  solicitante,
  numero_ss,
  numero_pedido,
  projeto,
  gestor,
  orcamentista,
  data_inicio_prev,
  data_entrega_prev,
  data_entrega_real,
  unidade,
  quantidade,
  case when has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role])
    then valor_unit else null end as valor_unit,
  case when has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role])
    then valor_total else null end as valor_total,
  case when has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role])
    then peso_kg else null end as peso_kg,
  local_entrega,
  tipo_frete,
  descricao,
  fora_escopo,
  status,
  created_by,
  created_at,
  updated_at,
  case when has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role])
    then valor_faturado_real else null end as valor_faturado_real,
  data_faturamento_real,
  case when has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role])
    then numero_nota_fiscal else null end as numero_nota_fiscal,
  nota_fiscal_anexo_id,
  pesquisa_satisfacao_enviada_em,
  aviso_prazo_enviado_em,
  email_contato_id
from public.ordens_servico;

grant select on public.ordens_servico_com_acesso to authenticated;

comment on table public.cliente_emails is 'Vários e-mails de contato por cliente. ordens_servico.email_contato_id escolhe qual deles pertence a cada O.S. (usado no envio da pesquisa de satisfação).';
