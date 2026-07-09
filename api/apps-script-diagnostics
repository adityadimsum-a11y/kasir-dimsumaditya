// ======================================================
// api/apps-script-diagnostics.js - ERP DIMSUM ADITYA
// Part 5R-4: Diagnostic endpoint untuk cek proxy -> Apps Script
//
// Buka di browser:
// https://erp.dimsumaditya.id/api/apps-script-diagnostics
//
// Aman:
// - Hanya kirim action test read-only / unknown action
// - Tidak membuat transaksi, tidak mengubah saldo/stok/payroll/closing
// ======================================================

const ALLOWED_HOSTS = new Set([
  "script.google.com",
  "script.googleusercontent.com",
]);

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function pickTargetUrl() {
  return String(
    process.env.APPS_SCRIPT_URL ||
      process.env.GAS_API_URL ||
      process.env.GOOGLE_SCRIPT_URL ||
      process.env.VITE_ERP_API_URL ||
      process.env.VITE_GAS_API_URL ||
      process.env.VITE_APPS_SCRIPT_URL ||
      process.env.VITE_GOOGLE_SCRIPT_URL ||
      process.env.VITE_API_URL ||
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

function safeSnippet(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

function classify(text) {
  const raw = String(text || "");
  const t = raw.toLowerCase();

  if (t.trim().startsWith("<!doctype") || t.trim().startsWith("<html") || t.includes("<body")) {
    if (t.includes("accounts.google.com") || t.includes("servicelogin") || t.includes("sign in")) {
      return {
        code: "WEB_APP_ACCESS_NOT_ANYONE",
        message: "Apps Script membalas halaman login Google. Web App harus bisa diakses Anyone untuk dipanggil dari Vercel proxy.",
      };
    }

    return {
      code: "UPSTREAM_HTML_RESPONSE",
      message: "Apps Script membalas HTML, bukan JSON. Biasanya deployment/permission/URL Web App belum tepat.",
    };
  }

  return {
    code: "UPSTREAM_NOT_JSON",
    message: "Apps Script membalas non-JSON.",
  };
}

export default async function handler(req, res) {
  const targetUrl = pickTargetUrl();

  if (!targetUrl) {
    sendJson(res, 200, {
      success: false,
      code: "APPS_SCRIPT_URL_MISSING",
      message: "Environment Variable Apps Script belum terbaca di Vercel.",
      required_env: ["VITE_ERP_API_URL", "APPS_SCRIPT_URL"],
    });
    return;
  }

  if (!isAllowedTarget(targetUrl)) {
    sendJson(res, 200, {
      success: false,
      code: "APPS_SCRIPT_URL_BLOCKED",
      message: "Target URL bukan script.google.com/script.googleusercontent.com.",
      target_host: (() => {
        try { return new URL(targetUrl).hostname; } catch { return "INVALID_URL"; }
      })(),
    });
    return;
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
        "Accept": "application/json,text/plain,*/*",
      },
      body: JSON.stringify({
        action: "__proxy_diagnostics__",
        payload: {
          source: "vercel_proxy_diagnostics",
          read_only: true,
        },
      }),
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "";
    const finalUrl = upstream.url || targetUrl;

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (err) {}

    if (parsed) {
      sendJson(res, 200, {
        success: true,
        code: "APPS_SCRIPT_JSON_OK",
        message: "Proxy berhasil menerima JSON dari Apps Script. Kabel sudah nyambung.",
        upstream_status: upstream.status,
        upstream_content_type: contentType,
        upstream_final_host: (() => {
          try { return new URL(finalUrl).hostname; } catch { return ""; }
        })(),
        apps_script_response: parsed,
      });
      return;
    }

    const c = classify(text);
    sendJson(res, 200, {
      success: false,
      code: c.code,
      message: c.message,
      upstream_status: upstream.status,
      upstream_content_type: contentType,
      upstream_final_host: (() => {
        try { return new URL(finalUrl).hostname; } catch { return ""; }
      })(),
      raw_hint: safeSnippet(text),
    });
  } catch (err) {
    sendJson(res, 200, {
      success: false,
      code: "DIAGNOSTIC_FETCH_FAILED",
      message: "Diagnostic proxy gagal menghubungi Apps Script.",
      detail: err?.message || String(err),
    });
  }
}
