ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS valor_faturado_real NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS data_faturamento_real DATE,
  ADD COLUMN IF NOT EXISTS numero_nota_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS nota_fiscal_anexo_id UUID REFERENCES public.os_anexos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ordens_servico_data_faturamento_real_idx ON public.ordens_servico (data_faturamento_real);