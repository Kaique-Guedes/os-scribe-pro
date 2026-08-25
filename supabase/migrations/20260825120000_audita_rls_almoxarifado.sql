-- Reconstitui no repositório as policies de RLS de material_cotacoes,
-- material_cotacao_itens, material_conferencias e material_conferencia_itens,
-- que foram criadas direto no Supabase (sem migration correspondente).
--
-- Auditoria feita em 25/08/2026 via pg_policies: as 4 tabelas seguem o mesmo
-- padrão do resto do projeto (leitura geral, escrita restrita por role), com
-- almoxarifado incluído na escrita porque cotação/conferência de material são
-- funcionalidades dele. Esta migration não muda comportamento nenhum — só
-- documenta e versiona o que já está valendo em produção.
--
-- Idempotente: pode rodar de novo sem quebrar nada (drop + recreate).

-- material_cotacoes
drop policy if exists "cotacoes select" on material_cotacoes;
create policy "cotacoes select" on material_cotacoes
  for select
  to authenticated
  using (true);

drop policy if exists "cotacoes write" on material_cotacoes;
create policy "cotacoes write" on material_cotacoes
  for all
  to authenticated
  using (has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role, 'almoxarifado'::app_role]))
  with check (has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role, 'almoxarifado'::app_role]));

-- material_cotacao_itens
drop policy if exists "cotacao_itens select" on material_cotacao_itens;
create policy "cotacao_itens select" on material_cotacao_itens
  for select
  to authenticated
  using (true);

drop policy if exists "cotacao_itens write" on material_cotacao_itens;
create policy "cotacao_itens write" on material_cotacao_itens
  for all
  to authenticated
  using (has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role, 'almoxarifado'::app_role]))
  with check (has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role, 'almoxarifado'::app_role]));

-- material_conferencias
drop policy if exists "conferencias select" on material_conferencias;
create policy "conferencias select" on material_conferencias
  for select
  to authenticated
  using (true);

drop policy if exists "conferencias write" on material_conferencias;
create policy "conferencias write" on material_conferencias
  for all
  to authenticated
  using (has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role, 'almoxarifado'::app_role]))
  with check (has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role, 'almoxarifado'::app_role]));

-- material_conferencia_itens
drop policy if exists "conferencia_itens select" on material_conferencia_itens;
create policy "conferencia_itens select" on material_conferencia_itens
  for select
  to authenticated
  using (true);

drop policy if exists "conferencia_itens write" on material_conferencia_itens;
create policy "conferencia_itens write" on material_conferencia_itens
  for all
  to authenticated
  using (has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role, 'almoxarifado'::app_role]))
  with check (has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role, 'almoxarifado'::app_role]));
