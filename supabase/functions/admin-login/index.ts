import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "用户名和密码不能为空" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const passwordValid = await bcrypt.compare(password, user.password_hash);
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

    const sessionToken = crypto.randomUUID();

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
