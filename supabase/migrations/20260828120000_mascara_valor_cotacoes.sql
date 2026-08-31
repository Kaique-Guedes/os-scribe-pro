-- Mascara o campo financeiro `valor` de material_cotacoes pra quem só tem o
-- role "viewer". admin/pcp/producao/almoxarifado continuam vendo o valor
-- normalmente (almoxarifado precisa comparar preço entre fornecedores pra
-- fazer a cotação, então não pode ficar sem essa coluna).
--
-- Como funciona:
-- 1. A policy de leitura da tabela passa a negar "viewer" (só quem tem um dos
--    4 roles de trabalho lê a tabela crua). Sem isso, dava pra contornar a
--    máscara chamando a tabela direto pela API REST em vez da view.
-- 2. Criamos uma VIEW que troca `valor` por NULL quando o usuário não tem
--    nenhum dos 4 roles. A view funciona pra todo mundo (inclusive viewer)
--    porque, por padrão, o dono da tabela (quem roda a migration) não é
--    afetado pela RLS — então a view "enxerga" todas as linhas e decide,
--    coluna por coluna, o que mostrar. É esse comportamento padrão do
--    Postgres que torna esse truque de mascaramento possível.
--
-- Idempotente: pode rodar de novo sem quebrar nada.

drop policy if exists "cotacoes select" on material_cotacoes;
create policy "cotacoes select" on material_cotacoes
  for select
  to authenticated
  using (has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role, 'almoxarifado'::app_role]));

create or replace view public.material_cotacoes_com_acesso as
select
  id,
  os_id,
  categoria,
  case
    when has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role, 'almoxarifado'::app_role])
      then valor
    else null
  end as valor,
  descricao,
  prazo_entrega_dias,
  anexo_id,
  selecionada,
  chegou,
  data_chegada,
  pedido_compra_anexo_id,
  nota_fiscal_compra_anexo_id,
  observacoes,
  created_by,
  created_at
from public.material_cotacoes;

grant select on public.material_cotacoes_com_acesso to authenticated;
