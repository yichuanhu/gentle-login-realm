import { supabase } from "@/integrations/supabase/client";
import { hashPassword } from "@/lib/crypto";

const getAuthHeader = () => {
  const session = localStorage.getItem("admin_session");
  if (session) {
    const parsed = JSON.parse(session);
    return { Authorization: `Bearer ${parsed.sessionToken}` };
  }
  return {};
};

export const api = {
  // 用户管理
  async getUsers() {
    const { data, error } = await supabase.functions.invoke("admin-api/users", {
      method: "GET",
      headers: getAuthHeader(),
    });
    if (error) throw error;
    return data;
  },

  async createUser(userData: any) {
    const body = { ...userData };
    if (body.password) {
      body.passwordHash = await hashPassword(body.password);
      delete body.password;
    }
    const { data, error } = await supabase.functions.invoke("admin-api/users", {
      method: "POST",
      headers: getAuthHeader(),
      body,
    });
    if (error) throw error;
    return data;
  },

  async updateUser(id: string, userData: any) {
    const body = { ...userData };
    if (body.password) {
      body.passwordHash = await hashPassword(body.password);
      delete body.password;
    }
    const { data, error } = await supabase.functions.invoke(`admin-api/users/${id}`, {
      method: "PUT",
      headers: getAuthHeader(),
      body,
    });
    if (error) throw error;
    return data;
  },

  async deleteUser(id: string) {
    const { data, error } = await supabase.functions.invoke(`admin-api/users/${id}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    if (error) throw error;
    return data;
  },

  // 角色管理
  async getRoles() {
    const { data, error } = await supabase.functions.invoke("admin-api/roles", {
      method: "GET",
      headers: getAuthHeader(),
    });
    if (error) throw error;
    return data;
  },

  async updateRoleMenus(role: string, menuIds: string[]) {
    const { data, error } = await supabase.functions.invoke(`admin-api/roles/${role}/menus`, {
      method: "PUT",
      headers: getAuthHeader(),
      body: { menu_ids: menuIds },
    });
    if (error) throw error;
    return data;
  },

  // 菜单管理
  async getMenus() {
    const { data, error } = await supabase.functions.invoke("admin-api/menus", {
      method: "GET",
      headers: getAuthHeader(),
    });
    if (error) throw error;
    return data;
  },

  async createMenu(menuData: any) {
    const { data, error } = await supabase.functions.invoke("admin-api/menus", {
      method: "POST",
      headers: getAuthHeader(),
      body: menuData,
    });
    if (error) throw error;
    return data;
  },

  async updateMenu(id: string, menuData: any) {
    const { data, error } = await supabase.functions.invoke(`admin-api/menus/${id}`, {
      method: "PUT",
      headers: getAuthHeader(),
      body: menuData,
    });
    if (error) throw error;
    return data;
  },

  async deleteMenu(id: string) {
    const { data, error } = await supabase.functions.invoke(`admin-api/menus/${id}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    if (error) throw error;
    return data;
  },

  // 安装包管理
  async getPackages() {
    const { data, error } = await supabase.functions.invoke("admin-api/packages", {
      method: "GET",
      headers: getAuthHeader(),
    });
    if (error) throw error;
    return data;
  },

  async createPackage(packageData: any) {
    const { data, error } = await supabase.functions.invoke("admin-api/packages", {
      method: "POST",
      headers: getAuthHeader(),
      body: packageData,
    });
    if (error) throw error;
    return data;
  },

  async updatePackage(id: string, packageData: any) {
    const { data, error } = await supabase.functions.invoke(`admin-api/packages/${id}`, {
      method: "PUT",
      headers: getAuthHeader(),
      body: packageData,
    });
    if (error) throw error;
    return data;
  },

  async deletePackage(id: string) {
    const { data, error } = await supabase.functions.invoke(`admin-api/packages/${id}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    if (error) throw error;
    return data;
  },

  // 流程管理
  async getWorkflows() {
    const { data, error } = await supabase.functions.invoke("admin-api/workflows", {
      method: "GET",
      headers: getAuthHeader(),
    });
    if (error) throw error;
    return data;
  },

  async createWorkflow(workflowData: any) {
    const { data, error } = await supabase.functions.invoke("admin-api/workflows", {
      method: "POST",
      headers: getAuthHeader(),
      body: workflowData,
    });
    if (error) throw error;
    return data;
  },

  async updateWorkflow(id: string, workflowData: any) {
    const { data, error } = await supabase.functions.invoke(`admin-api/workflows/${id}`, {
      method: "PUT",
      headers: getAuthHeader(),
      body: workflowData,
    });
    if (error) throw error;
    return data;
  },

  async deleteWorkflow(id: string) {
    const { data, error } = await supabase.functions.invoke(`admin-api/workflows/${id}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    if (error) throw error;
    return data;
  },

  // 公开接口
  async getPublicWorkflows() {
    const { data, error } = await supabase.functions.invoke("admin-api/public/workflows", {
      method: "GET",
    });
    if (error) throw error;
    return data;
  },

  // 文件上传
  async uploadFile(file: File, bucket: "packages" | "workflows") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", bucket);
    formData.append("fileType", file.name.split(".").pop() || "");

    const { data, error } = await supabase.functions.invoke("upload-file", {
      method: "POST",
      headers: getAuthHeader(),
      body: formData,
    });
    if (error) throw error;
    return data;
  },
};
