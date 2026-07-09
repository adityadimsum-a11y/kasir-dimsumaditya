// ======================================================
// legacySafeRequest.js - ERP DIMSUM ADITYA
// Part 5R-1: Fetch Hotfix untuk Data Health / Action Hub
//
// Tujuan:
// - Memanggil Apps Script dengan cara aman untuk Web App
// - Pakai text/plain supaya tidak kena preflight CORS
// - Tidak mengubah transaksi, hanya helper request frontend
// ======================================================

function getApiUrl() {
  const env = import.meta.env || {};

  return (
    env.VITE_APPS_SCRIPT_URL ||
    env.VITE_GOOGLE_SCRIPT_URL ||
    env.VITE_GAS_URL ||
    env.VITE_API_URL ||
    localStorage.getItem("DA_API_URL") ||
    localStorage.getItem("VITE_APPS_SCRIPT_URL") ||
    ""
  ).trim();
}

function normalizeToken(sessionToken) {
  return String(
    sessionToken ||
      localStorage.getItem("sessionToken") ||
      localStorage.getItem("session_token") ||
      localStorage.getItem("da_session_token") ||
      localStorage.getItem("token") ||
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

  // Format normal ERP: { success, message, data }
  if (Object.prototype.hasOwnProperty.call(json, "success")) return json;

  // Format alternatif: { ok, result }
  if (Object.prototype.hasOwnProperty.call(json, "ok")) {
    return {
      success: Boolean(json.ok),
      code: json.code,
      message: json.message || json.error || (json.ok ? "Berhasil." : "Gagal."),
      data: json.data || json.result || {},
      raw: json,
    };
  }

  // Kalau backend langsung balikin object data.
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
  const apiUrl = getApiUrl();

  if (!apiUrl) {
    return {
      success: false,
      code: "API_URL_MISSING",
      message: "URL Apps Script belum terbaca di frontend. Cek VITE_APPS_SCRIPT_URL / VITE_API_URL di Vercel.",
      data: {},
    };
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      // Apps Script Web App lebih aman pakai text/plain agar tidak kena preflight CORS.
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
