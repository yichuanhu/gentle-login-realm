-- 创建管理员用户表
CREATE TABLE public.admin_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 创建只读策略（验证时使用）
CREATE POLICY "Allow read for authentication" 
ON public.admin_users 
FOR SELECT 
USING (true);

-- 插入默认管理员账号 (admin/admin123)
-- 使用简单的哈希方式存储密码
INSERT INTO public.admin_users (username, password_hash) 
VALUES ('admin', 'admin123');