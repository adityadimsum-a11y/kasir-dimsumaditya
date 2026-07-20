// ERP DIMSUM ADITYA - same-origin PHP/MySQL proxy for Vercel
const DEFAULT_TARGET = "https://dimsumaditya.id/api-v2/";
const ALLOWED_HOSTS = new Set(["dimsumaditya.id", "www.dimsumaditya.id"]);

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try { return JSON.parse(String(req.body)); } catch { return {}; }
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function getTarget() {
  return String(process.env.ERP_PHP_API_URL || DEFAULT_TARGET).trim();
}

function validTarget(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!["GET", "POST"].includes(req.method)) {
    sendJson(res, 405, { success: false, message: "Method tidak diizinkan." });
    return;
  }

  const target = getTarget();
  if (!validTarget(target)) {
    sendJson(res, 500, {
      success: false,
      message: "Target PHP ERP ditolak oleh proxy.",
      error: { code: "PHP_PROXY_TARGET_INVALID" },
    });
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, {
      success: true,
      message: "PHP ERP proxy hidup.",
      data: { proxy: "erp-v2", target_host: new URL(target).hostname },
    });
    return;
  }

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(parseBody(req)),
    });

    const text = await upstream.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      sendJson(res, 502, {
        success: false,
        message: "PHP ERP membalas non-JSON.",
        error: { code: "PHP_UPSTREAM_INVALID_JSON" },
      });
      return;
    }

    sendJson(res, upstream.status, json);
  } catch (err) {
    sendJson(res, 502, {
      success: false,
      message: "Proxy gagal menghubungi PHP ERP.",
      error: { code: "PHP_PROXY_FETCH_FAILED", detail: err?.message || String(err) },
    });
  }
}
