// ======================================================
// ERP DIMSUM ADITYA - PHP/MySQL only client
// Semua menu aktif memakai proxy same-origin /api/erp-v2.
// Tidak ada fallback backend lama pada jalur operasional.
// ======================================================

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

async function requestJson(targetUrl, body) {
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
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
      return {
        success: false,
        message: "Response backend bukan JSON valid.",
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
      message: err?.message || "Koneksi backend gagal.",
      data: null,
      error: { code: "FETCH_ERROR" },
    };
  }
}

export async function phpApiRequest(action, payload = {}, sessionToken = "") {
  return requestJson(
    PHP_PROXY_ENDPOINT,
    buildBody(action, payload, sessionToken)
  );
}

// Alias kompatibilitas untuk kode lama yang masih memanggil apiRequest.
// Setelah cutover, alias ini juga selalu menuju PHP/MySQL.
export async function apiRequest(action, payload = {}, sessionToken = "") {
  return phpApiRequest(action, payload, sessionToken);
}

export function getConfiguredApiUrl() {
  return "PHP/MySQL · /api/erp-v2";
}

export function getEffectiveApiEndpoint() {
  return PHP_PROXY_ENDPOINT;
}
