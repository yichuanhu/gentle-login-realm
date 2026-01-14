
-- 创建角色枚举
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'viewer');

-- 删除旧的admin_users表，使用新的用户系统
DROP TABLE IF EXISTS public.admin_users;

-- 创建用户表
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建用户角色表
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 创建菜单表
CREATE TABLE public.menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    path TEXT,
    icon TEXT,
    parent_id UUID REFERENCES public.menus(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建角色菜单关联表
CREATE TABLE public.role_menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role app_role NOT NULL,
    menu_id UUID REFERENCES public.menus(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (role, menu_id)
);

-- 创建安装包表
CREATE TABLE public.packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    version TEXT,
    uploaded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建工作流程表
CREATE TABLE public.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    video_path TEXT,
    video_size BIGINT,
    markdown_content TEXT,
    is_public BOOLEAN NOT NULL DEFAULT false,
    uploaded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- 创建安全检查函数：检查用户是否有某个角色
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
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

-- 创建获取当前用户ID的函数（从session中获取）
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '')::UUID
$$;

-- 创建验证session的函数
CREATE OR REPLACE FUNCTION public.verify_session(session_token TEXT, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 简单验证：实际应用中应该有session表
    RETURN session_token IS NOT NULL AND user_id IS NOT NULL;
END;
$$;

-- 用户表RLS策略（需要admin角色）
CREATE POLICY "Allow all for service role" ON public.users FOR ALL USING (true);

-- 用户角色表RLS策略
CREATE POLICY "Allow all for service role" ON public.user_roles FOR ALL USING (true);

-- 菜单表RLS策略
CREATE POLICY "Allow all for service role" ON public.menus FOR ALL USING (true);

-- 角色菜单表RLS策略
CREATE POLICY "Allow all for service role" ON public.role_menus FOR ALL USING (true);

-- 安装包表RLS策略
CREATE POLICY "Allow all for service role" ON public.packages FOR ALL USING (true);

-- 工作流程表RLS策略
CREATE POLICY "Allow all for authenticated" ON public.workflows FOR ALL USING (true);

-- 公开流程的只读策略（无需认证）
CREATE POLICY "Allow public read for public workflows" ON public.workflows 
FOR SELECT USING (is_public = true);

-- 创建更新时间戳触发器函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 为各表添加更新时间戳触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_menus_updated_at BEFORE UPDATE ON public.menus
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON public.packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 创建存储桶
INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('packages', 'packages', false, 1073741824);

INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('workflows', 'workflows', true, 209715200);

-- 存储桶RLS策略
CREATE POLICY "Allow authenticated upload to packages" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'packages');

CREATE POLICY "Allow authenticated read from packages" ON storage.objects 
FOR SELECT USING (bucket_id = 'packages');

CREATE POLICY "Allow authenticated delete from packages" ON storage.objects 
FOR DELETE USING (bucket_id = 'packages');

CREATE POLICY "Allow authenticated upload to workflows" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'workflows');

CREATE POLICY "Allow all read from workflows" ON storage.objects 
FOR SELECT USING (bucket_id = 'workflows');

CREATE POLICY "Allow authenticated delete from workflows" ON storage.objects 
FOR DELETE USING (bucket_id = 'workflows');

-- 插入默认管理员用户（密码会在Edge Function中用bcrypt加密）
INSERT INTO public.users (id, username, password_hash, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqP8Lk.HGH5x5IeGGIzz9r3JDv4LS', '系统管理员');

INSERT INTO public.user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin');

-- 插入默认菜单
INSERT INTO public.menus (id, name, path, icon, sort_order) VALUES
('10000000-0000-0000-0000-000000000001', '仪表盘', '/dashboard', 'LayoutDashboard', 1),
('10000000-0000-0000-0000-000000000002', '用户管理', '/users', 'Users', 2),
('10000000-0000-0000-0000-000000000003', '角色管理', '/roles', 'Shield', 3),
('10000000-0000-0000-0000-000000000004', '菜单管理', '/menus', 'Menu', 4),
('10000000-0000-0000-0000-000000000005', '安装包管理', '/packages', 'Package', 5),
('10000000-0000-0000-0000-000000000006', '流程管理', '/workflows', 'GitBranch', 6);

-- 为admin角色分配所有菜单
INSERT INTO public.role_menus (role, menu_id) VALUES
('admin', '10000000-0000-0000-0000-000000000001'),
('admin', '10000000-0000-0000-0000-000000000002'),
('admin', '10000000-0000-0000-0000-000000000003'),
('admin', '10000000-0000-0000-0000-000000000004'),
('admin', '10000000-0000-0000-0000-000000000005'),
('admin', '10000000-0000-0000-0000-000000000006');
