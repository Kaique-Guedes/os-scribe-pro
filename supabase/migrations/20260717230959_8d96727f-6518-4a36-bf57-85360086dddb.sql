CREATE TABLE public.os_notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  numero_nota_fiscal TEXT,
  valor NUMERIC(14,2) NOT NULL,
  data_emissao DATE NOT NULL,
  storage_path TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_notas_fiscais TO authenticated;
GRANT ALL ON public.os_notas_fiscais TO service_role;
ALTER TABLE public.os_notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf select" ON public.os_notas_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "nf write" ON public.os_notas_fiscais FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','pcp','producao']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','pcp','producao']::public.app_role[]));
CREATE INDEX ON public.os_notas_fiscais (os_id);
CREATE INDEX ON public.os_notas_fiscais (data_emissao);