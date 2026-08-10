const BRAND_LOGO = "https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp";

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function num(value) {
  const n = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function rp(value) { return `Rp ${num(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`; }
function qty(value, unit = "") { return `${num(value).toLocaleString("id-ID", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`; }
function asRows(value) { return Array.isArray(value) ? value : []; }
function valueOf(row, keys, fallback = "-") {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") return row[key];
  return fallback;
}
function rowMoneyTable(rows, empty = "Belum ada data.") {
  if (!rows.length) return `<tr><td colspan="4" class="empty">${esc(empty)}</td></tr>`;
  return rows.slice(0, 120).map((row) => `<tr><td><b>${esc(valueOf(row,["category","name","title","source_module","module"],"Transaksi"))}</b></td><td>${esc(valueOf(row,["source_id","transaction_id","id"],"-"))}</td><td>${esc(valueOf(row,["notes","description","status"],"-"))}</td><td class="money">${rp(valueOf(row,["amount","nominal","value"],0))}</td></tr>`).join("");
}
function stockTable(rows) {
  if (!rows.length) return `<tr><td colspan="4" class="empty">Belum ada pergerakan stok pada periode ini.</td></tr>`;
  return rows.slice(0, 100).map((row) => `<tr><td><b>${esc(valueOf(row,["product_name","product","name","section"],"Stok"))}</b></td><td>${qty(valueOf(row,["qty","quantity","pcs","kg"],0), valueOf(row,["unit","uom"],""))}</td><td>${esc(valueOf(row,["source_id","transaction_id","id"],"-"))}</td><td>${esc(valueOf(row,["status","notes","description"],"-"))}</td></tr>`).join("");
}

export function printOwnerPeriodReportA4({ data = {}, periodLabel = "-", locationLabel = "Semua Lokasi" } = {}) {
  const summary = data.summary || {};
  const health = data.health || {};
  const sections = data.sections || {};
  const moneyRows = asRows(sections.money_flow);
  const obligationRows = asRows(sections.obligations);
  const stockRows = asRows(sections.stock_flow);
  const recent = asRows(data.recent_records);
  const closing = data.current_closing || null;
  const popup = window.open("", "_blank", "noopener,noreferrer,width=1280,height=900");
  if (!popup) throw new Error("Popup cetak diblokir browser.");
  const printedAt = new Date().toLocaleString("id-ID");
  const cards = [
    ["Uang Masuk Aktual", rp(summary.money_in_actual)],
    ["Uang Keluar Aktual", rp(summary.money_out_actual)],
    ["Piutang Terbuka", rp(summary.receivable_open)],
    ["Hutang Nana", rp(summary.supplier_payable)],
    ["Kewajiban Owner", rp(summary.owner_obligation)],
    ["Payroll Belum Dibayar", rp(summary.payroll_unpaid)],
  ];
  popup.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Laporan Owner — ${esc(periodLabel)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{margin:0;background:#fff;color:#111827;font-family:Inter,Arial,sans-serif;font-size:7.5pt}.sheet{width:283mm;margin:0 auto;padding:7mm}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #E5E7EB;padding-bottom:8px}.brand{display:flex;align-items:center;gap:11px}.logo{width:40px;height:40px;object-fit:contain}.brand h1{margin:0;font-size:14pt;font-weight:900;letter-spacing:-.5px}.brand p,.muted{margin:2px 0 0;color:#6B7280;font-weight:700}.title{text-align:right}.title h2{margin:0;color:#D9251C;font-size:12pt;font-weight:900}.title p{margin:2px 0 0;color:#6B7280;font-weight:700}.cards{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:9px 0}.card{padding:8px;border:1px solid #E5E7EB;border-radius:9px;background:#F9FAFB}.card span{display:block;color:#6B7280;font-size:6.2pt;font-weight:900;text-transform:uppercase}.card strong{display:block;margin-top:4px;font-size:10pt}.meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-bottom:9px}.meta div{border:1px solid #E5E7EB;border-radius:8px;padding:6px 8px}.meta span{display:block;color:#6B7280;font-size:6pt;font-weight:900;text-transform:uppercase}.meta b{display:block;margin-top:2px}.grid{display:grid;grid-template-columns:1.35fr .85fr;gap:9px}.section{break-inside:avoid;margin-bottom:8px}.section h3{font-size:8pt;margin:0 0 4px;color:#6B7280;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid #E5E7EB;padding-bottom:4px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:6.7pt}th{background:#F9FAFB;color:#6B7280;text-transform:uppercase;font-size:5.9pt;letter-spacing:.3px}th,td{padding:4px 5px;border-bottom:1px solid #EEF0F2;vertical-align:top;overflow-wrap:anywhere}.money{text-align:right;white-space:nowrap;font-weight:800}.empty{text-align:center;color:#9CA3AF;padding:10px}.closing{background:#ECFDF5;border-left:5px solid #00B14F;border-radius:8px;padding:8px 10px}.closing strong{color:#047857;font-size:9pt}.closing p{margin:3px 0 0;color:#4B5563}.sign{display:flex;justify-content:space-between;margin-top:12px;padding:0 36px;text-align:center;color:#4B5563;font-weight:700}.space{height:20px}.name{display:inline-block;min-width:130px;border-bottom:1px solid #111827;padding-bottom:2px;color:#111827;font-weight:850}.footer{display:flex;justify-content:space-between;border-top:1px solid #E5E7EB;margin-top:8px;padding-top:5px;color:#9CA3AF;font-size:5.8pt;font-weight:700}.toolbar{position:fixed;right:12px;top:12px;z-index:2}.toolbar button{border:0;border-radius:9px;padding:9px 14px;background:#D9251C;color:#fff;font-weight:900;cursor:pointer}@page{size:A4 landscape;margin:7mm}@media print{.toolbar{display:none}.sheet{padding:0;width:auto}.section,table tr,.cards,.meta,.closing,.sign{break-inside:avoid;page-break-inside:avoid}thead{display:table-header-group}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">Cetak / PDF</button></div><main class="sheet"><div class="head"><div class="brand"><img class="logo" src="${BRAND_LOGO}" onerror="this.style.display='none'"><div><h1>DIMSUM ADITYA</h1><p>Laporan Operasional Owner</p></div></div><div class="title"><h2>LAPORAN OWNER A4</h2><p>${esc(periodLabel)} · ${esc(locationLabel)}</p></div></div><div class="cards">${cards.map(([label,value])=>`<div class="card"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("")}</div><div class="meta"><div><span>Status Closing</span><b>${esc(closing?.status || health?.closing_status || (closing ? "DIKUNCI" : "BELUM DIKUNCI"))}</b></div><div><span>Closing ID</span><b>${esc(closing?.closing_id || summary?.closing_id || "-")}</b></div><div><span>Baris Perlu Sumber</span><b>${esc(health?.rows_without_source ?? health?.wallet_mutations_without_source ?? 0)}</b></div></div><div class="grid"><div><section class="section"><h3>Arus Uang Periode</h3><table><thead><tr><th>Kategori</th><th>ID</th><th>Keterangan</th><th>Nominal</th></tr></thead><tbody>${rowMoneyTable(moneyRows)}</tbody></table></section><section class="section"><h3>Jejak Transaksi Terbaru</h3><table><thead><tr><th>Modul</th><th>ID</th><th>Keterangan</th><th>Nominal</th></tr></thead><tbody>${rowMoneyTable(recent)}</tbody></table></section></div><div><section class="section"><h3>Kewajiban & Payroll</h3><table><thead><tr><th>Bagian</th><th>ID</th><th>Keterangan</th><th>Nominal</th></tr></thead><tbody>${rowMoneyTable(obligationRows)}</tbody></table></section><section class="section"><h3>Stok & Modal</h3><table><thead><tr><th>Produk</th><th>Qty</th><th>Sumber</th><th>Status</th></tr></thead><tbody>${stockTable(stockRows)}</tbody></table></section><div class="closing"><strong>${closing ? "Snapshot periode tersimpan" : "Laporan masih berjalan"}</strong><p>Cetak hanya membaca snapshot/rekap. Tidak membuat uang masuk, uang keluar, stok, jurnal, atau alokasi 4 Amplop.</p></div></div></div><div class="sign"><div>Dibuat / Dicek<div class="space"></div><span class="name">Administrasi</span></div><div>Disetujui<div class="space"></div><span class="name">Owner Dimsum Aditya</span></div></div><div class="footer"><span>${esc(locationLabel)} · ${esc(periodLabel)}</span><span>Dicetak ${esc(printedAt)}</span></div></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script></body></html>`);
  popup.document.close();
  return popup;
}
