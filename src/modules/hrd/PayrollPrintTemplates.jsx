import { APP_BRAND } from "../../config/theme.config";

function money(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function periodText(period) {
  const [year, month] = String(period || "").split("-");
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return month ? `${months[Number(month) - 1] || month} ${year}` : period || "-";
}

function dateText(value) {
  if (!value) return "-";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function printedDateText() {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
}

function scheduleLabel(row) {
  if (String(row?.pay_cycle || "").toUpperCase() === "MINGGUAN") return `Minggu ${row?.week_no || "-"}`;
  return `Tgl ${row?.payroll_day || "-"}`;
}

function brandBlock(branch = "Sistem Penggajian Pro") {
  const logo = esc(APP_BRAND?.logoUrl || "");
  return `<div class="print-brand">${logo ? `<img src="${logo}" alt="Logo Dimsum Aditya" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ""}<span class="logo-fallback" style="${logo ? "display:none" : "display:flex"}">DA</span><div><h1>DIMSUM ADITYA</h1><p>${esc(branch)}</p></div></div>`;
}

function waitForPrintAssets(win) {
  const doc = win?.document;
  if (!doc) return Promise.resolve();
  const images = Array.from(doc.images || []).map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  });
  const fonts = doc.fonts?.ready ? Promise.resolve(doc.fonts.ready).catch(() => undefined) : Promise.resolve();
  return Promise.race([
    Promise.all([fonts, ...images]),
    new Promise((resolve) => window.setTimeout(resolve, 1400)),
  ]);
}

function printWindow(title, body, css, { autoPrint = true, delay = 420 } = {}) {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Popup cetak diblokir browser. Izinkan popup untuk ERP Dimsum Aditya.");
  const baseHref = esc(document?.baseURI || window.location.href || "");
  win.document.open();
  win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${baseHref}"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><style>${css}</style></head><body>${body}</body></html>`);
  win.document.close();
  if (autoPrint) {
    let started = false;
    const start = async () => {
      if (started || win.closed) return;
      started = true;
      await waitForPrintAssets(win);
      win.setTimeout(() => {
        if (win.closed) return;
        try { void win.document.body?.offsetHeight; } catch { /* best effort */ }
        try { win.focus(); } catch { /* noop */ }
        win.print();
      }, delay);
    };
    if (win.document.readyState === "complete") start();
    else win.addEventListener("load", start, { once: true });
  }
  return win;
}

const exactColorCss = `
  *{box-sizing:border-box;font-family:Inter,Arial,sans-serif;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  html,body{margin:0;padding:0;color:#111827;background:#fff}
  .print-brand{display:flex;align-items:center;gap:11px}.print-brand img{width:38px;height:38px;object-fit:contain}.logo-fallback{width:38px;height:38px;border-radius:10px;background:#FEE2E2;color:#D9251C;font-weight:900;align-items:center;justify-content:center}.print-brand h1{margin:0;font-size:14pt;font-weight:900;line-height:1;letter-spacing:-.5px}.print-brand p{margin:3px 0 0;color:#6B7280;font-size:7.6pt;font-weight:800;text-transform:uppercase}
  .muted{color:#6B7280}.money{text-align:right;white-space:nowrap;font-weight:850}.green{color:#00A86B}.red{color:#D9251C}.bold{font-weight:900}
`;

function slipCss() {
  return `${exactColorCss}
    @page{size:A4 portrait;margin:10mm}
    body{background:#fff}.slip-sheet{width:100%;max-width:190mm;margin:0 auto;font-size:7.7pt}.slip-head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #E5E7EB;padding-bottom:7px;margin-bottom:8px}.slip-title{text-align:right}.slip-title h2{margin:0;color:#D9251C;font-size:12.8pt;font-weight:900;letter-spacing:-.45px}.slip-title p{margin:1px 0 0;color:#6B7280;font-size:7.8pt;font-weight:800}.info{background:#F9FAFB;border:1px solid #F3F4F6;border-radius:10px;padding:7px 11px;margin-bottom:7px;display:grid;grid-template-columns:1.35fr 1fr .9fr;gap:12px}.info span{display:block;font-size:6.8pt;color:#6B7280;font-weight:900;text-transform:uppercase;letter-spacing:.45px}.info strong{display:block;margin-top:2px;font-size:8.5pt}.info>div:last-child{text-align:right}.cols{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:4px}.section-title{font-size:7.6pt;font-weight:900;color:#6B7280;text-transform:uppercase;padding-bottom:4px;border-bottom:2px solid #E5E7EB;margin-bottom:5px;letter-spacing:.45px}.row{display:flex;justify-content:space-between;gap:10px;padding:2.4px 0;font-weight:650;font-size:8pt;color:#374151}.row span:last-child,.row b{font-weight:850;color:#111827;text-align:right}.row.total{padding:4px 0;border-top:1px dashed #D1D5DB;margin-top:2px;font-size:8.4pt;font-weight:900}.row.total.red{color:#D9251C}.row.total.red span,.row.total.red b{color:#D9251C}.bottom{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;margin-top:3px}.loan-box{min-width:205px;background:#F9FAFB;border:1px solid #F3F4F6;border-radius:8px;padding:7px 10px;color:#6B7280;font-size:7.2pt;font-weight:650;line-height:1.34}.loan-box .loan-row{display:flex;justify-content:space-between;gap:15px;padding:1px 0}.loan-box strong{color:#111827;font-weight:850}.thp{min-width:190px;background:#ECFDF5;border-left:5px solid #00B14F;border-radius:8px;padding:7px 13px;text-align:right}.thp span{display:block;color:#008C3E;font-size:7.2pt;font-weight:900;text-transform:uppercase;letter-spacing:.45px}.thp strong{display:block;color:#00B14F;font-size:12.8pt;font-weight:950;letter-spacing:-.5px;margin-top:2px}.notes{margin-top:6px;color:#6B7280;font-size:7pt;font-weight:700}.signs{display:flex;justify-content:space-between;margin-top:8px;padding:0 34px;font-size:7.2pt;font-weight:750;color:#4B5563;text-align:center}.sign-space{height:12px}.signs strong{display:inline-block;min-width:128px;border-bottom:1px solid #111827;padding-bottom:2px;color:#111827;font-weight:850}.footer{text-align:center;border-top:1px dashed #D1D5DB;margin-top:7px;padding-top:5px;color:#9CA3AF;font-size:6.7pt;font-weight:700}.notice-sheet{width:190mm;min-height:277mm;margin:0 auto;padding:10mm;page-break-before:always;font-size:10pt}.notice-head{display:flex;justify-content:space-between;border-bottom:3px solid #D9251C;padding-bottom:10px}.notice-title{text-align:center;margin:20px 0}.notice-title h1{font-size:17pt;margin:0;text-decoration:underline}.notice-body{line-height:1.7}.notice-table{width:100%;border-collapse:collapse;margin:14px 0}.notice-table td{border:1px solid #D1D5DB;padding:8px}.notice-amount{background:#FEF2F2;color:#B91C1C;border-radius:10px;padding:10px;text-align:center;font-size:14pt;font-weight:900}
    @media print{html,body{width:auto!important;height:auto!important;overflow:visible!important}.slip-sheet,.slip-sheet *{break-inside:avoid;page-break-inside:avoid}}
  `;
}

