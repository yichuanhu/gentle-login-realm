import { supabase } from "@/integrations/supabase/client";

// 文件大小限制
const MAX_PACKAGE_SIZE = 1073741824; // 1GB
const MAX_WORKFLOW_VIDEO_SIZE = 209715200; // 200MB

// 允许的文件扩展名
const ALLOWED_PACKAGE_EXTENSIONS = ["exe"];
const ALLOWED_WORKFLOW_EXTENSIONS = ["mp4"];

// 验证文件扩展名
function validateFileExtension(fileName: string, allowedExtensions: string[]): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext ? allowedExtensions.includes(ext) : false;
}

export const api = {
  // ===== 用户管理 (需要 admin 角色) =====
  async getUsers() {
    // 获取所有 profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) throw profilesError;

    // 获取所有用户的角色
    const { data: allRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) throw rolesError;

    // 合并数据
    const usersWithRoles = (profiles || []).map((profile) => {
      const userRoles = (allRoles || [])
        .filter((r) => r.user_id === profile.id)
        .map((r) => r.role);
      return {
        id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        roles: userRoles,
      };
    });

    return { data: usersWithRoles };
  },

  async updateUserRoles(userId: string, roles: ("admin" | "user" | "viewer")[]) {
    // 删除现有角色
    const { error: deleteError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteError) throw deleteError;

    // 添加新角色
    if (roles.length > 0) {
      const { error: insertError } = await supabase.from("user_roles").insert(
        roles.map((role) => ({ user_id: userId, role: role as "admin" | "user" | "viewer" }))
      );

      if (insertError) throw insertError;
    }

    return { success: true };
  },

  // ===== 角色管理 =====
  async getRoles() {
    const roles: ("admin" | "user" | "viewer")[] = ["admin", "user", "viewer"];

    const rolesWithMenus = await Promise.all(
      roles.map(async (role) => {
        const { data: roleMenus } = await supabase
          .from("role_menus")
          .select("menu_id, menus(*)")
          .eq("role", role);

        return {
          role,
          menus: roleMenus?.map((rm) => rm.menus).filter(Boolean) || [],
        };
      })
    );

    return { data: rolesWithMenus };
  },

  async updateRoleMenus(role: "admin" | "user" | "viewer", menuIds: string[]) {
    // 删除现有菜单关联
    const { error: deleteError } = await supabase
      .from("role_menus")
      .delete()
      .eq("role", role);

    if (deleteError) throw deleteError;

    // 添加新菜单关联
    if (menuIds.length > 0) {
      const { error: insertError } = await supabase.from("role_menus").insert(
        menuIds.map((menu_id) => ({ role: role as "admin" | "user" | "viewer", menu_id }))
      );

      if (insertError) throw insertError;
    }

    return { success: true };
  },

  // ===== 菜单管理 =====
  async getMenus() {
    const { data, error } = await supabase
      .from("menus")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return { data };
  },

  async createMenu(menuData: {
    name: string;
    path?: string;
    icon?: string;
    parent_id?: string;
    sort_order?: number;
    is_visible?: boolean;
  }) {
    const { data, error } = await supabase
      .from("menus")
      .insert({
        name: menuData.name,
        path: menuData.path,
        icon: menuData.icon,
        parent_id: menuData.parent_id,
        sort_order: menuData.sort_order || 0,
        is_visible: menuData.is_visible ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    return { data };
  },

  async updateMenu(
    id: string,
    menuData: {
      name?: string;
      path?: string;
      icon?: string;
      parent_id?: string | null;
      sort_order?: number;
      is_visible?: boolean;
    }
  ) {
    const { data, error } = await supabase
      .from("menus")
      .update(menuData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return { data };
  },

  async deleteMenu(id: string) {
    const { error } = await supabase.from("menus").delete().eq("id", id);

    if (error) throw error;
    return { success: true };
  },

  // ===== 安装包管理 =====
  async getPackages() {
    const { data, error } = await supabase
      .from("packages")
      .select("*, profiles(display_name, email)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { data };
  },

  async createPackage(packageData: {
    name: string;
    description?: string;
    file_path: string;
    file_size: number;
    version?: string;
    uploaded_by?: string;
  }) {
    const { data, error } = await supabase
      .from("packages")
      .insert(packageData)
      .select()
      .single();

    if (error) throw error;
    return { data };
  },

  async updatePackage(
    id: string,
    packageData: {
      name?: string;
      description?: string;
      version?: string;
    }
  ) {
    const { data, error } = await supabase
      .from("packages")
      .update(packageData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return { data };
  },

  async deletePackage(id: string) {
    // 先获取文件路径
    const { data: pkg } = await supabase
      .from("packages")
      .select("file_path")
      .eq("id", id)
      .single();

    if (pkg?.file_path) {
      // 删除存储中的文件
      await supabase.storage.from("packages").remove([pkg.file_path]);
    }

    const { error } = await supabase.from("packages").delete().eq("id", id);

    if (error) throw error;
    return { success: true };
  },

  // ===== 工作流管理 =====
  async getWorkflows() {
    const { data, error } = await supabase
      .from("workflows")
      .select("*, profiles(display_name, email)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { data };
  },

  async createWorkflow(workflowData: {
    title: string;
    description?: string;
    video_path?: string;
    video_size?: number;
    markdown_content?: string;
    is_public?: boolean;
    uploaded_by?: string;
  }) {
    const { data, error } = await supabase
      .from("workflows")
      .insert(workflowData)
      .select()
      .single();

    if (error) throw error;
    return { data };
  },

  async updateWorkflow(
    id: string,
    workflowData: {
      title?: string;
      description?: string;
      video_path?: string;
      video_size?: number;
      markdown_content?: string;
      is_public?: boolean;
    }
  ) {
    const { data, error } = await supabase
      .from("workflows")
      .update(workflowData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return { data };
  },

  async deleteWorkflow(id: string) {
    // 先获取视频路径
    const { data: workflow } = await supabase
      .from("workflows")
      .select("video_path")
      .eq("id", id)
      .single();

    if (workflow?.video_path) {
      // 删除存储中的视频
      await supabase.storage.from("workflows").remove([workflow.video_path]);
    }

    const { error } = await supabase.from("workflows").delete().eq("id", id);

    if (error) throw error;
    return { success: true };
  },

  // 公开接口
  async getPublicWorkflows() {
    const { data, error } = await supabase
      .from("workflows")
      .select("id, title, description, video_path, markdown_content, created_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { data };
  },

  // ===== 文件上传 (直接使用 Supabase Storage) =====
  async uploadFile(
    file: File,
    bucket: "packages" | "workflows",
    userId?: string
  ): Promise<{
    success: boolean;
    path: string;
    publicUrl?: string;
    size: number;
    uploadedBy?: string;
  }> {
    // 前端验证文件大小
    const maxSize = bucket === "packages" ? MAX_PACKAGE_SIZE : MAX_WORKFLOW_VIDEO_SIZE;
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      throw new Error(`文件大小不能超过${maxSizeMB}MB`);
    }

    // 前端验证文件扩展名
    const allowedExtensions =
      bucket === "packages"
        ? ALLOWED_PACKAGE_EXTENSIONS
        : ALLOWED_WORKFLOW_EXTENSIONS;

    if (!validateFileExtension(file.name, allowedExtensions)) {
      throw new Error(
        `只支持以下格式: ${allowedExtensions.join(", ")}`
      );
    }

    // 生成唯一文件名
    const ext = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${ext}`;

    // 直接上传到 Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        contentType: bucket === "workflows" ? "video/mp4" : "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      throw new Error("上传失败");
    }

    // 获取公开 URL（对于 workflows bucket）
    let publicUrl: string | undefined;
    if (bucket === "workflows") {
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);
      publicUrl = urlData.publicUrl;
    }

    return {
      success: true,
      path: data.path,
      publicUrl,
      size: file.size,
      uploadedBy: userId,
    };
  },
};
