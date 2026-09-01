-- Mascara os dados financeiros de ordens_servico, os_notas_fiscais e
-- os_entregas_planejadas pra quem não é admin/pcp/producao — mesmo problema
-- e mesma solução que já aplicamos em material_cotacoes (migration
-- 20260828120000): a tabela crua passa a negar leitura pra quem não tem
-- esses 3 roles, e uma VIEW (que roda como dono da tabela, então ignora essa
-- restrição) reexpõe todas as linhas, trocando as colunas de dinheiro por
-- NULL pra quem não devia ver.
--
-- Por que viewer/almoxarifado ficam de fora: são exatamente os 2 roles que
-- NÃO estão na policy de escrita dessas 3 tabelas hoje (só admin/pcp/producao
-- escrevem) — ou seja, não é uma restrição nova, é a mesma regra que já
-- vale pra escrita, agora estendida pra leitura.
--
-- Importante: NÃO mexemos nas policies de INSERT/UPDATE/DELETE. Continuam
-- exatamente iguais — só a leitura da tabela crua ficou mais restrita.
--
-- Idempotente: pode rodar de novo sem quebrar nada.

-- ============ ordens_servico ============
drop policy if exists "os select" on ordens_servico;
create policy "os select" on ordens_servico
  for select
  to authenticated
  using (has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role]));

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
  aviso_prazo_enviado_em
from public.ordens_servico;

grant select on public.ordens_servico_com_acesso to authenticated;

-- ============ os_notas_fiscais ============
drop policy if exists "nf select" on os_notas_fiscais;
create policy "nf select" on os_notas_fiscais
  for select
  to authenticated
  using (has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role]));

create or replace view public.os_notas_fiscais_com_acesso as
select
  id,
  os_id,
  case when has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role])
    then numero_nota_fiscal else null end as numero_nota_fiscal,
  case when has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role])
    then valor else null end as valor,
  data_emissao,
  storage_path,
  nome_arquivo,
  uploaded_by,
  created_at,
  quantidade,
  unidade
from public.os_notas_fiscais;

grant select on public.os_notas_fiscais_com_acesso to authenticated;

-- ============ os_entregas_planejadas ============
drop policy if exists "entregas_planejadas select" on os_entregas_planejadas;
create policy "entregas_planejadas select" on os_entregas_planejadas
  for select
  to authenticated
  using (has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role]));

create or replace view public.os_entregas_planejadas_com_acesso as
select
  id,
  os_id,
  data_planejada,
  quantidade_planejada,
  case when has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role])
    then valor_planejado else null end as valor_planejado,
  observacao,
  created_by,
  created_at
from public.os_entregas_planejadas;

grant select on public.os_entregas_planejadas_com_acesso to authenticated;