function absenceNoticeHtml(row) {
  const notice = row?.absence_notice || {};
  if (!notice?.enabled || notice?.print_with_slip === false) return "";
  return `<section class="notice-sheet"><div class="notice-head">${brandBlock("Tangerang HO")}<div><b>No: ${esc(notice?.number || "-")}</b><br><span class="muted">${esc(dateText(notice?.date))}</span></div></div><div class="notice-title"><h1>${esc(notice?.type || "SURAT PEMBERITAHUAN")}</h1><p>Potongan Ketidakhadiran Karyawan</p></div><div class="notice-body"><p>Kepada Yth. <b>${esc(row?.employee_name_snapshot || row?.employee_name)}</b><br>Lokasi kerja: ${esc(row?.location_name_snapshot || row?.location_name || "-")}</p><p>Berdasarkan catatan kehadiran periode <b>${esc(periodText(row?.period))}</b>, terdapat ketidakhadiran sebanyak <b>${Number(row?.absence_days || 0)} hari</b>.</p><table class="notice-table"><tr><td>Dasar</td><td>${esc(notice?.basis || "-")}</td></tr><tr><td>Tanggal ketidakhadiran</td><td>${esc(notice?.dates || "-")}</td></tr><tr><td>Rincian</td><td>${esc(notice?.detail || "-")}</td></tr><tr><td>Catatan karyawan</td><td>${esc(notice?.employee_note || "-")}</td></tr></table><div class="notice-amount">Potongan gaji: ${money(row?.absence_deduction)}</div><p>Surat ini dibuat sebagai pemberitahuan dan arsip HRD Dimsum Aditya.</p></div></section>`;
}

export function printPayrollSlipV32(row) {
  const daily = String(row?.salary_mode || "").toUpperCase() === "HARIAN";
  const branch = row?.location_name_snapshot || row?.location_name || "-";
  const body = `<main class="slip-sheet"><div class="slip-head">${brandBlock(`Cabang ${branch}`)}<div class="slip-title"><h2>SLIP GAJI</h2><p>Periode: ${esc(periodText(row?.period))}</p><p>${esc(scheduleLabel(row))}</p></div></div><div class="info"><div><span>Nama Karyawan</span><strong>${esc(row?.employee_name_snapshot || row?.employee_name)}</strong></div><div><span>Lokasi / Cabang</span><strong>${esc(branch)}</strong></div><div><span>Tanggal Cetak</span><strong>${esc(dateText(new Date().toISOString().slice(0, 10)))}</strong></div></div><div class="cols"><div><div class="section-title">Penghasilan</div><div class="row"><span>${daily ? "Gaji Harian" : "Gaji Pokok"}</span><b>${money(row?.base_salary)}</b></div>${daily ? `<div class="row"><span>${money(row?.daily_salary)} × ${Number(row?.work_days || 0)} hari</span><span></span></div>` : ""}<div class="row"><span>Bonus / Insentif</span><b>${money(row?.bonus_amount)}</b></div><div class="row"><span>Uang Lembur</span><b>${money(row?.overtime_amount)}</b></div><div class="row total"><span>Total Penghasilan (A)</span><b>${money(row?.total_income)}</b></div></div><div><div class="section-title">Potongan</div><div class="row"><span>Potongan Absen (${Number(row?.absence_days || 0)} hari)</span><b>${money(row?.absence_deduction)}</b></div><div class="row"><span>Kasbon Bulanan</span><b>${money(row?.advance_deduction)}</b></div><div class="row"><span>Cicilan Pinjaman</span><b>${money(row?.loan_deduction)}</b></div><div class="row"><span>Potongan Lain</span><b>${money(row?.extra_deduction)}</b></div><div class="row total red"><span>Total Potongan (B)</span><b>${money(row?.total_deduction)}</b></div></div></div><div class="bottom"><div class="loan-box"><div class="loan-row"><span>Sisa Pinjaman Awal</span><strong>${money(row?.loan_balance_before)}</strong></div><div class="loan-row"><span>Potongan Bulan Ini</span><strong>${money(row?.loan_deduction)}</strong></div><div class="loan-row"><span>Saldo Pinjaman Akhir</span><strong>${money(row?.loan_balance_after)}</strong></div></div><div class="thp"><span>Take Home Pay (A - B)</span><strong>${money(row?.net_pay)}</strong></div></div>${row?.notes || row?.input_snapshot?.notes ? `<div class="notes">Catatan: ${esc(row?.notes || row?.input_snapshot?.notes || "-")}</div>` : ""}<div class="signs"><div>Mengetahui,<div class="sign-space"></div><strong>Pihak Manajemen</strong></div><div>Penerima,<div class="sign-space"></div><strong>${esc(row?.employee_name_snapshot || row?.employee_name)}</strong></div></div><div class="footer">Dicetak ${esc(printedDateText())} • Dimsum Aditya Payroll • Print tidak mengubah ledger; closing mengunci kasbon/cicilan.</div></main>${absenceNoticeHtml(row)}`;
  return printWindow(`Slip Gaji - ${row?.employee_name_snapshot || row?.employee_name || "Karyawan"}`, body, slipCss());
}


