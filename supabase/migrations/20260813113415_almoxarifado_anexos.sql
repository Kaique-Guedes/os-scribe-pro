-- Libera o papel 'almoxarifado' pra anexar arquivos (PDF de cotação, pedido de
-- compra, nota fiscal de compra) nas etapas solicitacao_material/chegada_material.
-- As políticas antigas ("anx write" e "os-files insert/delete") só previam
-- admin/pcp/producao e ficaram desatualizadas quando o papel almoxarifado foi criado.

-- 1) Tabela os_anexos: almoxarifado pode INSERT sempre, e DELETE só do que ele mesmo subiu.
CREATE POLICY "anx insert almoxarifado" ON public.os_anexos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'almoxarifado'::public.app_role));

CREATE POLICY "anx delete almoxarifado" ON public.os_anexos FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'almoxarifado'::public.app_role)
    AND uploaded_by = auth.uid()
  );

-- 2) Storage bucket os-files: mesma regra, usando a coluna "owner" (dono do
-- arquivo no storage, preenchida automaticamente pelo Supabase no upload).
CREATE POLICY "os-files insert almoxarifado" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'os-files'
    AND public.has_role(auth.uid(), 'almoxarifado'::public.app_role)
  );

CREATE POLICY "os-files delete almoxarifado" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'os-files'
    AND public.has_role(auth.uid(), 'almoxarifado'::public.app_role)
    AND owner = auth.uid()
  );
