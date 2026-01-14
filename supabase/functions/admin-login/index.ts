import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, passwordHash } = await req.json();

    if (!username || !passwordHash) {
      return new Response(
        JSON.stringify({ success: false, error: "用户名和密码不能为空" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Clean up expired sessions periodically
    try {
      await supabase.rpc("cleanup_expired_sessions");
    } catch {
      // Ignore cleanup errors
    }

    const { data: user, error: queryError } = await supabase
      .from("users")
      .select("id, username, password_hash, display_name, is_active")
      .eq("username", username.trim())
      .maybeSingle();

    if (queryError) {
      console.error("Database query error:", queryError);
      return new Response(
        JSON.stringify({ success: false, error: "验证失败，请稍后重试" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!user || !user.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "用户名或密码错误" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 处理密码验证
    let passwordToCheck = passwordHash;
    
    // 检查是否是降级方案（非安全上下文中 crypto.subtle 不可用）
    if (passwordHash.startsWith("plain:")) {
      // 解码 base64 获取原始密码，然后进行 SHA-256 hash
      const plainPassword = atob(passwordHash.slice(6));
      const encoder = new TextEncoder();
      const data = encoder.encode(plainPassword);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      passwordToCheck = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    
    // 使用bcryptjs验证: 前端SHA-256 hash -> 后端bcrypt比较
    const passwordValid = bcrypt.compareSync(passwordToCheck, user.password_hash);

    if (!passwordValid) {
      return new Response(
        JSON.stringify({ success: false, error: "用户名或密码错误" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = roles?.map(r => r.role) || [];
    const { data: menus } = await supabase
      .from("role_menus")
      .select("menu_id, menus(*)")
      .in("role", userRoles);

    const uniqueMenus = menus?.reduce((acc: any[], item: any) => {
      if (item.menus && !acc.find(m => m.id === item.menus.id)) {
        acc.push(item.menus);
      }
      return acc;
    }, []).sort((a: any, b: any) => a.sort_order - b.sort_order) || [];

    // Generate a secure session token and store it in the database
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Delete any existing sessions for this user (single session per user)
    await supabase
      .from("sessions")
      .delete()
      .eq("user_id", user.id);

    // Create new session
    const { error: sessionError } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        token: sessionToken,
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      return new Response(
        JSON.stringify({ success: false, error: "会话创建失败" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          roles: userRoles,
          menus: uniqueMenus,
        },
        sessionToken,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "服务器错误" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