function payrollSlipMarkup(row, extraClass = "") {
  const daily = String(row?.salary_mode || "").toUpperCase() === "HARIAN";
  const branch = row?.location_name_snapshot || row?.location_name || "-";
  return `<main class="slip-sheet ${esc(extraClass)}"><div class="slip-head">${brandBlock(`Cabang ${branch}`)}<div class="slip-title"><h2>SLIP GAJI</h2><p>Periode: ${esc(periodText(row?.period))}</p><p>${esc(scheduleLabel(row))}</p></div></div><div class="info"><div><span>Nama Karyawan</span><strong>${esc(row?.employee_name_snapshot || row?.employee_name)}</strong></div><div><span>Lokasi / Cabang</span><strong>${esc(branch)}</strong></div><div><span>Tanggal Cetak</span><strong>${esc(dateText(new Date().toISOString().slice(0, 10)))}</strong></div></div><div class="cols"><div><div class="section-title">Penghasilan</div><div class="row"><span>${daily ? "Gaji Harian" : "Gaji Pokok"}</span><b>${money(row?.base_salary)}</b></div>${daily ? `<div class="row"><span>${money(row?.daily_salary)} × ${Number(row?.work_days || 0)} hari</span><span></span></div>` : ""}<div class="row"><span>Bonus / Insentif</span><b>${money(row?.bonus_amount)}</b></div><div class="row"><span>Uang Lembur</span><b>${money(row?.overtime_amount)}</b></div><div class="row total"><span>Total Penghasilan (A)</span><b>${money(row?.total_income)}</b></div></div><div><div class="section-title">Potongan</div><div class="row"><span>Potongan Absen (${Number(row?.absence_days || 0)} hari)</span><b>${money(row?.absence_deduction)}</b></div><div class="row"><span>Kasbon Bulanan</span><b>${money(row?.advance_deduction)}</b></div><div class="row"><span>Cicilan Pinjaman</span><b>${money(row?.loan_deduction)}</b></div><div class="row"><span>Potongan Lain</span><b>${money(row?.extra_deduction)}</b></div><div class="row total red"><span>Total Potongan (B)</span><b>${money(row?.total_deduction)}</b></div></div></div><div class="bottom"><div class="loan-box"><div class="loan-row"><span>Sisa Pinjaman Awal</span><strong>${money(row?.loan_balance_before)}</strong></div><div class="loan-row"><span>Potongan Bulan Ini</span><strong>${money(row?.loan_deduction)}</strong></div><div class="loan-row"><span>Saldo Pinjaman Akhir</span><strong>${money(row?.loan_balance_after)}</strong></div></div><div class="thp"><span>Take Home Pay (A - B)</span><strong>${money(row?.net_pay)}</strong></div></div>${row?.notes || row?.input_snapshot?.notes ? `<div class="notes">Catatan: ${esc(row?.notes || row?.input_snapshot?.notes || "-")}</div>` : ""}<div class="signs"><div>Mengetahui,<div class="sign-space"></div><strong>Pihak Manajemen</strong></div><div>Penerima,<div class="sign-space"></div><strong>${esc(row?.employee_name_snapshot || row?.employee_name)}</strong></div></div><div class="footer">Dicetak ${esc(printedDateText())} • Dimsum Aditya Payroll • Print tidak mengubah ledger; closing mengunci kasbon/cicilan.</div></main>`;
}

export function printPayrollBatchV32(rows, title = "Slip Payroll Dimsum Aditya") {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!list.length) throw new Error("Tidak ada slip payroll untuk dicetak.");
  const body = list.map((row, index) => payrollSlipMarkup(row, index < list.length - 1 ? "batch-slip" : "")).join("");
  const css = `${slipCss()} .batch-slip{break-after:page;page-break-after:always}`;
  return printWindow(title, body, css);
}

function groupBy(rows, keyFn) {
  const out = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(row);
  });
  return out;
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row?.[field] || 0), 0);
}

