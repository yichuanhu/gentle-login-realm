-- =============================================
-- APA Management System - 完整初始化脚本
-- =============================================

-- 1. 创建枚举类型
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. 创建核心函数

-- 检查用户角色
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 获取用户角色列表
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS TABLE(role public.app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id;
$$;

-- 获取用户菜单
CREATE OR REPLACE FUNCTION public.get_user_menus(_user_id uuid)
RETURNS TABLE(id uuid, name text, path text, icon text, parent_id uuid, sort_order integer, is_visible boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT m.id, m.name, m.path, m.icon, m.parent_id, m.sort_order, m.is_visible
  FROM public.menus m
  JOIN public.role_menus rm ON m.id = rm.menu_id
  JOIN public.user_roles ur ON rm.role = ur.role
  WHERE ur.user_id = _user_id AND m.is_visible = true
  ORDER BY m.sort_order;
$$;

-- 更新 updated_at 触发器函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 自动创建用户 profile 触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  -- 默认赋予 viewer 角色
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer'::public.app_role);
  
  RETURN NEW;
END;
$$;

-- 3. 创建表结构

-- profiles 表
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- user_roles 表
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- menus 表
CREATE TABLE IF NOT EXISTS public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  path text,
  icon text,
  parent_id uuid REFERENCES public.menus(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- role_menus 表
CREATE TABLE IF NOT EXISTS public.role_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, menu_id)
);

-- packages 表
CREATE TABLE IF NOT EXISTS public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  version text,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- workflows 表
CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  markdown_content text,
  video_path text,
  video_size bigint,
  is_public boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_role_menus_role ON public.role_menus(role);
CREATE INDEX IF NOT EXISTS idx_role_menus_menu_id ON public.role_menus(menu_id);
CREATE INDEX IF NOT EXISTS idx_menus_parent_id ON public.menus(parent_id);
CREATE INDEX IF NOT EXISTS idx_menus_sort_order ON public.menus(sort_order);
CREATE INDEX IF NOT EXISTS idx_packages_uploaded_by ON public.packages(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_workflows_uploaded_by ON public.workflows(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_workflows_is_public ON public.workflows(is_public);

-- 5. 创建触发器

-- updated_at 触发器
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_menus_updated_at ON public.menus;
CREATE TRIGGER update_menus_updated_at
  BEFORE UPDATE ON public.menus
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_packages_updated_at ON public.packages;
CREATE TRIGGER update_packages_updated_at
  BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflows_updated_at ON public.workflows;
CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 新用户自动创建 profile 触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- 7. 创建 RLS 策略

-- profiles 策略
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admin can manage all profiles" ON public.profiles;
CREATE POLICY "Admin can manage all profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- user_roles 策略
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can view all roles" ON public.user_roles;
CREATE POLICY "Admin can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admin can manage all roles" ON public.user_roles;
CREATE POLICY "Admin can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- menus 策略
DROP POLICY IF EXISTS "Admin can view all menus" ON public.menus;
CREATE POLICY "Admin can view all menus" ON public.menus
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admin can manage menus" ON public.menus;
CREATE POLICY "Admin can manage menus" ON public.menus
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- role_menus 策略
DROP POLICY IF EXISTS "Authenticated users can view role_menus" ON public.role_menus;
CREATE POLICY "Authenticated users can view role_menus" ON public.role_menus
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin can manage role_menus" ON public.role_menus;
CREATE POLICY "Admin can manage role_menus" ON public.role_menus
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- packages 策略
DROP POLICY IF EXISTS "Admin and user can view packages" ON public.packages;
CREATE POLICY "Admin and user can view packages" ON public.packages
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'user'::public.app_role)
  );

DROP POLICY IF EXISTS "Admin and user can manage packages" ON public.packages;
CREATE POLICY "Admin and user can manage packages" ON public.packages
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'user'::public.app_role)
  );

-- workflows 策略
DROP POLICY IF EXISTS "Anyone can view public workflows" ON public.workflows;
CREATE POLICY "Anyone can view public workflows" ON public.workflows
  FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Admin and user can view all workflows" ON public.workflows;
CREATE POLICY "Admin and user can view all workflows" ON public.workflows
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'user'::public.app_role)
  );

DROP POLICY IF EXISTS "Admin and user can manage workflows" ON public.workflows;
CREATE POLICY "Admin and user can manage workflows" ON public.workflows
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'user'::public.app_role)
  );

-- 8. Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('packages', 'packages', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('workflows', 'workflows', true)
ON CONFLICT (id) DO NOTHING;

-- 9. Storage 策略

-- packages bucket
DROP POLICY IF EXISTS "Auth users can upload packages" ON storage.objects;
CREATE POLICY "Auth users can upload packages" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'packages' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'user'::public.app_role)
  ));

DROP POLICY IF EXISTS "Auth users can view packages" ON storage.objects;
CREATE POLICY "Auth users can view packages" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'packages' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'user'::public.app_role)
  ));

DROP POLICY IF EXISTS "Auth users can update packages" ON storage.objects;
CREATE POLICY "Auth users can update packages" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'packages' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'user'::public.app_role)
  ));

DROP POLICY IF EXISTS "Auth users can delete packages" ON storage.objects;
CREATE POLICY "Auth users can delete packages" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'packages' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'user'::public.app_role)
  ));

-- workflows bucket
DROP POLICY IF EXISTS "Auth users can upload workflows" ON storage.objects;
CREATE POLICY "Auth users can upload workflows" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workflows' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'user'::public.app_role)
  ));

DROP POLICY IF EXISTS "Anyone can view workflows files" ON storage.objects;
CREATE POLICY "Anyone can view workflows files" ON storage.objects
  FOR SELECT USING (bucket_id = 'workflows');

DROP POLICY IF EXISTS "Auth users can update workflows" ON storage.objects;
CREATE POLICY "Auth users can update workflows" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'workflows' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'user'::public.app_role)
  ));

DROP POLICY IF EXISTS "Auth users can delete workflows" ON storage.objects;
CREATE POLICY "Auth users can delete workflows" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'workflows' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'user'::public.app_role)
  ));