-- Permite desativar, por O.S. específica, o e-mail automático de pesquisa
-- de satisfação (disparado hoje quando a O.S. atinge status "faturado" —
-- ver src/lib/pesquisa-satisfacao.functions.ts). Caso de uso: um cliente
-- específico pediu pra não receber mais essa pesquisa.
--
-- Fica por O.S. (não por cliente nem global) — decisão confirmada com o
-- usuário. Default false: nada muda pras O.S. existentes, o comportamento
-- automático continua ligado até alguém desativar manualmente.
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS pesquisa_satisfacao_desativada BOOLEAN NOT NULL DEFAULT false;

-- A view mascarada lista as colunas manualmente (não faz "select *"), então
-- a coluna nova precisa entrar aqui também, senão o front não consegue ler
-- nem escrever esse campo através da view de leitura. Não é dado financeiro,
-- não precisa de máscara por role — todo mundo que já vê a O.S. pode ver se
-- a pesquisa está desativada.
CREATE OR REPLACE VIEW public.ordens_servico_com_acesso AS
SELECT
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
  CASE WHEN has_any_role(auth.uid(), ARRAY['admin'::app_role, 'pcp'::app_role, 'producao'::app_role])
    THEN valor_unit ELSE NULL END AS valor_unit,
  CASE WHEN has_any_role(auth.uid(), ARRAY['admin'::app_role, 'pcp'::app_role, 'producao'::app_role])
    THEN valor_total ELSE NULL END AS valor_total,
  CASE WHEN has_any_role(auth.uid(), ARRAY['admin'::app_role, 'pcp'::app_role, 'producao'::app_role])
    THEN peso_kg ELSE NULL END AS peso_kg,
  local_entrega,
  tipo_frete,
  descricao,
  fora_escopo,
  status,
  created_by,
  created_at,
  updated_at,
  CASE WHEN has_any_role(auth.uid(), ARRAY['admin'::app_role, 'pcp'::app_role, 'producao'::app_role])
    THEN valor_faturado_real ELSE NULL END AS valor_faturado_real,
  data_faturamento_real,
  CASE WHEN has_any_role(auth.uid(), ARRAY['admin'::app_role, 'pcp'::app_role, 'producao'::app_role])
    THEN numero_nota_fiscal ELSE NULL END AS numero_nota_fiscal,
  nota_fiscal_anexo_id,
  pesquisa_satisfacao_enviada_em,
  aviso_prazo_enviado_em,
  email_contato_id,
  pesquisa_satisfacao_desativada
FROM public.ordens_servico;

GRANT SELECT ON public.ordens_servico_com_acesso TO authenticated;

COMMENT ON COLUMN public.ordens_servico.pesquisa_satisfacao_desativada IS
  'Se true, enviarPesquisaSatisfacao() nunca dispara o e-mail automático pra esta O.S., mesmo ao atingir status faturado. Não afeta pesquisas já enviadas antes.';
