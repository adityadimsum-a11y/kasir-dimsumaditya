// Compatibility client for older internal modules.
// Source of truth after cutover: PHP/MySQL through the same-origin Vercel proxy.
const API_ENDPOINT = "/api/erp-v2";

const normalizeResponse = (result) => {
  if (!result) {
    return { success: false, message: "Response kosong dari mesin ERP.", data: null };
  }

  if (result.success === true || result.status === "success" || result.ok === true) {
    return {
      success: true,
      message: result.message || "Berhasil.",
      data: result.data ?? result.result ?? result,
      meta: result.meta || {},
      raw: result,
    };
  }

  return {
    success: false,
    message: result.message || result.error?.message || "Request ditolak mesin ERP.",
    data: result.data || null,
    error: result.error || null,
    raw: result,
  };
};

export async function apiRequest(action, payload = {}, sessionToken = "") {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        action,
        route: action,
        payload,
        data: payload,
        sessionToken,
        session_token: sessionToken,
        token: sessionToken,
        operation_id:
          payload?.operation_id ||
          payload?.operationId ||
          payload?.request_id ||
          payload?.requestId ||
          "",
      }),
    });

    const text = await response.text();
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        success: false,
        message: "Response backend PHP/MySQL bukan JSON valid.",
        data: null,
        error: {
          code: "INVALID_JSON_RESPONSE",
          http_status: response.status,
          raw: text.slice(0, 500),
        },
      };
    }

    return normalizeResponse(parsed);
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Koneksi backend PHP/MySQL gagal.",
      data: null,
      error: { code: "FETCH_ERROR" },
    };
  }
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
  return API_ENDPOINT;
}
