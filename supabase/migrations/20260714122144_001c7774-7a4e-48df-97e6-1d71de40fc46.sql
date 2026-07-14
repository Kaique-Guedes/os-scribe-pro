
CREATE POLICY "os-files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'os-files');
CREATE POLICY "os-files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'os-files' AND public.has_any_role(auth.uid(), ARRAY['admin','pcp','producao']::public.app_role[]));
CREATE POLICY "os-files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'os-files' AND public.has_any_role(auth.uid(), ARRAY['admin','pcp']::public.app_role[]));
