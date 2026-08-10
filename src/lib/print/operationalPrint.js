const BRAND_LOGO = "https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp";

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
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}


function parseMaybeJson(value) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text || !["[", "{"].includes(text[0])) return value;
  try { return JSON.parse(text); } catch { return value; }
}

function extractLineItems(source = {}) {
  const candidates = [
    source.items, source.order_items, source.invoice_items, source.delivery_items, source.request_items,
    source.lines, source.details, source.products, source.items_json, source.line_items_json,
  ];
  for (const candidate of candidates) {
    const parsed = parseMaybeJson(candidate);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  }
  return [];
}

function lineItemRows(rows = []) {
  if (!rows.length) return "";
  const body = rows.slice(0, 120).map((row, index) => {
    const name = row.product_name || row.item_name || row.name || row.product || row.description || row.sku || `Item ${index + 1}`;
    const qty = row.qty ?? row.quantity ?? row.pcs ?? row.requested_qty ?? row.shipped_qty ?? "-";
    const unit = row.unit || row.uom || row.satuan || "pcs";
    const price = row.unit_price ?? row.price ?? row.harga ?? row.price_per_pcs ?? 0;
    const total = row.total ?? row.line_total ?? row.subtotal ?? (Number(qty) * Number(price) || 0);
    return `<tr><td>${index + 1}</td><td><b>${escapeHtml(name)}</b></td><td class="right">${escapeHtml(qty)} ${escapeHtml(unit)}</td><td class="amount">${rupiah(price)}</td><td class="amount">${rupiah(total)}</td></tr>`;
  }).join("");
  return `<div class="section-head">Rincian Item</div><table class="item-table"><colgroup><col style="width:7%"><col style="width:43%"><col style="width:16%"><col style="width:17%"><col style="width:17%"></colgroup><thead><tr><th>No</th><th>Produk / Item</th><th>Qty</th><th>Harga</th><th>Total</th></tr></thead><tbody>${body}</tbody></table>`;
}

