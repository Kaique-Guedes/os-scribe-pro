-- NOTA: esta migration reconstitui uma mudança que já foi aplicada diretamente
-- no Supabase de produção (fora do fluxo normal de migrations). Ela existe aqui
-- só para o repositório voltar a refletir o estado real do banco.
-- Se você rodar isso e a policy já existir, o "drop policy if exists" evita erro.
--
-- Restringe a LEITURA (SELECT) da tabela `clientes` a admin/pcp/producao.
--
-- Contexto: a policy original ("clientes select" USING (true)) liberava
-- CNPJ, contato, telefone, e-mail e observações de qualquer cliente para
-- QUALQUER usuário autenticado — incluindo os roles "viewer" e "almoxarifado",
-- que não deveriam ter acesso a esse dado confidencial (dados de contrato).
--
-- Por que admin/pcp/producao (e não só admin/pcp):
-- - Escrita em `clientes` já era só admin/pcp (não muda aqui).
-- - producao precisa continuar vendo o nome do cliente vinculado à O.S. no
--   kanban de Produção (feature já existente e documentada) — por isso
--   fica no mesmo grupo de roles usado em os_etapas/os_anexos/os_notas_fiscais.
-- - viewer e almoxarifado ficam de fora: por design, não devem enxergar
--   dado de cliente (nome incluso) nem dado financeiro.
--
-- Efeito colateral esperado (aceito por decisão de produto):
-- - Usuários só-almoxarifado deixam de ver o nome do cliente na tela de O.S.
--   e no kanban simplificado (aparecerá "—" onde antes aparecia o nome).
-- - Usuário "viewer" deixa de ver clientes em qualquer lugar (dropdowns de
--   filtro relacionados a cliente ficam vazios pra esse role).

drop policy if exists "clientes select" on public.clientes;

create policy "clientes select" on public.clientes
  for select
  to authenticated
  using (public.has_any_role(auth.uid(), array['admin','pcp','producao']::public.app_role[]));
