// ======================================================
// api/apps-script.js - ERP DIMSUM ADITYA
// Part 5R-3: Same-Origin Apps Script Proxy / CORS Fix
//
// Letakkan file ini di ROOT project Vercel:
// api/apps-script.js
//
// Fungsi:
// - Browser memanggil /api/apps-script di domain sendiri
// - Vercel server memanggil Apps Script dari server-side
// - Menghindari browser CORS ke script.google.com
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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Proxy Apps Script hanya menerima POST.",
    });
    return;
  }

  const body = parseBody(req);
  const targetUrl = pickTargetUrl(body);

  if (!targetUrl) {
    sendJson(res, 200, {
      success: false,
      code: "APPS_SCRIPT_URL_MISSING",
      message:
        "URL Apps Script belum tersedia di proxy. Isi VITE_ERP_API_URL di Vercel atau pastikan frontend mengirim target URL.",
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

  const forwardBody = cleanForwardBody(body);

  try {
    const upstream = await fetch(targetUrl, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(forwardBody),
    });

    const text = await upstream.text();

    if (!text) {
      sendJson(res, 200, {
        success: false,
        code: "UPSTREAM_EMPTY_BODY",
        message:
          "Apps Script membalas kosong. Cek deployment Web App terbaru dan permission akses.",
        upstream_status: upstream.status,
      });
      return;
    }

    try {
      const json = JSON.parse(text);
      sendJson(res, 200, json);
      return;
    } catch (err) {
      sendJson(res, 200, {
        success: false,
        code: "UPSTREAM_INVALID_JSON",
        message:
          "Apps Script tidak membalas JSON valid. Biasanya deployment belum baru, URL /exec salah, atau Web App belum bisa diakses.",
        upstream_status: upstream.status,
        raw_text: text.slice(0, 1000),
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
