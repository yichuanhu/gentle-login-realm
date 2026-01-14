import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Pencil, Trash2, Loader2, Upload, GitBranch, Eye, EyeOff, Play } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Workflow {
  id: string;
  title: string;
  description: string | null;
  video_path: string | null;
  video_size: number | null;
  markdown_content: string | null;
  is_public: boolean;
  uploaded_by: string | null;
  created_at: string;
  users?: { username: string; display_name: string | null };
}

const MAX_VIDEO_SIZE = 209715200; // 200MB

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [deletingWorkflow, setDeletingWorkflow] = useState<Workflow | null>(null);
  const [previewingWorkflow, setPreviewingWorkflow] = useState<Workflow | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { session } = useAuth();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    markdown_content: "",
    is_public: false,
    video: null as File | null,
    existingVideoPath: null as string | null,
  });

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const result = await api.getWorkflows();
      setWorkflows(result.data || []);
    } catch (error) {
      toast({ variant: "destructive", title: "加载失败", description: "无法加载流程列表" });
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

  const getVideoUrl = (path: string | null) => {
    if (!path) return null;
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/workflows/${path}`;
  };

  const openCreateDialog = () => {
    setEditingWorkflow(null);
    setFormData({
      title: "",
      description: "",
      markdown_content: "",
      is_public: false,
      video: null,
      existingVideoPath: null,
    });
    setUploadProgress(0);
    setDialogOpen(true);
  };

  const openEditDialog = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setFormData({
      title: workflow.title,
      description: workflow.description || "",
      markdown_content: workflow.markdown_content || "",
      is_public: workflow.is_public,
      video: null,
      existingVideoPath: workflow.video_path,
    });
    setDialogOpen(true);
  };

  const openPreviewDialog = (workflow: Workflow) => {
    setPreviewingWorkflow(workflow);
    setPreviewDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".mp4")) {
      toast({ variant: "destructive", title: "错误", description: "只支持mp4格式的视频" });
      return;
    }

    if (file.size > MAX_VIDEO_SIZE) {
      toast({ variant: "destructive", title: "错误", description: "视频大小不能超过200MB" });
      return;
    }

    setFormData({ ...formData, video: file });
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast({ variant: "destructive", title: "错误", description: "标题不能为空" });
      return;
    }

    setSaving(true);
    try {
      let videoPath = formData.existingVideoPath;
      let videoSize = editingWorkflow?.video_size;

      // 上传新视频
      if (formData.video) {
        setUploadProgress(10);
        const uploadResult = await api.uploadFile(formData.video, "workflows");
        setUploadProgress(80);
        videoPath = uploadResult.path;
        videoSize = uploadResult.size;
      }

      if (editingWorkflow) {
        await api.updateWorkflow(editingWorkflow.id, {
          title: formData.title,
          description: formData.description || null,
          markdown_content: formData.markdown_content || null,
          is_public: formData.is_public,
          video_path: videoPath,
          video_size: videoSize,
        });
        toast({ title: "更新成功", description: "流程已更新" });
      } else {
        await api.createWorkflow({
          title: formData.title,
          description: formData.description || null,
          markdown_content: formData.markdown_content || null,
          is_public: formData.is_public,
          video_path: videoPath,
          video_size: videoSize,
          uploaded_by: session?.id,
        });
        toast({ title: "创建成功", description: "流程已创建" });
      }
      setUploadProgress(100);
      setDialogOpen(false);
      loadWorkflows();
    } catch (error: any) {
      toast({ variant: "destructive", title: "操作失败", description: error.message || "请稍后重试" });
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!deletingWorkflow) return;

    try {
      await api.deleteWorkflow(deletingWorkflow.id);
      toast({ title: "删除成功", description: "流程已删除" });
      setDeleteDialogOpen(false);
      loadWorkflows();
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
          <h1 className="text-2xl font-bold">流程管理</h1>
          <p className="text-muted-foreground">管理工作流程（视频+Markdown说明）</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          新建流程
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>视频</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>上传者</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="w-[140px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  暂无流程
                </TableCell>
              </TableRow>
            ) : (
              workflows.map((workflow) => (
                <TableRow key={workflow.id}>
                  <TableCell className="font-medium">{workflow.title}</TableCell>
                  <TableCell>
                    {workflow.video_path ? (
                      <span className="text-green-600">已上传 ({formatFileSize(workflow.video_size || 0)})</span>
                    ) : (
                      <span className="text-muted-foreground">无</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {workflow.is_public ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <Eye className="h-4 w-4" /> 公开
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <EyeOff className="h-4 w-4" /> 隐藏
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{workflow.users?.display_name || workflow.users?.username || "-"}</TableCell>
                  <TableCell>{new Date(workflow.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openPreviewDialog(workflow)}>
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(workflow)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingWorkflow(workflow);
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

      {/* 编辑/创建对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingWorkflow ? "编辑流程" : "新建流程"}</DialogTitle>
            <DialogDescription>
              {editingWorkflow ? "修改流程信息" : "创建新的工作流程"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>标题 *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_public}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
                  />
                  <Label>公开流程</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>描述</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>视频（mp4，最大200MB）</Label>
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                {formData.video ? (
                  <p className="text-sm">{formData.video.name} ({formatFileSize(formData.video.size)})</p>
                ) : formData.existingVideoPath ? (
                  <p className="text-sm text-green-600">已有视频，点击更换</p>
                ) : (
                  <p className="text-sm text-muted-foreground">点击选择mp4视频</p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,video/mp4"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="space-y-2">
              <Label>Markdown内容</Label>
              <Tabs defaultValue="edit">
                <TabsList>
                  <TabsTrigger value="edit">编辑</TabsTrigger>
                  <TabsTrigger value="preview">预览</TabsTrigger>
                </TabsList>
                <TabsContent value="edit">
                  <Textarea
                    value={formData.markdown_content}
                    onChange={(e) => setFormData({ ...formData, markdown_content: e.target.value })}
                    rows={10}
                    className="font-mono"
                    placeholder="# 标题&#10;&#10;## 步骤一&#10;&#10;描述内容..."
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <div className="border rounded-lg p-4 min-h-[200px] prose prose-sm max-w-none dark:prose-invert">
                    {formData.markdown_content ? (
                      <ReactMarkdown>{formData.markdown_content}</ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground">暂无内容</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {uploadProgress > 0 && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-xs text-center text-muted-foreground">上传中 {uploadProgress}%</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingWorkflow ? "保存" : "创建"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 预览对话框 */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewingWorkflow?.title}</DialogTitle>
            <DialogDescription>{previewingWorkflow?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {previewingWorkflow?.video_path && (
              <div>
                <video
                  src={getVideoUrl(previewingWorkflow.video_path) || ""}
                  controls
                  className="w-full rounded-lg"
                />
              </div>
            )}
            {previewingWorkflow?.markdown_content && (
              <div className="border rounded-lg p-4 prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{previewingWorkflow.markdown_content}</ReactMarkdown>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除流程 "{deletingWorkflow?.title}" 吗？此操作无法撤销。
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
