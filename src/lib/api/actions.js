import { apiRequest, getConfiguredApiUrl } from "./client";

const normalizeLoginPayload = (result) => {
  const payload = result.data || {};
  const user = payload.user || {};
  const sessionToken = payload.session_token || payload.sessionToken || "";

  return {
    sessionToken,
    user: {
      ...user,
      id: user.user_id || user.id || user.username,
      name:
        user.display_name ||
        user.full_name ||
        user.name ||
        user.username ||
        "User",
      role_id: user.role_id || "",
      role_name: user.role_name || "",
      location_id: user.location_id || "",
      location_code: user.location_code || "",
      location_name: user.location_name || "",
    },
    allowedMenus: payload.allowed_menus || payload.allowedMenus || [],
    raw: payload,
  };
};

export async function loginUser({ username, password }) {
  const result = await apiRequest("login", { username, password }, "");

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    message: result.message || "Login berhasil.",
    data: normalizeLoginPayload(result),
  };
}

export async function logoutUser(sessionToken) {
  return apiRequest("logout", {}, sessionToken);
}

export async function getCurrentUser(sessionToken) {
  return apiRequest("getCurrentUser", {}, sessionToken);
}

export async function getLegacyBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyBootstrap", payload, sessionToken);
}

export async function pingBackend() {
  return apiRequest("legacyBridgePing", {}, "");
}

export { getConfiguredApiUrl };
