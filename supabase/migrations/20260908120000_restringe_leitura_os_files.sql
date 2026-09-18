-- Pendência de segurança #3: o bucket "os-files" (anexos de O.S. — pedido de
-- compra, nota fiscal de compra, cotação de material) hoje libera leitura pra
-- QUALQUER usuário autenticado, inclusive "viewer", que não tem motivo de
-- negócio pra baixar esses arquivos (confirmado com o dono do produto).
--
-- Diferente da máscara de valores financeiros (colunas viradas NULL numa
-- view), aqui a regra é mais simples: cada arquivo já mora numa pasta com o
-- ID da O.S. dele (ex: "abc123/nf-...pdf"), mas nem precisamos usar isso —
-- "almoxarifado" já enxerga TODAS as O.S. (regra de negócio existente), então
-- não tem uma O.S. que ele possa ver mas não possa baixar anexo. A trava vira
-- só uma checagem de papel, igual a maioria das outras policies daqui.
--
-- "admin"/"pcp" continuam podendo apagar (política "os-files delete" já
-- restringia a esses dois — não mexida aqui). Só a policy de SELECT muda.

DROP POLICY IF EXISTS "os-files read" ON storage.objects;

CREATE POLICY "os-files read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'os-files'
    AND public.has_any_role(auth.uid(), ARRAY['admin','pcp','producao','almoxarifado']::public.app_role[])
  );
