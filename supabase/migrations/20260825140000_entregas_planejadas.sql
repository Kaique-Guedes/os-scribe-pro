-- Entregas planejadas: o "previsto" fatiado por mês, dentro da própria O.S.
-- Diferente de os_notas_fiscais (que é o fato consumado / "realizado"), esta
-- tabela guarda o planejamento — pode ser criada, editada ou removida livremente,
-- sem nenhum arquivo/nota fiscal anexado.
CREATE TABLE public.os_entregas_planejadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  data_planejada DATE NOT NULL,
  quantidade_planejada NUMERIC(14,3),
  valor_planejado NUMERIC(14,2) NOT NULL,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_entregas_planejadas TO authenticated;
GRANT ALL ON public.os_entregas_planejadas TO service_role;
ALTER TABLE public.os_entregas_planejadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entregas_planejadas select" ON public.os_entregas_planejadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "entregas_planejadas write" ON public.os_entregas_planejadas FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','pcp','producao']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','pcp','producao']::public.app_role[]));
CREATE INDEX ON public.os_entregas_planejadas (os_id);
CREATE INDEX ON public.os_entregas_planejadas (data_planejada);

COMMENT ON TABLE public.os_entregas_planejadas IS 'Planejamento de entregas parciais por mês (Previsto do dashboard). Não é o fato consumado — isso é os_notas_fiscais (Realizado).';
