// ======================================================
// ERP DIMSUM ADITYA - PHP/MySQL client
// Primary transport: browser -> PHP API directly.
// Same-origin Vercel proxy remains only as a compatibility fallback.
// ======================================================

const PHP_DIRECT_ENDPOINT = "https://dimsumaditya.id/api-v2/";
const PHP_PROXY_ENDPOINT = "/api/erp-v2";

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

  const rawMessage = String(
    result.message || result.error?.message || result.error || "Request ditolak backend."
  );
  const botBlocked = /imunify360|bot[- ]protection|automation should be whitelisted/i.test(rawMessage);

  return {
    success: false,
    message: botBlocked
      ? "Jalur koneksi server diblokir proteksi hosting. Muat ulang halaman; ERP akan memakai koneksi browser langsung."
      : rawMessage,
    data: result.data || null,
    error: result.error || null,
    code: result.code || result.error?.code || (botBlocked ? "HOSTING_BOT_PROTECTION" : "REQUEST_FAILED"),
    raw: result,
  };
};

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

function isBotProtectionText(text) {
  return /imunify360|bot[- ]protection|automation should be whitelisted/i.test(String(text || ""));
}

async function requestJson(targetUrl, body) {
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      mode: targetUrl.startsWith("http") ? "cors" : "same-origin",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      const blocked = isBotProtectionText(text);
      return {
        success: false,
        message: blocked
          ? "Koneksi ke server usaha sedang ditahan proteksi hosting."
          : "Response backend bukan JSON valid.",
        data: null,
        error: {
          code: blocked ? "HOSTING_BOT_PROTECTION" : "INVALID_JSON_RESPONSE",
          http_status: response.status,
        },
        code: blocked ? "HOSTING_BOT_PROTECTION" : "INVALID_JSON_RESPONSE",
      };
    }

    return normalizeResponse(parsed);
  } catch (err) {
    return {
      success: false,
      message: "Koneksi ke server usaha belum dapat dijangkau.",
      data: null,
      error: { code: "FETCH_ERROR", detail: err?.message || String(err) },
      code: "FETCH_ERROR",
    };
  }
}

async function requestWithTransport(body) {
  const direct = await requestJson(PHP_DIRECT_ENDPOINT, body);
  if (direct?.success || direct?.code !== "FETCH_ERROR") return direct;

  // Compatibility fallback only when browser-direct networking/CORS itself fails.
  return requestJson(PHP_PROXY_ENDPOINT, body);
}

export async function phpApiRequest(action, payload = {}, sessionToken = "") {
  return requestWithTransport(buildBody(action, payload, sessionToken));
}

export async function apiRequest(action, payload = {}, sessionToken = "") {
  return phpApiRequest(action, payload, sessionToken);
}

export function getConfiguredApiUrl() {
  return "API usaha terpusat";
}

export function getEffectiveApiEndpoint() {
  return PHP_DIRECT_ENDPOINT;
}
