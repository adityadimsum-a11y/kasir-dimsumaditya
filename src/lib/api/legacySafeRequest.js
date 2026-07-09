// ======================================================
// legacySafeRequest.js - ERP DIMSUM ADITYA
// Part 5R-2: API URL Unifier untuk Data Health / Action Hub
//
// Tujuan:
// - Menyatukan pembacaan URL Apps Script dengan client.js
// - Memperbaiki kasus Data Health / Action Hub gagal fetch karena env memakai VITE_ERP_API_URL
// - Tetap aman untuk Apps Script Web App: POST text/plain agar tidak kena preflight CORS
//
// Aman:
// - Tidak membuat transaksi baru
// - Tidak memotong dompet
// - Tidak mengubah stok/payroll/closing
// ======================================================

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

function buildBody(action, payload, sessionToken) {
  const token = normalizeToken(sessionToken);

  return {
    action,
    route: action,
    sessionToken: token,
    session_token: token,
    token,
    payload: payload || {},
    data: payload || {},
  };
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
      message: "Backend tidak mengirim JSON valid. Biasanya Apps Script error, deployment belum baru, atau akses Web App salah.",
      data: {},
      raw_text: text.slice(0, 500),
    };
  }
}

export async function legacySafeRequest(action, payload = {}, sessionToken = "") {
  const apiUrl = getLegacyApiUrl();

  if (!apiUrl) {
    return {
      success: false,
      code: "API_URL_MISSING",
      message: "URL Apps Script belum terbaca di frontend. Isi VITE_ERP_API_URL atau VITE_APPS_SCRIPT_URL di Vercel.",
      data: {},
    };
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(buildBody(action, payload, sessionToken)),
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
        "Failed to fetch. Biasanya karena URL Apps Script salah/belum redeploy, akses Web App bukan Anyone, atau browser kena CORS. Cek URL deployment Vercel dan deployment Apps Script terbaru.",
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