function recapCss({ landscape = true } = {}) {
  const pageRule = landscape ? "@page{size:A4 landscape;margin:7mm}" : "@page{size:A4 portrait;margin:10mm}";
  const reportWidth = landscape ? "283mm" : "190mm";
  return `${exactColorCss}
    ${pageRule}body{background:#fff}.report{width:100%;max-width:${reportWidth};margin:0 auto}.report-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #D9251C;padding-bottom:9px;margin-bottom:10px}.report-title{text-align:right}.report-title h2{margin:0;color:#D9251C;font-size:16pt;font-weight:900;letter-spacing:-.6px}.report-title p{margin:2px 0 0;color:#6B7280;font-size:7.5pt;font-weight:750}.summary{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin:8px 0 10px}.summary div{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:7px;padding:6px}.summary div.green{background:#ECFDF5;border-color:#A7F3D0}.summary span{display:block;color:#6B7280;font-size:5.8pt;font-weight:900;text-transform:uppercase}.summary b{display:block;margin-top:2px;font-size:8.2pt;font-weight:900}.summary .green b{color:#047857}.section{margin:10px 0 12px;break-inside:auto}.section h2{margin:0 0 5px;padding-left:6px;border-left:4px solid #D9251C;font-size:9pt;font-weight:900}.section h3{margin:8px 0 4px;font-size:7.5pt;color:#374151}table{width:100%;border-collapse:collapse;font-size:5.9pt;table-layout:fixed}th{background:#FEE2E2;color:#7F1D1D;text-transform:uppercase;font-size:5.4pt;font-weight:900}th,td{border:1px solid #E5E7EB;padding:3px 3.5px;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even) td{background:#FAFAFA}.total td{background:#ECFDF5!important;color:#065F46;font-weight:900}.employee-cell strong{display:block}.employee-cell span{color:#6B7280;font-size:5.2pt}.note{margin-top:8px;border-top:1px dashed #D1D5DB;padding-top:6px;color:#6B7280;font-size:5.8pt;font-weight:700;line-height:1.35}.page-soft{break-before:auto}.nowrap{white-space:nowrap}.center{text-align:center}.right{text-align:right}
  `;
}

