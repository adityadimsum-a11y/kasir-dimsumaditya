// ======================================================
// api/apps-script.js - ERP DIMSUM ADITYA
// Part 5R-4: Apps Script Proxy Diagnostic Fix
//
// Letakkan file ini di ROOT project Vercel:
// api/apps-script.js
//
// Fungsi:
// - Browser memanggil /api/apps-script di domain sendiri
// - Vercel server memanggil Apps Script dari server-side
// - Menghindari CORS browser
// - Jika Apps Script membalas HTML/login/error, response dibuat JSON jelas
//
// Aman:
// - Proxy request saja
// - Tidak membuat transaksi sendiri
// - Tidak mengubah saldo/stok/payroll/closing
// ======================================================

const ALLOWED_HOSTS = new Set([
  "script.google.com",
  "script.googleusercontent.com",
]);

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;

  try {
    return JSON.parse(String(req.body || "{}"));
  } catch (err) {
    return {};
  }
}

function pickTargetUrl(body) {
  return String(
    process.env.APPS_SCRIPT_URL ||
      process.env.GAS_API_URL ||
      process.env.GOOGLE_SCRIPT_URL ||
      process.env.VITE_ERP_API_URL ||
      process.env.VITE_GAS_API_URL ||
      process.env.VITE_APPS_SCRIPT_URL ||
      process.env.VITE_GOOGLE_SCRIPT_URL ||
      process.env.VITE_API_URL ||
      body.__targetApiUrl ||
      body.__apiUrl ||
      ""
  ).trim();
}

function isAllowedTarget(urlText) {
  try {
    const url = new URL(urlText);
    return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname);
  } catch (err) {
    return false;
  }
}

function cleanForwardBody(body) {
  const next = { ...(body || {}) };
  delete next.__targetApiUrl;
  delete next.__apiUrl;
  delete next.__proxy;
  return next;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function looksLikeHtml(text) {
  const t = String(text || "").trim().slice(0, 3000).toLowerCase();
  return (
    t.startsWith("<!doctype") ||
    t.startsWith("<html") ||
    t.includes("<body") ||
    t.includes("accounts.google.com") ||
    t.includes("servicelogin") ||
    t.includes("script.googleusercontent.com")
  );
}

function classifyInvalidText(text) {
  const raw = String(text || "");
  const t = raw.toLowerCase();

  if (looksLikeHtml(raw)) {
    if (
      t.includes("accounts.google.com") ||
      t.includes("servicelogin") ||
      t.includes("sign in") ||
      t.includes("masuk")
    ) {
      return {
        code: "WEB_APP_ACCESS_NOT_ANYONE",
        message:
          "Apps Script membalas halaman login Google, bukan JSON. Ubah Web App access menjadi Anyone / Siapa saja, lalu Deploy new version.",
      };
    }

    if (t.includes("script function not found") || t.includes("fungsi skrip tidak ditemukan")) {
      return {
        code: "APPS_SCRIPT_FUNCTION_NOT_FOUND",
        message:
          "Apps Script membalas HTML error function not found. Pastikan doPost(e) ada dan sudah deploy versi terbaru.",
      };
    }

    if (t.includes("authorization") || t.includes("permission") || t.includes("izin")) {
      return {
        code: "APPS_SCRIPT_PERMISSION_ERROR",
        message:
          "Apps Script membalas error permission/authorization. Cek Execute as, akses Web App, dan otorisasi project Apps Script.",
      };
    }

    return {
      code: "UPSTREAM_HTML_RESPONSE",
      message:
        "Apps Script membalas HTML, bukan JSON. Biasanya Web App belum Anyone, URL deployment salah, atau deployment masih versi lama.",
    };
  }

  if (t.includes("exception") || t.includes("error")) {
    return {
      code: "APPS_SCRIPT_TEXT_ERROR",
      message:
        "Apps Script membalas text error, bukan JSON. Buka Apps Script Executions untuk melihat error detail.",
    };
  }

  return {
    code: "UPSTREAM_INVALID_JSON",
    message:
      "Apps Script tidak membalas JSON valid. Cek deployment Web App, URL /exec, dan permission akses.",
  };
}

function safeSnippet(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

async function forwardToAppsScript(targetUrl, forwardBody) {
  const upstream = await fetch(targetUrl, {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
      "Accept": "application/json,text/plain,*/*",
    },
    body: JSON.stringify(forwardBody),
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get("content-type") || "";
  const finalUrl = upstream.url || targetUrl;

  return {
    upstream,
    text,
    contentType,
    finalUrl,
  };
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const body = req.method === "POST" ? parseBody(req) : {};
  const targetUrl = pickTargetUrl(body);

  if (!targetUrl) {
    sendJson(res, 200, {
      success: false,
      code: "APPS_SCRIPT_URL_MISSING",
      message:
        "URL Apps Script belum tersedia di proxy. Isi VITE_ERP_API_URL atau APPS_SCRIPT_URL di Environment Variable Vercel.",
    });
    return;
  }

  if (!isAllowedTarget(targetUrl)) {
    sendJson(res, 200, {
      success: false,
      code: "APPS_SCRIPT_URL_BLOCKED",
      message:
        "Target proxy ditolak. Proxy hanya boleh menuju script.google.com / script.googleusercontent.com.",
    });
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, {
      success: true,
      code: "PROXY_ALIVE",
      message:
        "Proxy Vercel hidup. Untuk test Apps Script lengkap, buka /api/apps-script-diagnostics.",
      target_host: new URL(targetUrl).hostname,
      target_hint: targetUrl.includes("/exec") ? "EXEC_URL_DETECTED" : "CHECK_URL_SHOULD_END_WITH_EXEC",
    });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Proxy Apps Script hanya menerima GET, POST, atau OPTIONS.",
    });
    return;
  }

  const forwardBody = cleanForwardBody(body);

  try {
    const result = await forwardToAppsScript(targetUrl, forwardBody);
    const { upstream, text, contentType, finalUrl } = result;

    if (!text) {
      sendJson(res, 200, {
        success: false,
        code: "UPSTREAM_EMPTY_BODY",
        message:
          "Apps Script membalas kosong. Cek deployment Web App terbaru dan permission akses.",
        upstream_status: upstream.status,
        upstream_content_type: contentType,
        upstream_final_host: (() => {
          try { return new URL(finalUrl).hostname; } catch { return ""; }
        })(),
      });
      return;
    }

    try {
      const json = JSON.parse(text);
      sendJson(res, 200, json);
      return;
    } catch (err) {
      const classified = classifyInvalidText(text);
      sendJson(res, 200, {
        success: false,
        code: classified.code,
        message: classified.message,
        upstream_status: upstream.status,
        upstream_content_type: contentType,
        upstream_final_host: (() => {
          try { return new URL(finalUrl).hostname; } catch { return ""; }
        })(),
        raw_hint: safeSnippet(text),
      });
      return;
    }
  } catch (err) {
    sendJson(res, 200, {
      success: false,
      code: "PROXY_FETCH_FAILED",
      message:
        "Proxy Vercel gagal menghubungi Apps Script. Cek URL /exec dan koneksi deployment.",
      detail: err?.message || String(err),
    });
  }
}
