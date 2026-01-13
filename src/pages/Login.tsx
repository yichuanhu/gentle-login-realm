import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Lock, User, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // 调用后端Edge Function进行验证
      const { data, error: invokeError } = await supabase.functions.invoke("admin-login", {
        body: { username: username.trim(), password },
      });

      if (invokeError) {
        throw new Error("验证失败，请稍后重试");
      }

      if (!data.success) {
        setError(data.error || "登录失败");
        setIsLoading(false);
        return;
      }

      // 登录成功，存储会话
      localStorage.setItem("admin_session", JSON.stringify({
        id: data.user.id,
        username: data.user.username,
        sessionToken: data.sessionToken,
        loginTime: new Date().toISOString()
      }));

      toast({
        title: "登录成功",
        description: `欢迎回来，${data.user.username}！`,
      });

      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="login-card animate-slide-up relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">管理系统</h1>
          <p className="text-muted-foreground mt-2">请登录您的账户</p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* 用户名 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">用户名</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="input-field pl-11"
                required
                autoComplete="username"
              />
            </div>
          </div>

          {/* 密码 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="input-field pl-11"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                登录中...
              </span>
            ) : (
              "登 录"
            )}
          </button>
        </form>

        {/* 提示 */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          默认账号：admin / admin123
        </p>
      </div>
    </div>
  );
};

export default Login;