export function printPayrollRecapA4V32(rows, period, options = {}) {
  const data = Array.isArray(rows) ? rows : [];
  const mode = String(options.mode || "READY").toUpperCase();
  const area = String(options.area || "ALL");
  const schedule = String(options.schedule || "ALL");
  const filtered = data.filter((row) => {
    if (area !== "ALL" && String(row.location_name_snapshot || row.location_name || row.location_code) !== area && String(row.location_id) !== area) return false;
    if (schedule !== "ALL" && scheduleLabel(row) !== schedule) return false;
    if (mode === "CLOSED" && String(row.status || "").toUpperCase() !== "CLOSED") return false;
    return true;
  });
  const branchGroups = groupBy(filtered, (row) => row.location_name_snapshot || row.location_name || row.location_code || "Tanpa Cabang");
  const scheduleGroups = groupBy(filtered, scheduleLabel);
  const totals = {
    income: sum(filtered, "total_income"), deduction: sum(filtered, "total_deduction"), net: sum(filtered, "net_pay"),
    advance: sum(filtered, "advance_deduction"), loan: sum(filtered, "loan_deduction"),
    closed: filtered.filter((r) => String(r.status).toUpperCase() === "CLOSED").length,
    paid: filtered.filter((r) => String(r.payment_status).toUpperCase() === "PAID").length,
  };
  const detailRows = filtered.map((row, index) => `<tr><td class="center">${index + 1}</td><td class="employee-cell"><strong>${esc(row.employee_name_snapshot || row.employee_name)}</strong><span>${esc(row.status || "-")} · ${esc(row.payment_status || "UNPAID")}</span></td><td>${esc(row.location_name_snapshot || row.location_name || "-")}</td><td>${esc(scheduleLabel(row))}</td><td class="right nowrap">${money(row.total_income)}</td><td class="right nowrap">${money(row.absence_deduction)}</td><td class="right nowrap">${money(row.advance_deduction)}</td><td class="right nowrap">${money(row.loan_deduction)}</td><td class="right nowrap">${money(row.extra_deduction)}</td><td class="right nowrap">${money(row.total_deduction)}</td><td class="right nowrap bold green">${money(row.net_pay)}</td></tr>`).join("");
  const branchRows = Array.from(branchGroups.entries()).map(([name, list]) => `<tr><td>${esc(name)}</td><td class="center">${list.length}</td><td class="center">${list.filter((r)=>String(r.status).toUpperCase()==="CLOSED").length}</td><td class="right">${money(sum(list,"total_income"))}</td><td class="right">${money(sum(list,"advance_deduction"))}</td><td class="right">${money(sum(list,"loan_deduction"))}</td><td class="right">${money(sum(list,"total_deduction"))}</td><td class="right green bold">${money(sum(list,"net_pay"))}</td></tr>`).join("");
  const scheduleRows = Array.from(scheduleGroups.entries()).sort(([a],[b]) => a.localeCompare(b, "id", { numeric: true })).map(([name, list]) => `<tr><td>${esc(name)}</td><td class="center">${list.length}</td><td class="center">${list.filter((r)=>String(r.status).toUpperCase()==="CLOSED").length}</td><td class="right">${money(sum(list,"total_income"))}</td><td class="right">${money(sum(list,"total_deduction"))}</td><td class="right green bold">${money(sum(list,"net_pay"))}</td></tr>`).join("");
  const advances = Array.isArray(options.advances) ? options.advances.filter((row) => String(row.entry_date || "").slice(0,7) === String(period)) : [];
  const advanceRows = advances.map((row,index)=>`<tr><td class="center">${index+1}</td><td>${esc(row.location_name || row.location_code || "-")}</td><td><strong>${esc(row.employee_name || "-")}</strong></td><td>${esc(dateText(row.entry_date))}</td><td>${esc(row.notes || "-")}</td><td class="right bold">${money(row.amount)}</td></tr>`).join("");
  const headerScope = `${area === "ALL" ? "Semua Cabang" : area}${schedule === "ALL" ? "" : ` · ${schedule}`}`;
  const modeText = mode === "CLOSED" ? "FINAL / CLOSED" : "PEMERIKSAAN / DRAFT + CLOSED";
  const body = `<main class="report"><div class="report-header">${brandBlock("Rekap Pemeriksaan Payroll")}<div class="report-title"><h2>REKAP PAYROLL ${esc(headerScope.toUpperCase())}</h2><p>Periode ${esc(periodText(period))} • ${esc(modeText)}</p><p>Dicetak ${esc(printedDateText())}</p></div></div><div class="summary"><div class="green"><span>Dana Siap Dibayar</span><b>${money(totals.net)}</b></div><div><span>Total Penghasilan</span><b>${money(totals.income)}</b></div><div><span>Total Potongan</span><b>${money(totals.deduction)}</b></div><div><span>Karyawan / Slip</span><b>${filtered.length}</b></div><div><span>Closing</span><b>${totals.closed}</b></div><div><span>Sudah Dibayar</span><b>${totals.paid}</b></div></div><section class="section"><h2>Ringkasan Dana Siap Dibayar per Cabang</h2><table><thead><tr><th>Cabang</th><th>Karyawan</th><th>Closed</th><th>Penghasilan</th><th>Kasbon</th><th>Cicilan</th><th>Total Pot.</th><th>THP</th></tr></thead><tbody>${branchRows || `<tr><td colspan="8" class="center muted">Tidak ada data sesuai filter.</td></tr>`}<tr class="total"><td>TOTAL</td><td class="center">${filtered.length}</td><td class="center">${totals.closed}</td><td class="right">${money(totals.income)}</td><td class="right">${money(totals.advance)}</td><td class="right">${money(totals.loan)}</td><td class="right">${money(totals.deduction)}</td><td class="right">${money(totals.net)}</td></tr></tbody></table></section><section class="section"><h2>Rekap per Jadwal Gajian</h2><table><thead><tr><th>Jadwal</th><th>Slip</th><th>Closed</th><th>Penghasilan</th><th>Potongan</th><th>THP</th></tr></thead><tbody>${scheduleRows || `<tr><td colspan="6" class="center muted">Tidak ada data.</td></tr>`}</tbody></table></section><section class="section"><h2>Rincian Payroll</h2><table><colgroup><col style="width:4%"><col style="width:15%"><col style="width:9%"><col style="width:7%"><col style="width:10%"><col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:10%"><col style="width:13%"></colgroup><thead><tr><th>No</th><th>Karyawan / Status</th><th>Area</th><th>Jadwal</th><th>Penghasilan</th><th>Absen</th><th>Kasbon</th><th>Cicilan</th><th>Pot. Lain</th><th>Total Pot.</th><th>THP</th></tr></thead><tbody>${detailRows || `<tr><td colspan="11" class="center muted">Tidak ada payroll sesuai filter.</td></tr>`}</tbody></table></section>${advances.length ? `<section class="section page-soft"><h2>Detail Pengambilan Kasbon Periode Ini</h2><table><thead><tr><th>No</th><th>Area</th><th>Karyawan</th><th>Tanggal</th><th>Keterangan</th><th>Nominal</th></tr></thead><tbody>${advanceRows}<tr class="total"><td colspan="5">TOTAL KASBON DIAMBIL</td><td class="right">${money(sum(advances,"amount"))}</td></tr></tbody></table></section>` : ""}<div class="note"><strong>Jenis cetak: ${esc(modeText)}.</strong> Slip yang sudah closing memakai angka terkunci; draft memakai angka terakhir dari server. Print tidak mengubah ledger. Pembayaran gaji tetap dilakukan dari proses pembayaran ERP agar Wallet OUT hanya tercatat satu kali.</div></main>`;
  return printWindow(`Rekap Payroll ${headerScope} - ${periodText(period)}`, body, recapCss());
}

