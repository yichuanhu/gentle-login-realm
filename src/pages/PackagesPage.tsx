import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
import { Plus, Pencil, Trash2, Loader2, Upload, Package } from "lucide-react";

interface PackageItem {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  file_size: number;
  version: string | null;
  uploaded_by: string | null;
  created_at: string;
  users?: { username: string; display_name: string | null };
}

const MAX_FILE_SIZE = 1073741824; // 1GB

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);
  const [deletingPackage, setDeletingPackage] = useState<PackageItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { session } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    version: "",
    file: null as File | null,
  });

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const result = await api.getPackages();
      setPackages(result.data || []);
    } catch (error) {
      toast({ variant: "destructive", title: "加载失败", description: "无法加载安装包列表" });
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + " GB";
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + " KB";
    return bytes + " B";
  };

  const openCreateDialog = () => {
    setEditingPackage(null);
    setFormData({ name: "", description: "", version: "", file: null });
    setUploadProgress(0);
    setDialogOpen(true);
  };

  const openEditDialog = (pkg: PackageItem) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || "",
      version: pkg.version || "",
      file: null,
    });
    setDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.name.toLowerCase().endsWith(".exe")) {
      toast({ variant: "destructive", title: "错误", description: "只支持exe格式的安装包" });
      return;
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      toast({ variant: "destructive", title: "错误", description: "文件大小不能超过1GB" });
      return;
    }

    setFormData({ ...formData, file, name: formData.name || file.name.replace(".exe", "") });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "错误", description: "名称不能为空" });
      return;
    }
    if (!editingPackage && !formData.file) {
      toast({ variant: "destructive", title: "错误", description: "请选择安装包文件" });
      return;
    }

    setSaving(true);
    try {
      if (editingPackage) {
        await api.updatePackage(editingPackage.id, {
          name: formData.name,
          description: formData.description || null,
          version: formData.version || null,
        });
        toast({ title: "更新成功", description: "安装包信息已更新" });
      } else {
        // 上传文件
        setUploadProgress(10);
        const uploadResult = await api.uploadFile(formData.file!, "packages");
        setUploadProgress(80);

        // 创建记录
        await api.createPackage({
          name: formData.name,
          description: formData.description || null,
          file_path: uploadResult.path,
          file_size: uploadResult.size,
          version: formData.version || null,
          uploaded_by: session?.id,
        });
        setUploadProgress(100);
        toast({ title: "上传成功", description: "安装包已上传" });
      }
      setDialogOpen(false);
      loadPackages();
    } catch (error: any) {
      toast({ variant: "destructive", title: "操作失败", description: error.message || "请稍后重试" });
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!deletingPackage) return;

    try {
      await api.deletePackage(deletingPackage.id);
      toast({ title: "删除成功", description: "安装包已删除" });
      setDeleteDialogOpen(false);
      loadPackages();
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
          <h1 className="text-2xl font-bold">安装包管理</h1>
          <p className="text-muted-foreground">管理软件安装包（限exe格式，最大1GB）</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          上传安装包
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>版本</TableHead>
              <TableHead>大小</TableHead>
              <TableHead>上传者</TableHead>
              <TableHead>上传时间</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  暂无安装包
                </TableCell>
              </TableRow>
            ) : (
              packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell>{pkg.version || "-"}</TableCell>
                  <TableCell>{formatFileSize(pkg.file_size)}</TableCell>
                  <TableCell>{pkg.users?.display_name || pkg.users?.username || "-"}</TableCell>
                  <TableCell>{new Date(pkg.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(pkg)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingPackage(pkg);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPackage ? "编辑安装包" : "上传安装包"}</DialogTitle>
            <DialogDescription>
              {editingPackage ? "修改安装包信息" : "上传新的软件安装包（仅支持exe格式，最大1GB）"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!editingPackage && (
              <div className="space-y-2">
                <Label>选择文件 *</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  {formData.file ? (
                    <p className="text-sm">{formData.file.name} ({formatFileSize(formData.file.size)})</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">点击选择exe文件</p>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".exe"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>版本</Label>
              <Input
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                placeholder="1.0.0"
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            {uploadProgress > 0 && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-xs text-center text-muted-foreground">上传中 {uploadProgress}%</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPackage ? "保存" : "上传"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除安装包 "{deletingPackage?.name}" 吗？此操作无法撤销。
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
