-- =============================================
-- 迁移到 Supabase Auth (清理旧数据后)
-- =============================================

-- 0. 首先清理旧数据（因为要改变外键引用）
TRUNCATE TABLE public.sessions CASCADE;
TRUNCATE TABLE public.user_roles CASCADE;
TRUNCATE TABLE public.packages CASCADE;
TRUNCATE TABLE public.workflows CASCADE;

-- 1. 创建 profiles 表 (存储用户额外信息)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS 策略
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage all profiles" 
ON public.profiles FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- 自动更新 updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. 更新 user_roles 表 - 删除旧外键，添加新外键引用 auth.users
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. 更新 user_roles RLS 策略
DROP POLICY IF EXISTS "Deny all direct access to user_roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" 
ON public.user_roles FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all roles" 
ON public.user_roles FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage all roles" 
ON public.user_roles FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- 4. 更新 menus RLS 策略
DROP POLICY IF EXISTS "Deny all direct access to menus" ON public.menus;

CREATE POLICY "Admin can view all menus" 
ON public.menus FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage menus" 
ON public.menus FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- 5. 更新 role_menus RLS 策略
DROP POLICY IF EXISTS "Deny all direct access to role_menus" ON public.role_menus;

CREATE POLICY "Authenticated users can view role_menus" 
ON public.role_menus FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admin can manage role_menus" 
ON public.role_menus FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- 6. 更新 packages RLS 策略
DROP POLICY IF EXISTS "Deny all direct access to packages" ON public.packages;

CREATE POLICY "Admin and user can view packages" 
ON public.packages FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Admin and user can manage packages" 
ON public.packages FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

-- 更新 packages 外键引用
ALTER TABLE public.packages DROP CONSTRAINT IF EXISTS packages_uploaded_by_fkey;
ALTER TABLE public.packages ADD CONSTRAINT packages_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 7. 更新 workflows RLS 策略
DROP POLICY IF EXISTS "Allow public read for public workflows" ON public.workflows;
DROP POLICY IF EXISTS "Deny other direct access to workflows" ON public.workflows;

CREATE POLICY "Anyone can view public workflows" 
ON public.workflows FOR SELECT 
USING (is_public = true);

CREATE POLICY "Admin and user can view all workflows" 
ON public.workflows FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Admin and user can manage workflows" 
ON public.workflows FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

-- 更新 workflows 外键引用
ALTER TABLE public.workflows DROP CONSTRAINT IF EXISTS workflows_uploaded_by_fkey;
ALTER TABLE public.workflows ADD CONSTRAINT workflows_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 8. 更新 sessions 外键引用 (保留表结构以备将来使用)
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Deny all direct access to sessions" ON public.sessions;
CREATE POLICY "Users can manage their own sessions" 
ON public.sessions FOR ALL 
TO authenticated 
USING (auth.uid() = user_id);

-- 9. 更新 has_role 函数
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
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

-- 10. 创建获取用户菜单的函数
CREATE OR REPLACE FUNCTION public.get_user_menus(_user_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    path text,
    icon text,
    parent_id uuid,
    sort_order integer,
    is_visible boolean
)
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

-- 11. 创建获取用户角色的函数
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS TABLE (role app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles WHERE user_id = _user_id;
$$;

-- 12. 删除旧的 users 表（数据已迁移到 auth.users + profiles）
DROP TABLE IF EXISTS public.users CASCADE;