function receiptCss() {
  return `${exactColorCss}
    @page{size:A4 portrait;margin:10mm}body{background:#F3F4F6}.sheet{max-width:190mm;margin:0 auto;background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:10mm 12mm;box-shadow:0 10px 28px rgba(17,24,39,.08)}.receipt{font-size:8.2pt}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #E5E7EB;padding-bottom:7px;margin-bottom:9px}.title{text-align:right}.title h2{margin:0;font-size:12.8pt;color:#D9251C;font-weight:900}.title p{margin:1px 0 0;font-size:7.8pt;font-weight:800;color:#6B7280}.info{background:#F9FAFB;border:1px solid #F3F4F6;border-radius:10px;padding:8px 11px;margin-bottom:8px;display:flex;justify-content:space-between;gap:12px}.info span{display:block;font-size:6.8pt;color:#6B7280;font-weight:900;text-transform:uppercase;letter-spacing:.45px}.info strong{display:block;margin-top:2px;font-size:8.5pt}.cols{display:flex;gap:16px;margin-bottom:7px}.col{flex:1}.section-title{font-size:7.6pt;font-weight:900;color:#6B7280;text-transform:uppercase;padding-bottom:4px;border-bottom:2px solid #E5E7EB;margin-bottom:5px}.row{display:flex;justify-content:space-between;gap:10px;padding:2.8px 0;font-weight:700;font-size:8pt;color:#374151}.row span:last-child{font-weight:900;color:#111827;text-align:right}.row.total{padding:4px 0;border-top:1px dashed #D1D5DB;margin-top:2px;font-size:8.4pt;color:#D9251C;font-weight:950}.bottom{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;margin-top:4px}.note-box{font-size:7.2pt;color:#92400E;line-height:1.35;font-weight:750;background:#FFF7ED;padding:7px 10px;border-radius:8px;border:1px solid #FED7AA;flex:1}.big{background:#FEF2F2;border-left:5px solid #D9251C;padding:8px 14px;border-radius:8px;text-align:right;min-width:190px}.big.green{background:#ECFDF5;border-color:#00B14F}.big span{display:block;font-size:7.2pt;color:#991B1B;font-weight:900;text-transform:uppercase}.big.green span{color:#047857}.big strong{display:block;font-size:14.2pt;color:#D9251C;font-weight:950;margin-top:2px}.big.green strong{color:#00B14F}.signs{display:flex;justify-content:space-between;margin-top:14px;padding:0 34px;font-size:7.4pt;font-weight:800;color:#4B5563;text-align:center}.sign-space{height:20px}.signs strong{display:inline-block;min-width:128px;border-bottom:1px solid #111827;padding-bottom:2px;color:#111827}.footer{margin-top:8px;border-top:1px dashed #D1D5DB;padding-top:6px;color:#6B7280;font-size:6.8pt;font-weight:800;text-align:center}@media print{body{background:#fff}.sheet{box-shadow:none;border:0;border-radius:0;padding:0}}
  `;
}

export function printHRDAdvanceV32(row, context = {}) {
  const branch = context.employee?.location_name || row?.location_name || row?.location_code || "-";
  const safeLimit = context.safe_limit;
  const reserve = Number(context.loan_reserved || 0) + Number(context.absence_reserved || 0);
  const taken = context.taken_amount ?? row?.amount ?? 0;
  const remaining = context.remaining_limit ?? (safeLimit == null ? null : Math.max(0, Number(safeLimit) - Number(taken)));
  const body = `<div class="sheet"><div class="receipt"><div class="head">${brandBlock(`Cabang ${branch}`)}<div class="title"><h2>BUKTI KASBON</h2><p>Periode: ${esc(periodText(String(row?.entry_date || "").slice(0,7)))}</p><p>ID: ${esc(row?.advance_entry_id || "-")}</p></div></div><div class="info"><div><span>Nama Karyawan</span><strong>${esc(row?.employee_name || context.employee?.employee_name || "-")}</strong></div><div><span>Lokasi / Cabang</span><strong>${esc(branch)}</strong></div><div style="text-align:right"><span>Tanggal Ambil</span><strong>${esc(dateText(row?.entry_date))}</strong></div></div><div class="cols"><div class="col"><div class="section-title">Data Pengambilan</div><div class="row"><span>Tanggal Ambil</span><span>${esc(dateText(row?.entry_date))}</span></div><div class="row"><span>Keterangan</span><span>${esc(row?.notes || "-")}</span></div><div class="row total"><span>Nominal Kasbon</span><span>${money(row?.amount)}</span></div></div><div class="col"><div class="section-title">Kontrol Limit Kasbon</div>${safeLimit == null ? `<div class="row"><span>Limit Aman</span><span>Disembunyikan sesuai hak akses</span></div>` : `<div class="row"><span>Limit Aman Kasbon</span><span>${money(safeLimit)}</span></div><div class="row"><span>Cadangan Cicilan/Absen</span><span>${money(reserve)}</span></div><div class="row"><span>Total Ambil Bulan Ini</span><span>${money(taken)}</span></div><div class="row total"><span>Sisa Bisa Kasbon</span><span>${money(remaining)}</span></div>`}</div></div><div class="bottom"><div class="note-box">Catatan: bukti ini hanya untuk pengambilan kasbon. Pelunasan/pemotongan tetap dicatat saat closing gajian periode terkait. Transaksi ERP live membentuk Piutang Kasbon Karyawan dan Wallet OUT satu kali.</div><div class="big"><span>Nominal Diterima</span><strong>${money(row?.amount)}</strong></div></div><div class="signs"><div>Mengetahui,<div class="sign-space"></div><strong>Pihak Manajemen</strong></div><div>Penerima,<div class="sign-space"></div><strong>${esc(row?.employee_name || context.employee?.employee_name || "Karyawan")}</strong></div></div><div class="footer">Dicetak tanggal ${esc(printedDateText())} • Dimsum Aditya Payroll</div></div></div>`;
  return printWindow(`Bukti Kasbon - ${row?.employee_name || "Karyawan"}`, body, receiptCss());
}

