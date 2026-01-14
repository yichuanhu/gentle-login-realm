-- 更新 Storage 策略允许认证用户直接上传

-- packages bucket policies
CREATE POLICY "Authenticated users can upload packages"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'packages' AND (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user')
));

CREATE POLICY "Authenticated users can view packages"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'packages' AND (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user')
));

CREATE POLICY "Authenticated users can delete packages"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'packages' AND (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user')
));

-- workflows bucket policies
CREATE POLICY "Authenticated users can upload workflows"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'workflows' AND (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user')
));

CREATE POLICY "Anyone can view public workflows files"
ON storage.objects FOR SELECT
USING (bucket_id = 'workflows');

CREATE POLICY "Authenticated users can delete workflows"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'workflows' AND (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user')
));