function prettyKey(key = "") {
  return String(key)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function fieldBlocks(source = {}) {
  const blocked = new Set(["raw", "record", "payload", "metadata", "items", "order_items", "invoice_items", "delivery_items", "request_items", "lines", "details", "products", "items_json", "line_items_json"]);
  const entries = Object.entries(source || {})
    .filter(([key, value]) => !blocked.has(String(key).toLowerCase()) && value !== null && value !== undefined && String(value).trim() !== "")
    .slice(0, 42);

  if (!entries.length) return '<div class="empty">Belum ada detail tambahan.</div>';

  return entries.map(([key, value]) => `
    <div class="detail-item">
      <div class="detail-label">${escapeHtml(prettyKey(key))}</div>
      <div class="detail-value">${escapeHtml(printableValue(value))}</div>
    </div>
  `).join("");
}

function traceRows(rows = []) {
  if (!Array.isArray(rows) || !rows.length) {
    return '<tr><td colspan="5" class="empty-cell">Belum ada rantai transaksi terkait.</td></tr>';
  }
  return rows.slice(0, 100).map((row) => `
    <tr>
      <td>${escapeHtml(row.date || row.created_at || row.timestamp || "-")}</td>
      <td>${escapeHtml(row.source_module || row.module || row.action || "-")}</td>
      <td class="id-cell">${escapeHtml(row.source_id || row.transaction_id || row.audit_id || row.id || "-")}</td>
      <td>${escapeHtml(row.title || row.description || row.reason || row.notes || "-")}</td>
      <td class="amount">${rupiah(row.amount || 0)}</td>
    </tr>
  `).join("");
}

function printProfile(moduleName = "", transactionType = "") {
  const key = `${moduleName} ${transactionType}`.toUpperCase();

  if (key.includes("INVOICE") || key.includes("ORDER") || key.includes("PAYMENT") || key.includes("RECEIVABLE")) {
    return { title: "INVOICE / NOTA PENJUALAN", pageSize: "8.5in 5.5in", compact: true, subtitle: "Penjualan & Pembayaran" };
  }
  if (key.includes("DELIVERY") || key.includes("REQUEST") || key.includes(" DO")) {
    return { title: "SURAT JALAN / DELIVERY ORDER", pageSize: "A5", compact: true, subtitle: "Pengiriman & Penerimaan Barang" };
  }
  if (key.includes("PRODUCTION") || key.includes("ADUKAN")) {
    return { title: "SPK / HASIL PRODUKSI", pageSize: "A4", compact: false, subtitle: "Produksi & HPP Historis" };
  }
  if (key.includes("CHICKEN") || key.includes("DROP")) {
    return { title: "BUKTI DROP AYAM", pageSize: "A5", compact: true, subtitle: "Pembelian Ayam & Hutang Supplier" };
  }
  if (key.includes("CASH_EXPENSE") || key.includes("KASOUT") || key.includes("EXPENSE")) {
    return { title: "BUKTI KAS KELUAR", pageSize: "A5", compact: true, subtitle: "Belanja & Pengeluaran Operasional" };
  }
  if (key.includes("SUPPLIER") || key.includes("PAYABLE")) {
    return { title: "BUKTI PEMBAYARAN SUPPLIER", pageSize: "A5", compact: true, subtitle: "Hutang & Pembayaran Supplier" };
  }
  if (key.includes("OWNER_OBLIGATION")) {
    return { title: "BUKTI KEWAJIBAN OWNER", pageSize: "A5", compact: true, subtitle: "Cicilan & Tagihan Usaha" };
  }
  if (key.includes("ENVELOPE")) {
    return { title: "BUKTI ALOKASI 4 AMPLOP", pageSize: "A5", compact: true, subtitle: "Alokasi Uang Aktual" };
  }
  if (key.includes("BRANCH_DAILY") || key.includes("BRANCH_DEPOSIT") || key.includes("OWNER_REPORT")) {
    return { title: "LAPORAN OPERASIONAL", pageSize: "A4 landscape", compact: false, subtitle: "Rekap & Closing ERP" };
  }

  return { title: "DOKUMEN TRANSAKSI ERP", pageSize: "A4", compact: false, subtitle: "Arsip Operasional Dimsum Aditya" };
}

export function printOperationalDetail({ detail = {}, activeId = "", activeModule = "", printLogId = "" } = {}) {
  const main = detail?.main || {};
  const raw = main.raw || main.record || main;
  const timeline = detail?.timeline || detail?.related_records || [];
  const lineItems = extractLineItems(raw);
  const transactionId = main.source_id || main.transaction_id || main.id || activeId || "-";
  const moduleName = main.source_module || main.module || activeModule || "ARSIP DIGITAL";
  const transactionType = main.transaction_type || main.type || "";
  const profile = printProfile(moduleName, transactionType);
  const title = main.title || main.description || transactionId;
  const date = main.date || main.transaction_date || main.created_at || "-";
  const status = main.status || "TERCATAT";
  const amount = main.amount || 0;
  const printedAt = new Date().toLocaleString("id-ID");

  const popup = window.open("", "_blank", "noopener,noreferrer,width=1100,height=820");
  if (!popup) {
    throw new Error("Popup cetak diblokir browser. Izinkan popup untuk ERP Dimsum Aditya.");
  }

  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(transactionId)} — Dimsum Aditya</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  :root{--red:#D9251C;--red-dark:#A11A13;--gold:#FCD34D;--green:#00B14F;--text:#111827;--muted:#6B7280;--line:#E5E7EB;--soft:#F9FAFB;--cream:#FFF7ED}
  html,body{margin:0;padding:0;background:#fff;color:var(--text);font-family:Inter,Arial,sans-serif;font-size:${profile.compact ? "8.2pt" : "8.5pt"};line-height:1.4}
  body{padding:0}.page{width:100%;max-width:${profile.compact ? "190mm" : "100%"};margin:0 auto;padding:${profile.compact ? "8mm" : "10mm"}}
  .header{display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:2px solid var(--line);padding-bottom:9px;margin-bottom:9px}
  .brand-wrap{display:flex;align-items:center;gap:11px;min-width:0}.logo{width:42px;height:42px;object-fit:contain}.brand h1{margin:0;font-size:14pt;font-weight:900;letter-spacing:-.55px}.brand p{margin:3px 0 0;color:var(--muted);font-size:7.2pt;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
  .doc{text-align:right;min-width:220px}.doc h2{margin:0;color:var(--red);font-size:12.6pt;font-weight:900;letter-spacing:-.45px}.doc p{margin:2px 0 0;color:var(--muted);font-size:7.4pt;font-weight:700}
  .info{display:grid;grid-template-columns:1.35fr .85fr .7fr .9fr;gap:7px;background:var(--soft);border:1px solid #F1F3F5;border-radius:10px;padding:8px 10px;margin-bottom:9px}
  .info-item{min-width:0}.label,.detail-label{color:var(--muted);font-size:6.6pt;font-weight:800;text-transform:uppercase;letter-spacing:.42px}.value{margin-top:3px;font-size:8.2pt;font-weight:850;overflow-wrap:anywhere}.amount-main{color:var(--green);font-size:10.4pt;font-weight:900;white-space:nowrap}
  .headline{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin:8px 0}.headline h3{margin:0;font-size:9pt;font-weight:900}.headline span{font-size:7pt;color:var(--muted);font-weight:700}
  .detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 14px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:7px 0;margin-bottom:8px}
  .detail-item{display:grid;grid-template-columns:minmax(95px,.8fr) minmax(0,1.2fr);gap:9px;padding:3px 0;align-items:start}.detail-value{font-weight:750;overflow-wrap:anywhere;text-align:right}
  .section-head{font-size:7.4pt;font-weight:900;color:var(--muted);text-transform:uppercase;letter-spacing:.45px;border-bottom:2px solid var(--line);padding-bottom:4px;margin:8px 0 5px}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7pt}th{background:var(--soft);color:var(--muted);font-size:6.2pt;text-transform:uppercase;letter-spacing:.35px;font-weight:900;text-align:left}th,td{padding:4px 5px;border-bottom:1px solid #EEF0F2;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid;page-break-inside:avoid}.amount{text-align:right;white-space:nowrap;font-weight:800}.id-cell{font-weight:800}.empty-cell,.empty{text-align:center;color:var(--muted);padding:12px}
  .bottom{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:end;margin-top:9px}.note{padding:7px 9px;border-radius:8px;background:var(--soft);border:1px solid #F1F3F5;color:var(--muted);font-size:6.8pt;font-weight:650}.total-box{min-width:190px;padding:8px 12px;border-radius:8px;background:#ECFDF5;border-left:5px solid var(--green);text-align:right}.total-box span{display:block;color:#008C3E;font-size:6.7pt;text-transform:uppercase;font-weight:900;letter-spacing:.4px}.total-box strong{display:block;color:var(--green);font-size:12pt;font-weight:950;letter-spacing:-.4px}
  .signatures{display:flex;justify-content:space-between;margin-top:13px;padding:0 34px;color:#4B5563;font-size:7pt;font-weight:700}.sig{text-align:center;min-width:150px}.sig-space{height:18px}.sig-name{display:inline-block;min-width:125px;padding-bottom:2px;border-bottom:1px solid #111827;color:#111827;font-weight:850}
  .footer{display:flex;justify-content:space-between;gap:15px;margin-top:10px;padding-top:6px;border-top:1px solid var(--line);color:#9CA3AF;font-size:6.5pt;font-weight:700}
  .toolbar{position:sticky;top:0;z-index:20;display:flex;justify-content:flex-end;padding:10px;background:#fff;border-bottom:1px solid var(--line)}.toolbar button{border:0;border-radius:9px;background:var(--red);color:#fff;padding:9px 14px;font-family:inherit;font-weight:800;cursor:pointer}
  @page{size:${escapeHtml(profile.pageSize)};margin:${profile.compact ? "8mm" : "7mm"}}
  @media print{html,body{width:auto!important;height:auto!important;overflow:visible!important}.toolbar{display:none!important}.page{padding:0;max-width:none}.header,.info,.detail-grid,.bottom,.signatures{break-inside:avoid;page-break-inside:avoid}thead{display:table-header-group}}
  @media screen{body{background:#F3F4F6}.page{background:#fff;box-shadow:0 20px 60px rgba(17,24,39,.12);margin:18px auto}.toolbar{max-width:100%;}}
</style>
</head>
<body>
<div class="toolbar"><button onclick="window.print()">Cetak Dokumen</button></div>
<div class="page">
  <div class="header">
    <div class="brand-wrap">
      <img class="logo" src="${BRAND_LOGO}" alt="Dimsum Aditya" onerror="this.style.display='none'" />
      <div class="brand"><h1>Dimsum Aditya</h1><p>ERP Merchant Operations</p></div>
    </div>
    <div class="doc"><h2>${escapeHtml(profile.title)}</h2><p>${escapeHtml(profile.subtitle)} · ${escapeHtml(moduleName)}</p></div>
  </div>

  <div class="info">
    <div class="info-item"><div class="label">ID Transaksi</div><div class="value">${escapeHtml(transactionId)}</div></div>
    <div class="info-item"><div class="label">Tanggal</div><div class="value">${escapeHtml(date)}</div></div>
    <div class="info-item"><div class="label">Status</div><div class="value">${escapeHtml(status)}</div></div>
    <div class="info-item"><div class="label">Nominal</div><div class="amount-main">${rupiah(amount)}</div></div>
  </div>

  <div class="headline"><h3>${escapeHtml(title)}</h3><span>Dokumen dari Arsip Digital</span></div>
  <div class="detail-grid">${fieldBlocks(raw)}</div>
  ${lineItemRows(lineItems)}

  ${profile.compact ? "" : `
  <div class="section-head">Rantai Transaksi & Audit</div>
  <table>
    <colgroup><col style="width:13%"><col style="width:15%"><col style="width:20%"><col style="width:36%"><col style="width:16%"></colgroup>
    <thead><tr><th>Tanggal</th><th>Modul</th><th>ID</th><th>Keterangan</th><th>Nominal</th></tr></thead>
    <tbody>${traceRows(timeline)}</tbody>
  </table>`}

  <div class="bottom">
    <div class="note">Dokumen ini adalah arsip transaksi ERP. Proses cetak tidak menambah atau mengurangi omzet, jurnal, saldo dompet, stok, hutang, piutang, payroll, maupun 4 Amplop.</div>
    <div class="total-box"><span>Nilai Transaksi</span><strong>${rupiah(amount)}</strong></div>
  </div>

  <div class="signatures">
    <div class="sig"><div>Mengetahui,</div><div class="sig-space"></div><div class="sig-name">Pihak Manajemen</div></div>
    <div class="sig"><div>Dibuat / Diterima,</div><div class="sig-space"></div><div class="sig-name">________________</div></div>
  </div>

  <div class="footer"><span>Print Log: ${escapeHtml(printLogId || "-")}</span><span>Dicetak ${escapeHtml(printedAt)}</span></div>
</div>
<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),350);});</script>
</body></html>`);
  popup.document.close();
}
