// ======================================================
// ERP DIMSUM ADITYA - Frontend Cutover Hybrid Client
// PHP + MySQL = primary source for migrated core modules.
// Apps Script = temporary fallback ONLY for modules not migrated yet.
// ======================================================

const PHP_PROXY_ENDPOINT = "/api/erp-v2";
const LEGACY_PROXY_ENDPOINT = "/api/apps-script";
const SESSION_KEY = "dimsum_aditya_session_v1";

const normalizeResponse = (result) => {
  if (!result) {
    return { success: false, message: "Response kosong dari backend.", data: null };
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
    message:
      result.message ||
      result.error?.message ||
      result.error ||
      "Request ditolak backend.",
    data: result.data || null,
    error: result.error || null,
    code: result.code || result.error?.code || "REQUEST_FAILED",
    raw: result,
  };
};

function getSavedSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function getLegacySessionToken() {
  return getSavedSession()?.legacySessionToken || "";
}

export function getLegacyApiUrl() {
  const localOverride =
    typeof window !== "undefined"
      ? window.localStorage.getItem("dimsum_legacy_erp_api_url")
      : "";

  return String(
    localOverride ||
      import.meta.env.VITE_LEGACY_ERP_API_URL ||
      import.meta.env.VITE_GAS_API_URL ||
      import.meta.env.VITE_APPS_SCRIPT_URL ||
      import.meta.env.VITE_GOOGLE_SCRIPT_URL ||
      ""
  ).trim();
}

function buildBody(action, payload, sessionToken) {
  return {
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
  };
}

async function requestJson(targetUrl, body, contentType = "application/json") {
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        success: false,
        message: "Response backend bukan JSON valid.",
        data: null,
        error: { code: "INVALID_JSON_RESPONSE", raw: text.slice(0, 500) },
      };
    }

    return normalizeResponse(parsed);
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Koneksi backend gagal.",
      data: null,
      error: { code: "FETCH_ERROR" },
    };
  }
}

export async function phpApiRequest(action, payload = {}, sessionToken = "") {
  return requestJson(
    PHP_PROXY_ENDPOINT,
    buildBody(action, payload, sessionToken),
    "application/json"
  );
}

export async function legacyApiRequest(action, payload = {}, sessionToken = "") {
  const apiUrl = getLegacyApiUrl();

  if (!apiUrl) {
    return {
      success: false,
      message: "Backend legacy Apps Script belum dikonfigurasi.",
      data: null,
      error: { code: "LEGACY_API_URL_MISSING" },
    };
  }

  const effectiveToken = sessionToken || getLegacySessionToken();
  const body = buildBody(action, payload, effectiveToken);
  body.__proxy = "vercel-apps-script";
  body.__targetApiUrl = apiUrl;

  return requestJson(
    LEGACY_PROXY_ENDPOINT,
    body,
    "text/plain;charset=utf-8"
  );
}

// Default apiRequest sengaja tetap legacy.
// Migrated core actions WAJIB memanggil phpApiRequest secara eksplisit di actions.js.
export async function apiRequest(action, payload = {}, sessionToken = "") {
  return legacyApiRequest(action, payload, sessionToken);
}

export function getConfiguredApiUrl() {
  return "PHP/MySQL primary · Apps Script fallback";
}

export function getEffectiveApiEndpoint() {
  return PHP_PROXY_ENDPOINT;
}
