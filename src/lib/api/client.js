// ======================================================
// client.js - ERP DIMSUM ADITYA
// Part 5R-3: API client pakai same-origin proxy untuk Apps Script
//
// Kenapa:
// - Browser custom domain bisa kena CORS saat fetch langsung ke script.google.com
// - Jika target API adalah Apps Script, request diarahkan ke /api/apps-script
// - Proxy Vercel yang meneruskan ke Apps Script dari server-side
// ======================================================

const PROXY_ENDPOINT = "/api/apps-script";

const getDirectApiUrl = () => {
  const localOverride =
    typeof window !== "undefined"
      ? window.localStorage.getItem("dimsum_erp_api_url")
      : "";

  return String(
    localOverride ||
      import.meta.env.VITE_ERP_API_URL ||
      import.meta.env.VITE_GAS_API_URL ||
      import.meta.env.VITE_APPS_SCRIPT_URL ||
      import.meta.env.VITE_GOOGLE_SCRIPT_URL ||
      import.meta.env.VITE_API_URL ||
      ""
  ).trim();
};

function isAppsScriptUrl(urlText) {
  try {
    const url = new URL(urlText);
    return (
      url.hostname === "script.google.com" ||
      url.hostname === "script.googleusercontent.com"
    );
  } catch {
    return false;
  }
}

function shouldUseProxy(apiUrl) {
  if (!apiUrl) return false;
  if (typeof window === "undefined") return false;
  return isAppsScriptUrl(apiUrl);
}

function buildRequestTarget(apiUrl) {
  if (shouldUseProxy(apiUrl)) return PROXY_ENDPOINT;
  return apiUrl;
}

const normalizeResponse = (result) => {
  if (!result) {
    return {
      success: false,
      message: "Response kosong dari mesin backend.",
      data: null,
    };
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
      "Request ditolak mesin backend.",
    data: result.data || null,
    error: result.error || null,
    code: result.code || result.error?.code || "REQUEST_FAILED",
    raw: result,
  };
};

function buildBody(action, payload, sessionToken, apiUrl) {
  const body = {
    action,
    route: action,
    payload,
    data: payload,
    sessionToken,
    session_token: sessionToken,
    token: sessionToken,
  };

  if (shouldUseProxy(apiUrl)) {
    body.__proxy = "vercel-apps-script";
    body.__targetApiUrl = apiUrl;
  }

  return body;
}

export async function apiRequest(action, payload = {}, sessionToken = "") {
  const apiUrl = getDirectApiUrl();
  const targetUrl = buildRequestTarget(apiUrl);

  if (!apiUrl) {
    return {
      success: false,
      message:
        "URL backend belum diset. Isi VITE_ERP_API_URL di .env atau Environment Variable Vercel.",
      data: null,
      error: {
        code: "MISSING_API_URL",
      },
    };
  }

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(buildBody(action, payload, sessionToken, apiUrl)),
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
        error: {
          code: "INVALID_JSON_RESPONSE",
          raw: text,
        },
      };
    }

    return normalizeResponse(parsed);
  } catch (err) {
    return {
      success: false,
      message: err.message || "Koneksi ke backend gagal.",
      data: null,
      error: {
        code: "FETCH_ERROR",
      },
    };
  }
}

export function getConfiguredApiUrl() {
  return getDirectApiUrl();
}

export function getEffectiveApiEndpoint() {
  const apiUrl = getDirectApiUrl();
  return buildRequestTarget(apiUrl);
}
