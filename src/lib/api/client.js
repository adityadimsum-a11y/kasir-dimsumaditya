const readLocalApiUrl = () => {
  if (typeof window === "undefined") return "";

  return (
    window.localStorage.getItem("dimsum_erp_api_url") ||
    window.localStorage.getItem("DA_API_URL") ||
    window.localStorage.getItem("VITE_ERP_API_URL") ||
    window.localStorage.getItem("VITE_APPS_SCRIPT_URL") ||
    window.localStorage.getItem("VITE_API_URL") ||
    ""
  ).trim();
};

const getApiUrl = () => {
  const env = import.meta.env || {};

  return (
    readLocalApiUrl() ||
    env.VITE_ERP_API_URL ||
    env.VITE_APPS_SCRIPT_URL ||
    env.VITE_GOOGLE_SCRIPT_URL ||
    env.VITE_GAS_API_URL ||
    env.VITE_GAS_URL ||
    env.VITE_API_URL ||
    ""
  ).trim();
};

const normalizeResponse = (result) => {
  if (!result) {
    return {
      success: false,
      message: "Response kosong dari mesin backend.",
      data: null,
    };
  }

  if (result.success === true || result.status === "success") {
    return {
      success: true,
      message: result.message || "Berhasil.",
      data: result.data ?? result,
      meta: result.meta || {},
      raw: result,
    };
  }

  return {
    success: false,
    message:
      result.message ||
      result.error?.message ||
      "Request ditolak mesin backend.",
    data: result.data || null,
    error: result.error || null,
    raw: result,
  };
};

export async function apiRequest(action, payload = {}, sessionToken = "") {
  const apiUrl = getApiUrl();

  if (!apiUrl) {
    return {
      success: false,
      message:
        "URL backend belum diset. Isi VITE_ERP_API_URL atau VITE_APPS_SCRIPT_URL di Environment Variable Vercel.",
      data: null,
      error: {
        code: "MISSING_API_URL",
      },
    };
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        action,
        route: action,
        payload,
        data: payload,
        sessionToken,
        session_token: sessionToken,
        token: sessionToken,
      }),
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
  return getApiUrl();
}
