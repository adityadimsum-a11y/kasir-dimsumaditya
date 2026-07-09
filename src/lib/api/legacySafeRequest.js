// ======================================================
// legacySafeRequest.js - ERP DIMSUM ADITYA
// Part 5R-3: Same-Origin Apps Script Proxy / CORS Fix
//
// Tujuan:
// - Data Health / Action Hub tidak fetch langsung ke script.google.com dari browser
// - Jika URL backend adalah Apps Script, request masuk dulu ke /api/apps-script
// - Vercel proxy meneruskan ke Apps Script dari server-side supaya tidak kena CORS browser
//
// Aman:
// - Tidak membuat transaksi baru
// - Tidak memotong dompet
// - Tidak mengubah stok/payroll/closing
// ======================================================

const PROXY_ENDPOINT = "/api/apps-script";

function readLocalStorage(keys) {
  if (typeof window === "undefined") return "";

  for (const key of keys) {
    const value = window.localStorage.getItem(key);
    if (String(value || "").trim()) return String(value || "").trim();
  }

  return "";
}

export function getLegacyApiUrl() {
  const env = import.meta.env || {};

  return String(
    env.VITE_ERP_API_URL ||
      env.VITE_APPS_SCRIPT_URL ||
      env.VITE_GOOGLE_SCRIPT_URL ||
      env.VITE_GAS_API_URL ||
      env.VITE_GAS_URL ||
      env.VITE_API_URL ||
      readLocalStorage([
        "dimsum_erp_api_url",
        "DA_API_URL",
        "VITE_ERP_API_URL",
        "VITE_APPS_SCRIPT_URL",
        "VITE_API_URL",
      ]) ||
      ""
  ).trim();
}

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

function getRequestEndpoint(apiUrl) {
  if (shouldUseProxy(apiUrl)) return PROXY_ENDPOINT;
  return apiUrl;
}

function normalizeToken(sessionToken) {
  return String(
    sessionToken ||
      readLocalStorage([
        "sessionToken",
        "session_token",
        "da_session_token",
        "token",
      ]) ||
      ""
  ).trim();
}

function buildBody(action, payload, sessionToken, apiUrl) {
  const token = normalizeToken(sessionToken);

  const body = {
    action,
    route: action,
    sessionToken: token,
    session_token: token,
    token,
    payload: payload || {},
    data: payload || {},
  };

  if (shouldUseProxy(apiUrl)) {
    body.__proxy = "vercel-apps-script";
    body.__targetApiUrl = apiUrl;
  }

  return body;
}

function normalizeResult(json) {
  if (!json || typeof json !== "object") {
    return {
      success: false,
      code: "EMPTY_RESPONSE",
      message: "Backend tidak mengirim response JSON.",
      data: {},
    };
  }

  if (Object.prototype.hasOwnProperty.call(json, "success")) return json;

  if (Object.prototype.hasOwnProperty.call(json, "ok")) {
    return {
      success: Boolean(json.ok),
      code: json.code,
      message: json.message || json.error || (json.ok ? "Berhasil." : "Gagal."),
      data: json.data || json.result || {},
      raw: json,
    };
  }

  return {
    success: true,
    message: "Berhasil.",
    data: json.data || json.result || json,
    raw: json,
  };
}

async function readResponseSafely(res) {
  const text = await res.text();

  if (!text) {
    return {
      success: false,
      code: "EMPTY_BODY",
      message: "Backend kosong. Cek deploy Apps Script / permission Web App.",
      data: {},
    };
  }

  try {
    return normalizeResult(JSON.parse(text));
  } catch (err) {
    return {
      success: false,
      code: "INVALID_JSON",
      message:
        "Backend tidak mengirim JSON valid. Biasanya Apps Script error, deployment belum baru, atau akses Web App salah.",
      data: {},
      raw_text: text.slice(0, 500),
    };
  }
}

export async function legacySafeRequest(action, payload = {}, sessionToken = "") {
  const apiUrl = getLegacyApiUrl();
  const requestEndpoint = getRequestEndpoint(apiUrl);

  if (!apiUrl) {
    return {
      success: false,
      code: "API_URL_MISSING",
      message:
        "URL Apps Script belum terbaca di frontend. Isi VITE_ERP_API_URL atau VITE_APPS_SCRIPT_URL di Vercel.",
      data: {},
    };
  }

  try {
    const res = await fetch(requestEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(buildBody(action, payload, sessionToken, apiUrl)),
    });

    const json = await readResponseSafely(res);

    if (!res.ok && json.success !== false) {
      return {
        success: false,
        code: "HTTP_" + res.status,
        message: "Backend menolak request: HTTP " + res.status,
        data: {},
        raw: json,
      };
    }

    return json;
  } catch (err) {
    return {
      success: false,
      code: "FETCH_FAILED",
      message:
        "Failed to fetch. Jika target Apps Script, cek file /api/apps-script.js sudah ikut deploy Vercel. Jika belum, browser masih kena CORS.",
      detail: err?.message || String(err),
      data: {},
    };
  }
}

export function isLegacyAuthRequired(result) {
  const code = String(result?.code || result?.error?.code || "").toUpperCase();
  const message = String(result?.message || "").toUpperCase();

  return (
    code === "UNAUTHORIZED" ||
    code === "SESSION_EXPIRED" ||
    code === "AUTH_REQUIRED" ||
    message.includes("AUTH_REQUIRED") ||
    message.includes("SESSION")
  );
}
