import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    // Validate input
    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "用户名和密码不能为空" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role key for backend operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query admin user by username
    const { data: user, error: queryError } = await supabase
      .from("admin_users")
      .select("id, username, password_hash")
      .eq("username", username.trim())
      .maybeSingle();

    if (queryError) {
      console.error("Database query error:", queryError);
      return new Response(
        JSON.stringify({ success: false, error: "验证失败，请稍后重试" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user exists and password matches
    if (!user || user.password_hash !== password) {
      return new Response(
        JSON.stringify({ success: false, error: "用户名或密码错误" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Login successful - generate a simple session token
    const sessionToken = crypto.randomUUID();

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          username: user.username,
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
