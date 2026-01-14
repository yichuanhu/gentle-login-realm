import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";

interface Menu {
  id: string;
  name: string;
  path: string;
  icon: string;
}

interface RoleData {
  role: string;
  menus: Menu[];
}

const ROLE_NAMES: Record<string, string> = {
  admin: "管理员",
  user: "普通用户",
  viewer: "访客",
};

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [allMenus, setAllMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesResult, menusResult] = await Promise.all([
        api.getRoles(),
        api.getMenus(),
      ]);
      setRoles(rolesResult.data || []);
      setAllMenus(menusResult.data || []);
    } catch (error) {
      toast({ variant: "destructive", title: "加载失败", description: "无法加载角色数据" });
    } finally {
      setLoading(false);
    }
  };

  const toggleMenu = (role: string, menuId: string) => {
    setRoles(prev =>
      prev.map(r => {
        if (r.role !== role) return r;
        const hasMenu = r.menus.some(m => m.id === menuId);
        return {
          ...r,
          menus: hasMenu
            ? r.menus.filter(m => m.id !== menuId)
            : [...r.menus, allMenus.find(m => m.id === menuId)!],
        };
      })
    );
  };

  const saveRole = async (role: string) => {
    setSaving(role);
    try {
      const roleData = roles.find(r => r.role === role);
      await api.updateRoleMenus(role, roleData?.menus.map(m => m.id) || []);
      toast({ title: "保存成功", description: `${ROLE_NAMES[role]}权限已更新` });
    } catch (error) {
      toast({ variant: "destructive", title: "保存失败", description: "请稍后重试" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">角色管理</h1>
        <p className="text-muted-foreground">配置不同角色的菜单权限</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((roleData) => (
          <Card key={roleData.role}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{ROLE_NAMES[roleData.role]}</span>
                <Button
                  size="sm"
                  onClick={() => saveRole(roleData.role)}
                  disabled={saving === roleData.role}
                >
                  {saving === roleData.role ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </CardTitle>
              <CardDescription>配置 {ROLE_NAMES[roleData.role]} 可访问的菜单</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allMenus.map((menu) => (
                  <div key={menu.id} className="flex items-center gap-3">
                    <Checkbox
                      checked={roleData.menus.some(m => m.id === menu.id)}
                      onCheckedChange={() => toggleMenu(roleData.role, menu.id)}
                      disabled={roleData.role === "admin"}
                    />
                    <span>{menu.name}</span>
                  </div>
                ))}
              </div>
              {roleData.role === "admin" && (
                <p className="text-xs text-muted-foreground mt-4">
                  管理员默认拥有所有权限
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
