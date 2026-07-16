-- Campos para comparativo Previsto x Realizado (entregas e faturamento)
ALTER TABLE public.ordens_servico
  ADD COLUMN valor_faturado_real NUMERIC(14,2),
  ADD COLUMN data_faturamento_real DATE,
  ADD COLUMN numero_nota_fiscal TEXT,
  ADD COLUMN nota_fiscal_anexo_id UUID REFERENCES public.os_anexos(id) ON DELETE SET NULL;

CREATE INDEX ON public.ordens_servico (data_faturamento_real);

COMMENT ON COLUMN public.ordens_servico.valor_faturado_real IS 'Valor efetivamente faturado, extraído/confirmado a partir da nota fiscal anexada.';
COMMENT ON COLUMN public.ordens_servico.data_faturamento_real IS 'Data real de faturamento (emissão da nota fiscal), extraída/confirmada a partir do PDF anexado.';
COMMENT ON COLUMN public.ordens_servico.nota_fiscal_anexo_id IS 'Referência ao anexo (os_anexos) que contém o PDF da nota fiscal usada para preencher os campos acima.';
