import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut,
  TrendingUp,
  FileText,
  Bell,
  ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminSession {
  id: string;
  username: string;
  loginTime: string;
}

const Dashboard = () => {
  const [session, setSession] = useState<AdminSession | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // 检查登录状态
    const sessionData = localStorage.getItem("admin_session");
    if (!sessionData) {
      navigate("/login");
      return;
    }
    setSession(JSON.parse(sessionData));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("admin_session");
    toast({
      title: "已退出登录",
      description: "您已安全退出系统",
    });
    navigate("/login");
  };

  if (!session) {
    return null;
  }

  const stats = [
    { label: "用户总数", value: "1,234", icon: Users, trend: "+12%" },
    { label: "今日访问", value: "567", icon: TrendingUp, trend: "+5%" },
    { label: "待处理", value: "23", icon: FileText, trend: "-3%" },
    { label: "系统通知", value: "8", icon: Bell, trend: "" },
  ];

  const menuItems = [
    { label: "仪表盘", icon: LayoutDashboard, active: true },
    { label: "用户管理", icon: Users, active: false },
    { label: "系统设置", icon: Settings, active: false },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="dashboard-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-foreground">管理系统</h1>
            <p className="text-xs text-muted-foreground">后台管理面板</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">{session.username}</p>
            <p className="text-xs text-muted-foreground">管理员</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            退出
          </button>
        </div>
      </header>

      <div className="flex">
        {/* 侧边菜单 */}
        <aside className="w-64 min-h-[calc(100vh-73px)] bg-card border-r border-border p-4">
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.label}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
                {item.active && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            ))}
          </nav>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 p-6">
          <div className="animate-fade-in">
            {/* 欢迎信息 */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground">
                欢迎回来，{session.username}！
              </h2>
              <p className="text-muted-foreground mt-1">
                这是您的管理仪表盘，可以查看系统概况
              </p>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {stats.map((stat, index) => (
                <div
                  key={stat.label}
                  className="stat-card animate-slide-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                      {stat.trend && (
                        <span className={`text-xs font-medium ${
                          stat.trend.startsWith("+") ? "text-green-600" : "text-red-500"
                        }`}>
                          {stat.trend} 较昨日
                        </span>
                      )}
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <stat.icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 快速操作 */}
            <div className="stat-card">
              <h3 className="font-semibold text-foreground mb-4">快速操作</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "添加用户", icon: Users },
                  { label: "查看报表", icon: FileText },
                  { label: "系统设置", icon: Settings },
                  { label: "消息通知", icon: Bell },
                ].map((action) => (
                  <button
                    key={action.label}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:bg-muted transition-colors"
                  >
                    <action.icon className="w-6 h-6 text-primary" />
                    <span className="text-sm font-medium text-foreground">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
