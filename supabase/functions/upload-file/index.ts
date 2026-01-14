import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to check user role
async function hasRole(supabase: any, userId: string, role: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  return !!data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ===== Authentication Check =====
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "未授权访问" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Validate session token
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "会话无效" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check session expiration
    if (new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "会话已过期" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = session.user_id;

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const bucket = formData.get("bucket") as string;
    const fileType = formData.get("fileType") as string;

    if (!file || !bucket) {
      return new Response(
        JSON.stringify({ error: "缺少必要参数" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== Role-based access control for packages bucket =====
    if (bucket === "packages") {
      const isAdmin = await hasRole(supabase, userId, "admin");
      const isUser = await hasRole(supabase, userId, "user");
      
      if (!isAdmin && !isUser) {
        return new Response(
          JSON.stringify({ error: "权限不足：只有管理员或用户可以上传安装包" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 文件大小验证
    const maxSize = bucket === "packages" ? 1073741824 : 209715200; // 1GB or 200MB
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return new Response(
        JSON.stringify({ error: `文件大小不能超过${maxSizeMB}MB` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== File Content Validation (Magic Bytes) =====
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // 文件类型验证 - both extension AND magic bytes
    if (bucket === "packages") {
      if (fileType !== "exe") {
        return new Response(
          JSON.stringify({ error: "安装包只支持exe格式" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // EXE magic bytes: MZ (0x4D 0x5A)
      if (bytes.length < 2 || bytes[0] !== 0x4D || bytes[1] !== 0x5A) {
        return new Response(
          JSON.stringify({ error: "文件内容不是有效的EXE格式" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (bucket === "workflows") {
      if (fileType !== "mp4") {
        return new Response(
          JSON.stringify({ error: "视频只支持mp4格式" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // MP4 magic bytes: ftyp at bytes 4-7 (0x66 0x74 0x79 0x70)
      if (bytes.length < 8 || bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) {
        return new Response(
          JSON.stringify({ error: "文件内容不是有效的MP4格式" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 生成唯一文件名
    const ext = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${ext}`;

    // Set proper content type based on bucket
    const contentType = bucket === "workflows" ? "video/mp4" : "application/octet-stream";

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, bytes, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      return new Response(
        JSON.stringify({ error: "上传失败" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 获取公开URL（对于workflows bucket）
    let publicUrl = null;
    if (bucket === "workflows") {
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);
      publicUrl = urlData.publicUrl;
    }

    return new Response(
      JSON.stringify({
        success: true,
        path: data.path,
        publicUrl,
        size: file.size,
        uploadedBy: userId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return new Response(
      JSON.stringify({ error: "服务器错误" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});