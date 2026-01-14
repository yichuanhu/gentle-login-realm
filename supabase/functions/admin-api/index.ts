import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to validate session and get user info
async function validateSession(supabase: any, authHeader: string | null): Promise<{ valid: boolean; userId?: string; error?: string }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "未授权访问" };
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return { valid: false, error: "无效的授权令牌" };
  }

  // Query session from database
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (sessionError || !session) {
    return { valid: false, error: "会话无效或已过期" };
  }

  // Check if session is expired
  if (new Date(session.expires_at) < new Date()) {
    // Clean up expired session
    await supabase.from("sessions").delete().eq("token", token);
    return { valid: false, error: "会话已过期，请重新登录" };
  }

  // Verify user is still active
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, is_active")
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError || !user || !user.is_active) {
    return { valid: false, error: "用户账号已被禁用" };
  }

  return { valid: true, userId: session.user_id };
}

// Helper function to check if user has a specific role
async function hasRole(supabase: any, userId: string, requiredRole: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", requiredRole)
    .maybeSingle();

  return !!data;
}

// Helper function to check if user has any of the specified roles
async function hasAnyRole(supabase: any, userId: string, requiredRoles: string[]): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", requiredRoles);

  return data && data.length > 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const path = url.pathname.replace("/admin-api", "");
    const method = req.method;

    // Public endpoints don't require authentication
    if (path.startsWith("/public/")) {
      // Handle public endpoints
      if (path === "/public/workflows" && method === "GET") {
        const { data, error } = await supabase
          .from("workflows")
          .select("id, title, description, video_path, markdown_content, created_at")
          .eq("is_public", true)
          .order("created_at", { ascending: false });

        if (error) throw error;

        return new Response(
          JSON.stringify({ data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "接口不存在" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate session for all non-public endpoints
    const authHeader = req.headers.get("Authorization");
    const sessionResult = await validateSession(supabase, authHeader);

    if (!sessionResult.valid) {
      return new Response(
        JSON.stringify({ error: sessionResult.error }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = sessionResult.userId!;

    // ===== 用户管理 (requires admin role) =====
    if (path === "/users" && method === "GET") {
      if (!await hasRole(supabase, userId, "admin")) {
        return new Response(
          JSON.stringify({ error: "权限不足" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("users")
        .select("id, username, display_name, email, is_active, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const usersWithRoles = await Promise.all(
        (data || []).map(async (user) => {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);
          return { ...user, roles: roles?.map(r => r.role) || [] };
        })
      );

      return new Response(
        JSON.stringify({ data: usersWithRoles }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path === "/users" && method === "POST") {
      if (!await hasRole(supabase, userId, "admin")) {
        return new Response(
          JSON.stringify({ error: "权限不足" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const { username, passwordHash, display_name, email, is_active, roles } = body;

      if (!username || !passwordHash) {
        return new Response(
          JSON.stringify({ error: "用户名和密码不能为空" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 前端已SHA-256，后端再bcrypt加密存储
      const finalPasswordHash = bcrypt.hashSync(passwordHash, 10);

      const { data: user, error } = await supabase
        .from("users")
        .insert({ username, password_hash: finalPasswordHash, display_name, email, is_active: is_active ?? true })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return new Response(
            JSON.stringify({ error: "用户名已存在" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw error;
      }

      if (roles && roles.length > 0) {
        await supabase
          .from("user_roles")
          .insert(roles.map((role: string) => ({ user_id: user.id, role })));
      }

      return new Response(
        JSON.stringify({ data: user }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path.startsWith("/users/") && method === "PUT") {
      if (!await hasRole(supabase, userId, "admin")) {
        return new Response(
          JSON.stringify({ error: "权限不足" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const id = path.split("/")[2];
      const body = await req.json();
      const { username, passwordHash, display_name, email, is_active, roles } = body;

      const updateData: any = { username, display_name, email, is_active };
      if (passwordHash) {
        // 前端已SHA-256，后端再bcrypt加密存储
        updateData.password_hash = bcrypt.hashSync(passwordHash, 10);
      }

      const { data: user, error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      if (roles) {
        await supabase.from("user_roles").delete().eq("user_id", id);
        if (roles.length > 0) {
          await supabase
            .from("user_roles")
            .insert(roles.map((role: string) => ({ user_id: id, role })));
        }
      }

      return new Response(
        JSON.stringify({ data: user }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path.startsWith("/users/") && method === "DELETE") {
      if (!await hasRole(supabase, userId, "admin")) {
        return new Response(
          JSON.stringify({ error: "权限不足" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const id = path.split("/")[2];

      if (id === "00000000-0000-0000-0000-000000000001") {
        return new Response(
          JSON.stringify({ error: "不能删除默认管理员" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase.from("users").delete().eq("id", id);
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== 角色管理 (requires admin role) =====
    if (path === "/roles" && method === "GET") {
      if (!await hasRole(supabase, userId, "admin")) {
        return new Response(
          JSON.stringify({ error: "权限不足" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const roles = ["admin", "user", "viewer"];
      const rolesWithMenus = await Promise.all(
        roles.map(async (role) => {
          const { data: roleMenus } = await supabase
            .from("role_menus")
            .select("menu_id, menus(*)")
            .eq("role", role);
          return {
            role,
            menus: roleMenus?.map(rm => rm.menus).filter(Boolean) || [],
          };
        })
      );

      return new Response(
        JSON.stringify({ data: rolesWithMenus }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path.startsWith("/roles/") && path.endsWith("/menus") && method === "PUT") {
      if (!await hasRole(supabase, userId, "admin")) {
        return new Response(
          JSON.stringify({ error: "权限不足" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const role = path.split("/")[2];
      const body = await req.json();
      const { menu_ids } = body;

      await supabase.from("role_menus").delete().eq("role", role);
      if (menu_ids && menu_ids.length > 0) {
        await supabase
          .from("role_menus")
          .insert(menu_ids.map((menu_id: string) => ({ role, menu_id })));
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== 菜单管理 (requires admin role) =====
    if (path === "/menus" && method === "GET") {
      if (!await hasRole(supabase, userId, "admin")) {
        return new Response(
          JSON.stringify({ error: "权限不足" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path === "/menus" && method === "POST") {
      if (!await hasRole(supabase, userId, "admin")) {
        return new Response(
          JSON.stringify({ error: "权限不足" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const { name, path: menuPath, icon, parent_id, sort_order, is_visible } = body;

      const { data, error } = await supabase
        .from("menus")
        .insert({ name, path: menuPath, icon, parent_id, sort_order: sort_order || 0, is_visible: is_visible ?? true })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path.startsWith("/menus/") && method === "PUT") {
      if (!await hasRole(supabase, userId, "admin")) {
        return new Response(
          JSON.stringify({ error: "权限不足" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const id = path.split("/")[2];
      const body = await req.json();
      const { name, path: menuPath, icon, parent_id, sort_order, is_visible } = body;

      const { data, error } = await supabase
        .from("menus")
        .update({ name, path: menuPath, icon, parent_id, sort_order, is_visible })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path.startsWith("/menus/") && method === "DELETE") {
      if (!await hasRole(supabase, userId, "admin")) {
        return new Response(
          JSON.stringify({ error: "权限不足" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const id = path.split("/")[2];
      const { error } = await supabase.from("menus").delete().eq("id", id);
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== 安装包管理 (requires admin or user role) =====
    if (path === "/packages" && method === "GET") {
      if (!await hasAnyRole(supabase, userId, ["admin", "user"])) {
        return new Response(
          JSON.stringify({ error: "权限不足" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("packages")
        .select("*, users(username, display_name)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path === "/packages" && method === "POST") {
      if (!await hasAnyRole(supabase, userId, ["admin", "user"])) {
        return new Response(
          JSON.stringify({ error: "权限不足" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const { name, description, file_path, file_size, version, uploaded_by } = body;

      if (file_size > 1073741824) {
        return new Response(
          JSON.stringify({ error: "文件大小不能超过1GB" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("packages")
        .insert({ name, description, file_path, file_size, version, uploaded_by })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path.startsWith("/packages/") && method === "PUT") {
      if (!await hasAnyRole(supabase, userId, ["admin", "user"])) {
        return new Response(
          JSON.stringify({ error: "权限不足" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const id = path.split("/")[2];
      const body = await req.json();
      const { name, description, version } = body;

      const { data, error } = await supabase
        .from("packages")
        .update({ name, description, version })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path.startsWith("/packages/") && method === "DELETE") {
      if (!await hasAnyRole(supabase, userId, ["admin", "user"])) {
        return new Response(
          JSON.stringify({ error: "权限不足" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const id = path.split("/")[2];

      const { data: pkg } = await supabase
        .from("packages")
        .select("file_path")
        .eq("id", id)
        .single();

      if (pkg?.file_path) {
        await supabase.storage.from("packages").remove([pkg.file_path]);
      }

      const { error } = await supabase.from("packages").delete().eq("id", id);
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== 流程管理 (requires authenticated user) =====
    if (path === "/workflows" && method === "GET") {
      // Any authenticated user can view workflows
      const { data, error } = await supabase
        .from("workflows")
        .select("*, users(username, display_name)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path === "/workflows" && method === "POST") {
      // Any authenticated user can create workflows
      const body = await req.json();
      const { title, description, video_path, video_size, markdown_content, is_public, uploaded_by } = body;

      if (video_size && video_size > 209715200) {
        return new Response(
          JSON.stringify({ error: "视频大小不能超过200MB" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("workflows")
        .insert({ title, description, video_path, video_size, markdown_content, is_public: is_public ?? false, uploaded_by })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path.startsWith("/workflows/") && method === "PUT") {
      // Any authenticated user can update workflows
      const id = path.split("/")[2];
      const body = await req.json();
      const { title, description, video_path, video_size, markdown_content, is_public } = body;

      const updateData: any = { title, description, markdown_content, is_public };
      if (video_path !== undefined) {
        updateData.video_path = video_path;
        updateData.video_size = video_size;
      }

      const { data, error } = await supabase
        .from("workflows")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path.startsWith("/workflows/") && method === "DELETE") {
      // Any authenticated user can delete workflows
      const id = path.split("/")[2];

      const { data: workflow } = await supabase
        .from("workflows")
        .select("video_path")
        .eq("id", id)
        .single();

      if (workflow?.video_path) {
        await supabase.storage.from("workflows").remove([workflow.video_path]);
      }

      const { error } = await supabase.from("workflows").delete().eq("id", id);
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "接口不存在" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("API error:", error);
    return new Response(
      JSON.stringify({ error: "服务器错误" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
