import { useState } from "react";
import { Link, useLocation, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  Users,
  Shield,
  Menu as MenuIcon,
  Package,
  GitBranch,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, any> = {
  LayoutDashboard,
  Users,
  Shield,
  Menu: MenuIcon,
  Package,
  GitBranch,
};

export function AdminLayout() {
  const { session, logout, isLoading, isAuthenticated } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* 侧边栏 */}
      <aside
        className={cn(
          "bg-card border-r border-border transition-all duration-300 flex flex-col",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          {!collapsed && (
            <span className="font-bold text-xl text-primary">APA管理系统</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* 菜单 */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            {session?.menus
              .filter(menu => menu.is_visible)
              .map((menu) => {
                const Icon = iconMap[menu.icon] || LayoutDashboard;
                const isActive = location.pathname === menu.path;

                return (
                  <Link
                    key={menu.id}
                    to={menu.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>{menu.name}</span>}
                  </Link>
                );
              })}
          </nav>
        </ScrollArea>

        {/* 用户信息 */}
        <div className="border-t border-border p-4">
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium shrink-0">
              {session?.displayName?.[0] || session?.email?.[0] || "U"}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {session?.displayName || session?.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {session?.roles.join(", ")}
                </p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className={cn("shrink-0", collapsed && "ml-0")}
              title="退出登录"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
