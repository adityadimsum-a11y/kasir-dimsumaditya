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


function parseUpstreamJson(text) {
  const cleaned = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!cleaned) return { json: null, recovered: false };

  try {
    return { json: JSON.parse(cleaned), recovered: false };
  } catch {}

  // Beberapa hosting mencetak warning sebelum JSON. Ambil payload ERP terakhir
  // tanpa menganggap warning tersebut sebagai sumber data resmi.
  const markers = ['{"success"', "{\n\"success\""];
  let start = -1;
  for (const marker of markers) {
    start = Math.max(start, cleaned.lastIndexOf(marker));
  }
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return { json: JSON.parse(cleaned.slice(start, end + 1)), recovered: true };
    } catch {}
  }

  return { json: null, recovered: false };
}

function safePreview(text, maxLength = 1200) {
  return String(text || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .slice(0, maxLength);
}

function isBotProtectionResponse(text) {
  return /imunify360|bot[- ]protection|automation should be whitelisted/i.test(String(text || ""));
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
    const parsed = parseUpstreamJson(text);

    if (!parsed.json) {
      if (isBotProtectionResponse(text)) {
        sendJson(res, 503, {
          success: false,
          message: "Jalur server-to-server ditahan proteksi hosting. Gunakan koneksi browser langsung.",
          error: { code: "HOSTING_BOT_PROTECTION", upstream_status: upstream.status },
        });
        return;
      }

      const requestBody = parseBody(req);
      const hasSession = Boolean(
        requestBody?.sessionToken || requestBody?.session_token || requestBody?.token
      );

      sendJson(res, 502, {
        success: false,
        message: "PHP ERP gagal membentuk JSON resmi.",
        error: {
          code: "PHP_UPSTREAM_INVALID_JSON",
          upstream_status: upstream.status,
          upstream_content_type: upstream.headers.get("content-type") || "",
          upstream_body_length: text.length,
          ...(hasSession ? { upstream_preview: safePreview(text) } : {}),
        },
      });
      return;
    }

    if (parsed.recovered && parsed.json && typeof parsed.json === "object") {
      parsed.json.meta = {
        ...(parsed.json.meta || {}),
        proxy_recovered_contaminated_json: true,
      };
    }

    sendJson(res, upstream.status, parsed.json);
  } catch (err) {
    sendJson(res, 502, {
      success: false,
      message: "Proxy gagal menghubungi PHP ERP.",
      error: { code: "PHP_PROXY_FETCH_FAILED", detail: err?.message || String(err) },
    });
  }
}
