-- 更新 Storage 策略允许认证用户直接上传

-- 先删除可能存在的旧策略
DROP POLICY IF EXISTS "Authenticated users can upload packages" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read packages" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update packages" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete packages" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can upload workflows" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update workflows" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete workflows" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read public workflows" ON storage.objects;

-- packages bucket policies
CREATE POLICY "Authenticated users can upload packages"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'packages' AND (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'user'::app_role)
));

CREATE POLICY "Authenticated users can read packages"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'packages' AND (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'user'::app_role)
));

CREATE POLICY "Authenticated users can update packages"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'packages' AND (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'user'::app_role)
));

CREATE POLICY "Authenticated users can delete packages"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'packages' AND (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'user'::app_role)
));

-- workflows bucket policies
CREATE POLICY "Authenticated users can upload workflows"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'workflows' AND (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'user'::app_role)
));

CREATE POLICY "Anyone can read public workflows"
ON storage.objects FOR SELECT
USING (bucket_id = 'workflows');

CREATE POLICY "Authenticated users can update workflows"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'workflows' AND (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'user'::app_role)
));

CREATE POLICY "Authenticated users can delete workflows"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'workflows' AND (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'user'::app_role)
));