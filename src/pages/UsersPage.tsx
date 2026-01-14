import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Loader2, UserCircle } from "lucide-react";

interface User {
  id: string;
  display_name: string | null;
  email: string | null;
  roles: ("admin" | "user" | "viewer")[];
  created_at: string;
  updated_at: string;
}

const ROLES: ("admin" | "user" | "viewer")[] = ["admin", "user", "viewer"];

const ROLE_NAMES: Record<string, string> = {
  admin: "管理员",
  user: "普通用户",
  viewer: "访客",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<("admin" | "user" | "viewer")[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { session } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const result = await api.getUsers();
      setUsers(result.data || []);
    } catch (error) {
      toast({ variant: "destructive", title: "加载失败", description: "无法加载用户列表" });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setSelectedRoles([...user.roles]);
    setDialogOpen(true);
  };

  const toggleRole = (role: "admin" | "user" | "viewer") => {
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleSaveRoles = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      await api.updateUserRoles(editingUser.id, selectedRoles);
      toast({ title: "更新成功", description: "用户角色已更新" });
      setDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      toast({ variant: "destructive", title: "操作失败", description: error.message || "请稍后重试" });
    } finally {
      setSaving(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-muted-foreground">管理用户角色权限</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <UserCircle className="h-4 w-4" />
          <span>用户通过注册加入系统</span>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-12">
          <UserCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">暂无用户</h3>
          <p className="text-muted-foreground">用户注册后会显示在这里</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>邮箱</TableHead>
                <TableHead>显示名称</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead className="w-[80px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email || "-"}</TableCell>
                  <TableCell>{user.display_name || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <span
                            key={role}
                            className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary"
                          >
                            {ROLE_NAMES[role] || role}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">无角色</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(user)}
                      disabled={user.id === session?.id}
                      title={user.id === session?.id ? "不能修改自己的角色" : "编辑角色"}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户角色</DialogTitle>
            <DialogDescription>
              为用户 {editingUser?.email} 分配角色
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {ROLES.map((role) => (
              <div key={role} className="flex items-center gap-3">
                <Checkbox
                  id={role}
                  checked={selectedRoles.includes(role)}
                  onCheckedChange={() => toggleRole(role)}
                />
                <label htmlFor={role} className="cursor-pointer">
                  <span className="font-medium">{ROLE_NAMES[role]}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    {role === "admin" && "- 拥有所有权限"}
                    {role === "user" && "- 可以管理内容"}
                    {role === "viewer" && "- 只能查看内容"}
                  </span>
                </label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveRoles} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
