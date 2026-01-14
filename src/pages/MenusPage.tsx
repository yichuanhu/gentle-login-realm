import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

interface Menu {
  id: string;
  name: string;
  path: string | null;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  is_visible: boolean;
}

const ICONS = [
  "LayoutDashboard",
  "Users",
  "Shield",
  "Menu",
  "Package",
  "GitBranch",
  "Settings",
  "FileText",
  "FolderOpen",
];

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [deletingMenu, setDeletingMenu] = useState<Menu | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    path: "",
    icon: "LayoutDashboard",
    parent_id: "",
    sort_order: 0,
    is_visible: true,
  });

  useEffect(() => {
    loadMenus();
  }, []);

  const loadMenus = async () => {
    try {
      const result = await api.getMenus();
      setMenus(result.data || []);
    } catch (error) {
      toast({ variant: "destructive", title: "加载失败", description: "无法加载菜单列表" });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingMenu(null);
    setFormData({
      name: "",
      path: "",
      icon: "LayoutDashboard",
      parent_id: "",
      sort_order: menus.length,
      is_visible: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (menu: Menu) => {
    setEditingMenu(menu);
    setFormData({
      name: menu.name,
      path: menu.path || "",
      icon: menu.icon || "LayoutDashboard",
      parent_id: menu.parent_id || "",
      sort_order: menu.sort_order,
      is_visible: menu.is_visible,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "错误", description: "菜单名称不能为空" });
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: formData.name,
        path: formData.path || null,
        icon: formData.icon,
        parent_id: formData.parent_id || null,
        sort_order: formData.sort_order,
        is_visible: formData.is_visible,
      };

      if (editingMenu) {
        await api.updateMenu(editingMenu.id, data);
        toast({ title: "更新成功", description: "菜单已更新" });
      } else {
        await api.createMenu(data);
        toast({ title: "创建成功", description: "新菜单已创建" });
      }
      setDialogOpen(false);
      loadMenus();
    } catch (error: any) {
      toast({ variant: "destructive", title: "操作失败", description: error.message || "请稍后重试" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingMenu) return;

    try {
      await api.deleteMenu(deletingMenu.id);
      toast({ title: "删除成功", description: "菜单已删除" });
      setDeleteDialogOpen(false);
      loadMenus();
    } catch (error: any) {
      toast({ variant: "destructive", title: "删除失败", description: error.message || "请稍后重试" });
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
          <h1 className="text-2xl font-bold">菜单管理</h1>
          <p className="text-muted-foreground">管理系统导航菜单</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          新建菜单
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>路径</TableHead>
              <TableHead>图标</TableHead>
              <TableHead>排序</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {menus.map((menu) => (
              <TableRow key={menu.id}>
                <TableCell className="font-medium">{menu.name}</TableCell>
                <TableCell>{menu.path || "-"}</TableCell>
                <TableCell>{menu.icon || "-"}</TableCell>
                <TableCell>{menu.sort_order}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${menu.is_visible ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                    {menu.is_visible ? "显示" : "隐藏"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(menu)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDeletingMenu(menu);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMenu ? "编辑菜单" : "新建菜单"}</DialogTitle>
            <DialogDescription>
              {editingMenu ? "修改菜单信息" : "创建一个新的导航菜单"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>路径</Label>
              <Input
                value={formData.path}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                placeholder="/example"
              />
            </div>
            <div className="space-y-2">
              <Label>图标</Label>
              <Select
                value={formData.icon}
                onValueChange={(value) => setFormData({ ...formData, icon: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>排序</Label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_visible}
                onCheckedChange={(checked) => setFormData({ ...formData, is_visible: checked })}
              />
              <Label>显示菜单</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingMenu ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除菜单 "{deletingMenu?.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
