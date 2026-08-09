// Compatibility client for older internal modules.
// Transport source of truth lives in src/lib/api/client.js.
import { apiRequest as coreApiRequest, getConfiguredApiUrl as coreConfiguredApiUrl } from "../lib/api/client";

export async function apiRequest(action, payload = {}, sessionToken = "") {
  return coreApiRequest(action, payload, sessionToken);
}

export async function loginBridge({ username, password }) {
  const result = await apiRequest("login", { username, password }, "");
  if (!result.success) return result;

  const payload = result.data || {};
  const user = payload.user || {};
  const sessionToken = payload.session_token || payload.sessionToken || "";
  const roleId = String(user.role_id || "").toUpperCase();
  const roleName = String(user.role_name || "").toUpperCase();
  const isOwner = roleId.includes("OWNER") || roleName.includes("OWNER") || roleName.includes("SUPER");

  return {
    success: true,
    message: result.message || "Login berhasil.",
    sessionToken,
    allowedMenus: payload.allowed_menus || [],
    user: {
      ...user,
      id: user.user_id || user.id || user.username,
      name: user.display_name || user.full_name || user.name || user.username,
      role: user.role_name || user.role_id || "USER",
      branch_id: user.location_id || user.branch_id || "LOC-TGR",
      branch_name: user.location_name || user.branch_name || "Tangerang HO",
      branch_type: isOwner ? "HQ_FACTORY" : (user.branch_type || "BRANCH"),
      location_id: user.location_id || user.branch_id || "",
      location_name: user.location_name || user.branch_name || "",
      session_token: sessionToken,
      sessionToken,
    },
    raw: result.raw,
  };
}


export function getConfiguredApiUrl() {
  return coreConfiguredApiUrl();
}
