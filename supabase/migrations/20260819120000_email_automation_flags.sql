-- Flags de controle pra e-mails automáticos disparados pelo sistema.
-- Sem essas colunas, um refresh de página ou reenvio de nota fiscal poderia
-- disparar o mesmo e-mail várias vezes (condição de corrida / duplicidade).

-- Pesquisa de satisfação: enviada uma única vez, no momento em que a O.S.
-- atinge status "faturado" (valor total faturado == valor do contrato).
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS pesquisa_satisfacao_enviada_em TIMESTAMPTZ;

-- Aviso de prazo (1 semana antes da entrega): guarda a data em que o aviso
-- foi enviado, pra o cron não reenviar se rodar mais de uma vez no mesmo dia
-- (ou se a O.S. ainda estiver no mesmo prazo no dia seguinte, por erro de fuso).
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS aviso_prazo_enviado_em DATE;