export function printHRDLoanV32(row, context = {}) {
  const branch = context.employee?.location_name || row?.location_name || row?.location_code || "-";
  const isClosed = String(row?.status || "").toUpperCase() === "CLOSED" || Number(row?.remaining_amount || 0) <= 0;
  const body = `<div class="sheet"><div class="receipt"><div class="head">${brandBlock(`Cabang ${branch}`)}<div class="title"><h2>BUKTI PINJAMAN</h2><p>ID: ${esc(row?.loan_id || "-")}</p></div></div><div class="info"><div><span>Nama Karyawan</span><strong>${esc(row?.employee_name || context.employee?.employee_name || "-")}</strong></div><div><span>Tanggal Pinjaman</span><strong>${esc(dateText(row?.loan_date))}</strong></div><div style="text-align:right"><span>Status</span><strong>${esc(row?.status || "OPEN")}</strong></div></div><div class="cols"><div class="col"><div class="section-title">Detail Transaksi</div><div class="row"><span>Keterangan</span><span>${esc(row?.notes || "-")}</span></div><div class="row"><span>Akun Debit</span><span>Piutang Pinjaman Karyawan</span></div><div class="row"><span>Akun Kredit</span><span>Dompet / Kas Keluar</span></div><div class="row total"><span>Nominal Pinjaman</span><span>${money(row?.original_amount)}</span></div></div><div class="col"><div class="section-title">Kontrol Cicilan</div><div class="row"><span>Tenor</span><span>${Number(row?.tenor_paid || 0)} / ${Number(row?.tenor_total || 0)}</span></div><div class="row"><span>Cicilan Otomatis</span><span>${money(row?.installment_amount)}</span></div><div class="row"><span>Mulai Potong</span><span>${esc(periodText(row?.start_period))}</span></div><div class="row total"><span>Sisa Pinjaman</span><span>${money(row?.remaining_amount)}</span></div></div></div><div class="bottom"><div class="note-box">Tambah pinjaman: Piutang Pinjaman Karyawan naik dan uang keluar dari dompet lokasi. Cicilan payroll/manual menurunkan piutang; transaksi yang sudah tercatat tidak boleh didobel.</div><div class="big ${isClosed ? "green" : ""}"><span>${isClosed ? "Status Pinjaman" : "Saldo Utang Aktif"}</span><strong>${isClosed ? "LUNAS" : money(row?.remaining_amount)}</strong></div></div><div class="signs"><div>Mengetahui,<div class="sign-space"></div><strong>Pihak Manajemen</strong></div><div>Penerima,<div class="sign-space"></div><strong>${esc(row?.employee_name || context.employee?.employee_name || "Karyawan")}</strong></div></div><div class="footer">Dicetak tanggal ${esc(printedDateText())} • Dimsum Aditya Payroll</div></div></div>`;
  return printWindow(`Bukti Pinjaman - ${row?.employee_name || "Karyawan"}`, body, receiptCss());
}

export function printPayrollPaymentReceiptV32(payment) {
  const body = `<div class="sheet"><div class="receipt"><div class="head">${brandBlock("Bukti Pembayaran Gaji")}<div class="title"><h2>BUKTI BAYAR GAJI</h2><p>${esc(periodText(payment?.period))}</p><p>ID: ${esc(payment?.payment_id || "-")}</p></div></div><div class="info"><div><span>Karyawan</span><strong>${esc(payment?.employee_name_snapshot || "-")}</strong></div><div><span>Tanggal Bayar</span><strong>${esc(dateText(payment?.payment_date))}</strong></div><div style="text-align:right"><span>Status</span><strong>PAID</strong></div></div><div class="cols"><div class="col"><div class="section-title">Pembayaran</div><div class="row"><span>Dompet</span><span>${esc(payment?.wallet_name || "-")}</span></div><div class="row"><span>Metode</span><span>${esc(payment?.payment_method || "-")}</span></div><div class="row"><span>Referensi</span><span>${esc(payment?.reference_no || "-")}</span></div></div><div class="col"><div class="section-title">Kontrol</div><div class="row"><span>Payroll ID</span><span>${esc(payment?.payroll_run_id || "-")}</span></div><div class="row"><span>Wallet Effect</span><span>OUT</span></div><div class="row"><span>Status Pembayaran</span><span>PAID</span></div></div></div><div class="bottom"><div class="note-box">Pembayaran ini sudah membentuk Wallet OUT. Jangan dicatat ulang sebagai Kas Keluar manual.</div><div class="big green"><span>Nominal Dibayar</span><strong>${money(payment?.amount)}</strong></div></div><div class="signs"><div>Owner / HRD<div class="sign-space"></div><strong>Dimsum Aditya</strong></div><div>Penerima<div class="sign-space"></div><strong>${esc(payment?.employee_name_snapshot || "Karyawan")}</strong></div></div></div></div>`;
  return printWindow(`Bukti Bayar Gaji - ${payment?.employee_name_snapshot || "Karyawan"}`, body, receiptCss());
}

function simpleRecordShell(title, subtitle, badge, rows, footerNote = "Dokumen HRD Dimsum Aditya.") {
  const lines = rows.map(([label, value]) => `<div class="row"><span>${esc(label)}</span><span>${esc(value ?? "-")}</span></div>`).join("");
  return `<div class="sheet"><div class="receipt"><div class="head">${brandBlock(subtitle)}<div class="title"><h2>${esc(title)}</h2><p>${esc(badge)}</p></div></div><div class="cols"><div class="col" style="flex:1"><div class="section-title">Rincian</div>${lines}</div></div><div class="note-box">${esc(footerNote)}</div><div class="signs"><div>HRD / Admin<div class="sign-space"></div><strong>Dimsum Aditya</strong></div><div>Karyawan<div class="sign-space"></div><strong>________________</strong></div></div></div></div>`;
}

