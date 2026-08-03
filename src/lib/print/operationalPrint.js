function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rupiah(value) {
  const amount = Number(value || 0);
  return `Rp ${Number.isFinite(amount) ? amount.toLocaleString("id-ID", { maximumFractionDigits: 2 }) : "0"}`;
}

function printableValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function rowsFromObject(source = {}) {
  return Object.entries(source || {})
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .slice(0, 120)
    .map(([key, value]) => `
      <tr>
        <th>${escapeHtml(key.replaceAll("_", " "))}</th>
        <td><pre>${escapeHtml(printableValue(value))}</pre></td>
      </tr>
    `)
    .join("");
}

function traceRows(rows = []) {
  if (!Array.isArray(rows) || !rows.length) {
    return '<tr><td colspan="5">Belum ada rantai transaksi terkait.</td></tr>';
  }
  return rows.slice(0, 100).map((row) => `
    <tr>
      <td>${escapeHtml(row.date || row.created_at || row.timestamp || "-")}</td>
      <td>${escapeHtml(row.source_module || row.module || row.action || "-")}</td>
      <td>${escapeHtml(row.source_id || row.transaction_id || row.audit_id || row.id || "-")}</td>
      <td>${escapeHtml(row.title || row.description || row.reason || row.notes || "-")}</td>
      <td class="amount">${rupiah(row.amount || 0)}</td>
    </tr>
  `).join("");
}


function printProfile(moduleName = "", transactionType = "") {
  const key = `${moduleName} ${transactionType}`.toUpperCase();

  if (key.includes("INVOICE") || key.includes("ORDER") || key.includes("PAYMENT") || key.includes("RECEIVABLE")) {
    return { title: "INVOICE / NOTA TRANSAKSI", pageSize: "8.5in 5.5in", compact: true };
  }
  if (key.includes("DELIVERY") || key.includes("REQUEST") || key.includes(" DO")) {
    return { title: "DELIVERY ORDER / BUKTI PENGIRIMAN", pageSize: "A5", compact: true };
  }
  if (key.includes("PRODUCTION") || key.includes("ADUKAN")) {
    return { title: "SPK / HASIL PRODUKSI", pageSize: "A4", compact: false };
  }
  if (key.includes("CHICKEN") || key.includes("DROP")) {
    return { title: "BUKTI DROP AYAM", pageSize: "A5", compact: true };
  }
  if (key.includes("CASH_EXPENSE") || key.includes("KASOUT") || key.includes("EXPENSE")) {
    return { title: "BUKTI KAS KELUAR", pageSize: "A5", compact: true };
  }
  if (key.includes("SUPPLIER") || key.includes("PAYABLE")) {
    return { title: "BUKTI HUTANG / PEMBAYARAN SUPPLIER", pageSize: "A5", compact: true };
  }
  if (key.includes("OWNER_OBLIGATION")) {
    return { title: "BUKTI KEWAJIBAN OWNER", pageSize: "A5", compact: true };
  }
  if (key.includes("ENVELOPE")) {
    return { title: "BUKTI ALOKASI 4 AMPLOP", pageSize: "A5", compact: true };
  }
  if (key.includes("BRANCH_DAILY") || key.includes("BRANCH_DEPOSIT") || key.includes("OWNER_REPORT")) {
    return { title: "LAPORAN OPERASIONAL ERP", pageSize: "A4", compact: false };
  }

  return { title: "DOKUMEN TRANSAKSI ERP", pageSize: "A4", compact: false };
}

export function printOperationalDetail({ detail = {}, activeId = "", activeModule = "", printLogId = "" } = {}) {
  const main = detail?.main || {};
  const raw = main.raw || main.record || main;
  const timeline = detail?.timeline || detail?.related_records || [];
  const transactionId = main.source_id || main.transaction_id || main.id || activeId || "-";
  const moduleName = main.source_module || main.module || activeModule || "ARSIP DIGITAL";
  const transactionType = main.transaction_type || main.type || "";
  const profile = printProfile(moduleName, transactionType);
  const title = main.title || main.description || transactionId;
  const date = main.date || main.transaction_date || main.created_at || "-";
  const status = main.status || "TERCATAT";
  const amount = main.amount || 0;

  const popup = window.open("", "_blank", "noopener,noreferrer,width=980,height=760");
  if (!popup) {
    throw new Error("Popup cetak diblokir browser. Izinkan popup untuk ERP Dimsum Aditya.");
  }

  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(transactionId)} — ERP Dimsum Aditya</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;background:#fff;font-size:12px}
  .page{max-width:900px;margin:0 auto;padding:20px}.header{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #c9231e;padding-bottom:14px}
  .brand{font-size:22px;font-weight:900}.tagline{font-size:11px;color:#666;margin-top:4px}.doc-title{text-align:right}.doc-title h1{font-size:18px;margin:0 0 5px}.muted{color:#666}
  .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.box{border:1px solid #ddd;border-radius:8px;padding:10px;min-height:58px}.label{font-size:9px;text-transform:uppercase;color:#666;font-weight:700}.value{font-size:13px;font-weight:800;margin-top:5px;overflow-wrap:anywhere}
  h2{font-size:14px;margin:18px 0 8px;border-bottom:1px solid #ddd;padding-bottom:6px}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #ddd;padding:7px;vertical-align:top;text-align:left}th{background:#f8f3ea;text-transform:uppercase;font-size:9px}td pre{font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;word-break:break-word;margin:0;font-size:11px}.amount{text-align:right;white-space:nowrap}
  .footer{margin-top:18px;padding-top:10px;border-top:1px solid #ddd;display:flex;justify-content:space-between;color:#666;font-size:10px}.no-ledger{margin-top:12px;padding:8px;border:1px solid #f3c765;background:#fff8df;border-radius:7px}
  @page{size:${escapeHtml(profile.pageSize)};margin:12mm}@media print{.page{padding:0}.no-print{display:none!important}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div><div class="brand">DIMSUM ADITYA</div><div class="tagline">Pabrik Dimsum Ayam Tangerang · ERP Merchant OS</div></div>
    <div class="doc-title"><h1>${escapeHtml(profile.title)}</h1><div>${escapeHtml(moduleName)}</div></div>
  </div>
  <div class="meta">
    <div class="box"><div class="label">ID Transaksi</div><div class="value">${escapeHtml(transactionId)}</div></div>
    <div class="box"><div class="label">Tanggal</div><div class="value">${escapeHtml(date)}</div></div>
    <div class="box"><div class="label">Status</div><div class="value">${escapeHtml(status)}</div></div>
    <div class="box"><div class="label">Nominal</div><div class="value">${rupiah(amount)}</div></div>
  </div>
  <h2>${escapeHtml(title)}</h2>
  <table><tbody>${rowsFromObject(raw)}</tbody></table>
  <h2>Rantai Transaksi & Audit</h2>
  <table><thead><tr><th>Tanggal</th><th>Modul</th><th>ID</th><th>Keterangan</th><th>Nominal</th></tr></thead><tbody>${traceRows(timeline)}</tbody></table>
  <div class="no-ledger">Dokumen ini dicetak dari Arsip Digital. Proses cetak tidak membuat atau mengubah omzet, jurnal, saldo dompet, stok, hutang, piutang, payroll, maupun 4 Amplop.</div>
  <div class="footer"><span>Print Log: ${escapeHtml(printLogId || "-")}</span><span>Dicetak: ${escapeHtml(new Date().toLocaleString("id-ID"))}</span></div>
</div>
<script>window.addEventListener('load',()=>{window.print();});</script>
</body></html>`);
  popup.document.close();
}
