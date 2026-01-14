import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Package, GitBranch, Shield, Menu, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { session } = useAuth();

  const stats = [
    { title: "用户管理", icon: Users, description: "管理系统用户账号", path: "/users", color: "bg-blue-500/10 text-blue-600" },
    { title: "角色管理", icon: Shield, description: "管理用户角色权限", path: "/roles", color: "bg-green-500/10 text-green-600" },
    { title: "菜单管理", icon: Menu, description: "管理系统导航菜单", path: "/menus", color: "bg-orange-500/10 text-orange-600" },
    { title: "安装包管理", icon: Package, description: "管理软件安装包", path: "/packages", color: "bg-purple-500/10 text-purple-600" },
    { title: "流程管理", icon: GitBranch, description: "管理工作流程", path: "/workflows", color: "bg-pink-500/10 text-pink-600" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 欢迎信息 */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <LayoutDashboard className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">欢迎回来，{session?.displayName || session?.email}！</h1>
          <p className="text-muted-foreground mt-1">这是您的管理控制台</p>
        </div>
      </div>

      {/* 功能卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.path} to={stat.path}>
            <Card className="hover:shadow-lg transition-all cursor-pointer hover:-translate-y-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* 系统信息 */}
      <Card>
        <CardHeader>
          <CardTitle>系统信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">邮箱</span>
            <span className="font-medium">{session?.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">显示名称</span>
            <span className="font-medium">{session?.displayName || "-"}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">用户角色</span>
            <div className="flex gap-2">
              {session?.roles.map((role) => (
                <span key={role} className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">
                  {role}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