export function printHRDEmployeeRecordV32(employee) {
  return printWindow(`Data Karyawan - ${employee?.employee_name || ""}`, simpleRecordShell("DATA KARYAWAN", "HRD · Profil Karyawan", employee?.employment_status || "ACTIVE", [["Employee ID",employee?.employee_id],["Nama",employee?.employee_name],["Kode",employee?.employee_code],["Lokasi",employee?.location_name_snapshot || employee?.location_name || employee?.location_code],["Jabatan",employee?.position_name || employee?.position],["Tanggal Gajian",employee?.payroll_day ? `Tanggal ${employee.payroll_day}` : "-"],["Sistem Gaji",employee?.salary_mode],["Siklus",employee?.pay_cycle],["Status Kerja",employee?.employment_status]], "Nominal sensitif hanya tampil sesuai hak akses payroll."), receiptCss());
}

export function printHRDAttendanceV32(row) {
  return printWindow(`Absensi - ${row?.employee_name || ""}`, simpleRecordShell("CATATAN ABSENSI / IZIN", "HRD · Absensi & Izin", String(row?.attendance_type || "ABSENSI").replaceAll("_"," "), [["Attendance ID",row?.attendance_id],["Karyawan",row?.employee_name],["Tanggal",dateText(row?.attendance_date)],["Status",String(row?.attendance_type || "").replaceAll("_"," ")],["Nilai Hari",row?.day_fraction],["Potong Gaji",Number(row?.deduct_salary) === 1 ? "Ya" : "Tidak"],["Uang Lembur",money(row?.overtime_amount)],["Catatan",row?.notes || "-"]], "Perubahan setelah payroll closing dibatasi agar histori gaji tetap konsisten."), receiptCss());
}

export function printHRDEmployeeProfileV32(profile) {
  const employee = profile?.employee || {};
  const totals = profile?.totals || {};
  const fullAccess = Boolean(profile?.access?.full_payroll_access);
  const payrollRows = Array.isArray(profile?.payroll_rows) ? profile.payroll_rows : [];
  const advances = Array.isArray(profile?.kasbon_rows) ? profile.kasbon_rows : [];
  const loans = Array.isArray(profile?.loan_rows) ? profile.loan_rows : [];
  const attendance = Array.isArray(profile?.attendance_rows) ? profile.attendance_rows : [];
  const payrollHtml = payrollRows.map((row) => `<tr><td>${esc(periodText(row.period))}</td><td>${esc(row.status)}</td><td>${esc(row.payment_status)}</td><td class="right">${money(row.bonus_amount)}</td><td class="right">${money(row.overtime_amount)}</td><td class="right bold green">${money(row.net_pay)}</td></tr>`).join("");
  const advanceHtml = advances.map((row) => `<tr><td>${esc(dateText(row.entry_date))}</td><td>${esc(row.entry_type)}</td><td class="right">${money(row.amount)}</td><td>${esc(row.notes || "-")}</td></tr>`).join("");
  const loanHtml = loans.map((row) => `<tr><td>${esc(dateText(row.loan_date))}</td><td class="right">${money(row.original_amount)}</td><td class="right bold">${money(row.remaining_amount)}</td><td>${esc(row.status)}</td></tr>`).join("");
  const body = `<main class="profile"><div class="report-header">${brandBlock(`Profil & Riwayat Karyawan · Tahun ${profile?.year || "-"}`)}<div class="report-title"><h2>${esc(employee?.employee_name || "KARYAWAN")}</h2><p>${esc(employee?.location_name_snapshot || employee?.location_code || "-")}</p></div></div><div class="summary">${fullAccess ? `<div class="green"><span>Gaji Diterima ${esc(profile?.year)}</span><b>${money(totals.salary_received_year)}</b></div><div><span>Gaji s.d. Kemarin</span><b>${money(totals.salary_received_to_yesterday)}</b></div><div><span>Bonus</span><b>${money(totals.bonus_paid_year)}</b></div><div><span>Lembur</span><b>${money(totals.overtime_paid_year)}</b></div>` : ""}<div><span>Sisa Kasbon</span><b>${money(totals.advance_balance)}</b></div><div><span>Sisa Pinjaman</span><b>${money(totals.loan_balance)}</b></div></div>${fullAccess ? `<section class="section"><h2>Riwayat Payroll</h2><table><thead><tr><th>Periode</th><th>Status</th><th>Bayar</th><th>Bonus</th><th>Lembur</th><th>THP</th></tr></thead><tbody>${payrollHtml || `<tr><td colspan="6">Belum ada payroll live tahun ini.</td></tr>`}</tbody></table></section>` : ""}<section class="section"><h2>Kasbon</h2><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Nominal</th><th>Catatan</th></tr></thead><tbody>${advanceHtml || `<tr><td colspan="4">Tidak ada data.</td></tr>`}</tbody></table></section><section class="section"><h2>Pinjaman / Cicilan</h2><table><thead><tr><th>Tanggal</th><th>Awal</th><th>Sisa</th><th>Status</th></tr></thead><tbody>${loanHtml || `<tr><td colspan="4">Tidak ada data.</td></tr>`}</tbody></table></section><div class="note">Absensi ${attendance.length} catatan · Lembur dari absensi ${money(totals.overtime_attendance_year)}. ${esc(profile?.data_note || "")}</div></main>`;
  return printWindow(`Profil HRD - ${employee?.employee_name || "Karyawan"}`, body, recapCss({ landscape: false }));
}
