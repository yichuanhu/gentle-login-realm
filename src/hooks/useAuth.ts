import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UserSession {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  menus: Array<{
    id: string;
    name: string;
    path: string;
    icon: string;
    parent_id: string | null;
    sort_order: number;
    is_visible: boolean;
  }>;
  sessionToken: string;
  loginTime: string;
}

export function useAuth() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem("admin_session");
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        localStorage.removeItem("admin_session");
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-login", {
        body: { username, password },
      });

      if (error) throw new Error("验证失败，请稍后重试");

      if (!data.success) {
        throw new Error(data.error || "登录失败");
      }

      const sessionData: UserSession = {
        id: data.user.id,
        username: data.user.username,
        displayName: data.user.displayName,
        roles: data.user.roles,
        menus: data.user.menus,
        sessionToken: data.sessionToken,
        loginTime: new Date().toISOString(),
      };

      localStorage.setItem("admin_session", JSON.stringify(sessionData));
      setSession(sessionData);

      toast({
        title: "登录成功",
        description: `欢迎回来，${data.user.displayName || data.user.username}！`,
      });

      navigate("/dashboard");
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "登录失败",
        description: error.message,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [navigate, toast]);

  const logout = useCallback(() => {
    localStorage.removeItem("admin_session");
    setSession(null);
    toast({
      title: "已退出登录",
      description: "您已安全退出系统",
    });
    navigate("/login");
  }, [navigate, toast]);

  const hasRole = useCallback((role: string) => {
    return session?.roles.includes(role) || false;
  }, [session]);

  const hasMenu = useCallback((path: string) => {
    return session?.menus.some(m => m.path === path) || false;
  }, [session]);

  return {
    session,
    isLoading,
    isAuthenticated: !!session,
    login,
    logout,
    hasRole,
    hasMenu,
  };
}
