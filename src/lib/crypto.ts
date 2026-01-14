/**
 * 使用 Web Crypto API 对密码进行 SHA-256 hash
 * 前端hash后传输，避免明文密码在网络中传输
 * 
 * 注意：crypto.subtle 只在安全上下文（HTTPS 或 localhost）中可用
 * 在非安全上下文中，会使用简单的字符串编码作为降级方案
 */
export async function hashPassword(password: string): Promise<string> {
  // 检查 crypto.subtle 是否可用（需要安全上下文）
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
  }
  
  // 降级方案：使用简单的 base64 编码 + 标记
  // 后端需要识别这个标记并特殊处理
  console.warn("crypto.subtle 不可用，使用降级方案。请确保使用 HTTPS 或 localhost。");
  return `plain:${btoa(password)}`;
}
