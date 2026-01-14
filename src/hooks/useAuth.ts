import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { User, Session } from "@supabase/supabase-js";

export interface UserSession {
  id: string;
  email: string;
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
}

export function useAuth() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // 加载用户角色和菜单
  const loadUserData = useCallback(async (user: User) => {
    try {
      // 获取用户角色
      const { data: rolesData } = await supabase.rpc("get_user_roles", {
        _user_id: user.id,
      });

      // 获取用户菜单
      const { data: menusData } = await supabase.rpc("get_user_menus", {
        _user_id: user.id,
      });

      // 获取用户 profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      const userSession: UserSession = {
        id: user.id,
        email: user.email || "",
        displayName: profile?.display_name || user.email || "",
        roles: rolesData?.map((r: { role: string }) => r.role) || [],
        menus: menusData || [],
      };

      setSession(userSession);
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  }, []);

  useEffect(() => {
    // 设置 auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSupabaseSession(session);
        
        if (session?.user) {
          // 使用 setTimeout 避免在 callback 中直接调用 Supabase
          setTimeout(() => {
            loadUserData(session.user);
          }, 0);
        } else {
          setSession(null);
        }
        
        setIsLoading(false);
      }
    );

    // 获取初始 session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseSession(session);
      if (session?.user) {
        loadUserData(session.user);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        await loadUserData(data.user);
        
        toast({
          title: "登录成功",
          description: `欢迎回来！`,
        });

        navigate("/dashboard");
        return true;
      }

      return false;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "登录失败",
        description: error.message === "Invalid login credentials" 
          ? "邮箱或密码错误" 
          : error.message,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [navigate, toast, loadUserData]);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setSupabaseSession(null);
      
      toast({
        title: "已退出登录",
        description: "您已安全退出系统",
      });
      
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }, [navigate, toast]);

  const hasRole = useCallback((role: string) => {
    return session?.roles.includes(role) || false;
  }, [session]);

  const hasMenu = useCallback((path: string) => {
    return session?.menus.some(m => m.path === path) || false;
  }, [session]);

  // 获取当前用户的 access token
  const getAccessToken = useCallback(() => {
    return supabaseSession?.access_token;
  }, [supabaseSession]);

  return {
    session,
    supabaseSession,
    isLoading,
    // 使用 supabaseSession 判断是否已认证，避免 loadUserData 完成前被判断为未登录
    isAuthenticated: !!supabaseSession,
    login,
    logout,
    hasRole,
    hasMenu,
    getAccessToken,
  };
}
