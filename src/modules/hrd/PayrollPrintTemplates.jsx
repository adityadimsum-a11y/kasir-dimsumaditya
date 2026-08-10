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


function brandHtml(subtitle = "") {
  const logo = esc(APP_BRAND?.logoUrl || "");
  return `<div class="brand"><span class="mark-wrap">${logo ? `<img class="brand-logo" src="${logo}" alt="Logo Dimsum Aditya" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ""}<span class="mark mark-fallback" style="${logo ? "display:none" : "display:flex"}">DA</span></span><div><h1>DIMSUM ADITYA</h1><p>${esc(subtitle)}</p></div></div>`;
}

function printWindow(title, body, css, autoPrint = true) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) throw new Error("Popup cetak diblokir browser.");
  win.document.open();
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${body}<script>${autoPrint ? "window.onload=()=>{window.print();};" : ""}<\/script></body></html>`);
  win.document.close();
  return win;
}

const commonCss = `
  *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{margin:0;background:#F3F4F6;color:#111827;font-family:Inter,Arial,sans-serif;font-size:12px}
  .brand{display:flex;align-items:center;gap:10px}.mark-wrap{width:46px;height:46px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 46px}.brand-logo{width:46px;height:46px;object-fit:contain;border-radius:12px}.mark{width:46px;height:46px;border-radius:16px;background:linear-gradient(135deg,#a11a13,#ef2b22);color:#fff;align-items:center;justify-content:center;font-weight:950}.mark-fallback{display:none}
  .brand h1{font-size:19px;margin:0;letter-spacing:-.5px}.brand p{margin:2px 0 0;color:#6b7280;font-weight:700}
  .pill{display:inline-block;border-radius:999px;padding:5px 9px;background:#FFF7ED;border:1px solid #FED7AA;color:#9A3412;font-weight:900;font-size:10px}
  table{width:100%;border-collapse:collapse}th,td{padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}th{background:#f8fafc;color:#475569;font-size:10px;text-transform:uppercase;letter-spacing:.5px}.right{text-align:right}.bold{font-weight:900}.muted{color:#6b7280}.red{color:#dc2626}.green{color:#047857}
  .signs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:20px;text-align:center}.sign-space{height:48px}
`;

export function printPayrollSlipV32(row) {
  const notice = row?.absence_notice || {};
  const daily = String(row?.salary_mode || "").toUpperCase() === "HARIAN";
  const payCycle = String(row?.pay_cycle || "BULANAN").toUpperCase();
  const schedule = payCycle === "MINGGUAN"
    ? `Minggu Ke-${row?.week_no || "-"}${row?.week_start ? ` · ${row.week_start} s.d. ${row.week_end || "-"}` : ""}`
    : `Tanggal gajian ${row?.payroll_day || "-"}`;
  const status = String(row?.status || "DRAFT").toUpperCase();
  const payment = String(row?.payment_status || "UNPAID").toUpperCase();
  const slip = `
    <main class="sheet">
      <header>${brandHtml(`Slip Gaji Karyawan · ${periodText(row?.period)}`)}<div class="meta"><span class="pill">${esc(status)}</span><strong>${esc(row?.payroll_run_id || "PREVIEW")}</strong></div></header>
      <section class="identity"><div><span>Nama Karyawan</span><strong>${esc(row?.employee_name_snapshot || row?.employee_name)}</strong></div><div><span>Lokasi</span><strong>${esc(row?.location_name_snapshot || row?.location_name)}</strong></div><div><span>Jadwal</span><strong>${esc(schedule)}</strong></div><div><span>Status Bayar</span><strong>${esc(payment)}</strong></div></section>
      <section class="columns">
        <div class="box"><h2>Penghasilan</h2>
          <div class="line"><span>${daily ? "Gaji Harian" : "Gaji Pokok"}</span><b>${money(row?.base_salary)}</b></div>
          ${daily ? `<div class="sub">${money(row?.daily_salary)} × ${Number(row?.work_days || 0)} hari</div>` : ""}
          <div class="line"><span>Bonus / Insentif</span><b>${money(row?.bonus_amount)}</b></div>
          <div class="line"><span>Uang Lembur</span><b>${money(row?.overtime_amount)}</b></div>
          <div class="line total"><span>Total Penghasilan (A)</span><b>${money(row?.total_income)}</b></div>
        </div>
        <div class="box"><h2>Potongan</h2>
          <div class="line"><span>Absen (${Number(row?.absence_days || 0)} hari)</span><b>${money(row?.absence_deduction)}</b></div>
          <div class="line"><span>Kasbon</span><b>${money(row?.advance_deduction)}</b></div>
          <div class="line"><span>Cicilan Pinjaman</span><b>${money(row?.loan_deduction)}</b></div>
          <div class="line"><span>Potongan Lain</span><b>${money(row?.extra_deduction)}</b></div>
          <div class="line total red"><span>Total Potongan (B)</span><b>${money(row?.total_deduction)}</b></div>
        </div>
      </section>
      <section class="loan"><div><span>Sisa pinjaman sebelum</span><b>${money(row?.loan_balance_before)}</b></div><div><span>Potongan cicilan</span><b>${money(row?.loan_deduction)}</b></div><div><span>Sisa pinjaman setelah</span><b>${money(row?.loan_balance_after)}</b></div></section>
      <section class="thp"><span>TAKE HOME PAY</span><strong>${money(row?.net_pay)}</strong><small>Terbilang tidak dicetak otomatis. Periksa nominal sebelum closing/pembayaran.</small></section>
      <div class="notes"><strong>Catatan:</strong> ${esc(row?.notes || row?.input_snapshot?.notes || "-")}</div>
      <div class="signs"><div>Owner / HRD<div class="sign-space"></div><strong>Dimsum Aditya</strong></div><div>Penerima<div class="sign-space"></div><strong>${esc(row?.employee_name_snapshot || row?.employee_name)}</strong></div></div>
      <footer>Print tidak memotong ledger. Closing mengunci kasbon/cicilan satu kali. Pembayaran membuat Wallet OUT.</footer>
    </main>
    ${notice?.enabled && notice?.print_with_slip !== false ? absenceNoticeHtml(row, notice) : ""}
  `;
  const css = `${commonCss}
    @page{size:A4 portrait;margin:10mm}body{background:#fff}.sheet{width:100%;max-width:190mm;min-height:0;margin:0 auto;padding:0;border:0;border-radius:0;page-break-after:${notice?.enabled && notice?.print_with_slip !== false ? "always" : "auto"}}
    header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #E5E7EB;padding-bottom:7px;margin-bottom:8px}.meta{text-align:right;display:grid;gap:6px}.identity{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:8px;margin:8px 0}.identity div{background:#F9FAFB;border:1px solid #F3F4F6;border-radius:10px;padding:7px 9px}.identity span{display:block;color:#64748b;font-size:9px;text-transform:uppercase;font-weight:900}.identity strong{display:block;margin-top:3px}
    .columns{display:grid;grid-template-columns:1fr 1fr;gap:10px}.box{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}.box h2{margin:0;padding:8px 10px;background:#fff1f2;color:#b91c1c;font-size:12px}.line{display:flex;justify-content:space-between;padding:5px 9px;border-bottom:1px dashed #e5e7eb}.line.total{background:#f8fafc;font-weight:900}.sub{font-size:9px;color:#64748b;padding:0 9px 5px}.loan{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:9px}.loan div{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:7px}.loan span{display:block;font-size:9px;color:#92400e}.loan b{display:block;margin-top:2px}.thp{margin-top:7px;background:#ECFDF5;border-left:5px solid #00B14F;color:#047857;border-radius:8px;padding:7px 13px;display:grid;grid-template-columns:1fr auto;align-items:center}.thp span{font-weight:950;text-transform:uppercase}.thp strong{font-size:20px;color:#00B14F}.thp small{grid-column:1/3;color:#6B7280;margin-top:2px}.notes{margin-top:8px;padding:7px 9px;background:#f8fafc;border-radius:9px}footer{margin-top:10px;text-align:center;color:#64748b;font-size:9px;font-weight:700}
    @media print{html,body{width:auto!important;height:auto!important;overflow:visible!important}.sheet,.sheet *{break-inside:avoid;page-break-inside:avoid}.sheet{padding:0!important}.sign-space{height:12px}}
    ${absenceNoticeCss()}
  `;
  return printWindow(`Slip Gaji ${row?.employee_name_snapshot || "Karyawan"}`, slip, css);
}

function absenceNoticeCss() {
  return `.notice-sheet{width:194mm;min-height:277mm;margin:0 auto;padding:14mm;background:#fff;page-break-before:always}.notice-head{display:flex;justify-content:space-between;border-bottom:3px solid #ef2b22;padding-bottom:12px}.notice-title{text-align:center;margin:22px 0}.notice-title h1{font-size:19px;margin:0;text-decoration:underline}.notice-body{font-size:13px;line-height:1.75}.notice-table{margin:16px 0;border:1px solid #d1d5db}.notice-table td{border:1px solid #d1d5db}.notice-amount{background:#fff1f2;color:#b91c1c;padding:12px;border-radius:12px;font-size:17px;font-weight:950;text-align:center}`;
}

function absenceNoticeHtml(row, notice) {
  return `<section class="notice-sheet"><div class="notice-head">${brandHtml("Tangerang HO")}<div><b>No: ${esc(notice?.number || "-")}</b><br><span class="muted">${esc(notice?.date || "-")}</span></div></div><div class="notice-title"><h1>${esc(notice?.type || "SURAT PEMBERITAHUAN")}</h1><p>Potongan Ketidakhadiran Karyawan</p></div><div class="notice-body"><p>Kepada Yth. <b>${esc(row?.employee_name_snapshot || row?.employee_name)}</b><br>Lokasi kerja: ${esc(row?.location_name_snapshot || row?.location_name)}</p><p>Berdasarkan catatan kehadiran periode <b>${esc(periodText(row?.period))}</b>, terdapat ketidakhadiran sebanyak <b>${Number(row?.absence_days || 0)} hari</b>.</p><table class="notice-table"><tr><td>Dasar</td><td>${esc(notice?.basis || "-")}</td></tr><tr><td>Tanggal ketidakhadiran</td><td>${esc(notice?.dates || "-")}</td></tr><tr><td>Rincian</td><td>${esc(notice?.detail || "-")}</td></tr><tr><td>Catatan karyawan</td><td>${esc(notice?.employee_note || "-")}</td></tr></table><div class="notice-amount">Potongan gaji: ${money(row?.absence_deduction)}</div><p>Surat ini dibuat sebagai pemberitahuan dan arsip HRD. Karyawan dapat menyampaikan klarifikasi kepada Owner/HRD apabila terdapat kekeliruan data.</p></div><div class="signs"><div>Owner / HRD<div class="sign-space"></div><strong>Dimsum Aditya</strong></div><div>Karyawan<div class="sign-space"></div><strong>${esc(row?.employee_name_snapshot || row?.employee_name)}</strong></div></div></section>`;
}

export function printPayrollRecapA4V32(rows, period) {
  const data = Array.isArray(rows) ? rows : [];
  const totals = data.reduce((acc, row) => {
    acc.income += Number(row.total_income || 0);
    acc.deduction += Number(row.total_deduction || 0);
    acc.net += Number(row.net_pay || 0);
    if (String(row.status).toUpperCase() === "CLOSED") acc.closed += 1;
    if (String(row.payment_status).toUpperCase() === "PAID") acc.paid += 1;
    return acc;
  }, { income: 0, deduction: 0, net: 0, closed: 0, paid: 0 });
  const bodyRows = data.map((row, index) => `<tr><td>${index + 1}</td><td><b>${esc(row.employee_name_snapshot || row.employee_name)}</b><br><span class="muted">${esc(row.position_name || "-")}</span></td><td>${esc(row.location_name_snapshot || row.location_name)}</td><td>${esc(row.pay_cycle === "MINGGUAN" ? `M${row.week_no || "-"}` : `Tgl ${row.payroll_day || "-"}`)}</td><td class="right">${money(row.base_salary)}</td><td class="right">${money(Number(row.bonus_amount || 0) + Number(row.overtime_amount || 0))}</td><td class="right">${money(row.absence_deduction)}</td><td class="right">${money(row.advance_deduction)}</td><td class="right">${money(row.loan_deduction)}</td><td class="right">${money(row.total_deduction)}</td><td class="right bold">${money(row.net_pay)}</td><td>${esc(row.status)} / ${esc(row.payment_status)}</td></tr>`).join("");
  const body = `<main class="recap"><header>${brandHtml(`REKAP PAYROLL A4 LENGKAP · Periode ${periodText(period)}`)}<div class="pill">V32 ERP</div></header><section class="summary"><div><span>Karyawan</span><b>${data.length}</b></div><div><span>Closed</span><b>${totals.closed}</b></div><div><span>Sudah Dibayar</span><b>${totals.paid}</b></div><div><span>Total THP</span><b>${money(totals.net)}</b></div></section><table><thead><tr><th>No</th><th>Karyawan</th><th>Area</th><th>Jadwal</th><th>Pokok</th><th>Bonus + Lembur</th><th>Absen</th><th>Kasbon</th><th>Cicilan</th><th>Total Pot.</th><th>THP</th><th>Status</th></tr></thead><tbody>${bodyRows || `<tr><td colspan="12">Belum ada data.</td></tr>`}<tr class="grand"><td colspan="4">TOTAL</td><td class="right">${money(totals.income)}</td><td></td><td colspan="3"></td><td class="right">${money(totals.deduction)}</td><td class="right">${money(totals.net)}</td><td></td></tr></tbody></table><div class="signs"><div>Dibuat oleh<div class="sign-space"></div><strong>HRD Dimsum Aditya</strong></div><div>Disetujui<div class="sign-space"></div><strong>Owner</strong></div></div></main>`;
  const css = `${commonCss}@page{size:A4 landscape;margin:7mm}body{background:#fff}.recap{width:283mm;margin:0 auto}.recap header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #ef2b22;padding-bottom:10px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.summary div{background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:9px}.summary span{display:block;font-size:9px;color:#64748b;text-transform:uppercase;font-weight:900}.summary b{display:block;font-size:16px;margin-top:3px}.recap table{font-size:9px}.recap th,.recap td{padding:5px}.grand{background:#fff1f2;color:#b91c1c;font-weight:950}`;
  return printWindow(`Rekap Payroll ${periodText(period)}`, body, css);
}

export function printPayrollPaymentReceiptV32(payment) {
  const body = `<main class="receipt"><header>${brandHtml("Bukti Pembayaran Gaji")}<span class="pill">PAID</span></header><table><tr><td>Payment ID</td><td class="bold">${esc(payment?.payment_id)}</td></tr><tr><td>Periode</td><td>${esc(periodText(payment?.period))}</td></tr><tr><td>Karyawan</td><td class="bold">${esc(payment?.employee_name_snapshot)}</td></tr><tr><td>Tanggal Bayar</td><td>${esc(payment?.payment_date)}</td></tr><tr><td>Dompet</td><td>${esc(payment?.wallet_name)}</td></tr><tr><td>Referensi</td><td>${esc(payment?.reference_no || "-")}</td></tr></table><div class="amount"><span>Nominal Dibayar</span><strong>${money(payment?.amount)}</strong></div><p class="muted">Pembayaran ini sudah membentuk Wallet OUT dan tidak boleh dicatat ulang.</p><div class="signs"><div>Owner / HRD<div class="sign-space"></div><strong>Dimsum Aditya</strong></div><div>Penerima<div class="sign-space"></div><strong>${esc(payment?.employee_name_snapshot)}</strong></div></div></main>`;
  const css = `${commonCss}@page{size:A5 portrait;margin:8mm}body{background:#fff}.receipt{width:132mm;margin:0 auto;border:1px solid #d1d5db;border-radius:14px;padding:10mm}.receipt header{display:flex;justify-content:space-between;border-bottom:3px solid #ef2b22;padding-bottom:10px}.receipt table{margin-top:12px}.amount{margin-top:12px;background:#ecfdf5;color:#047857;border-radius:12px;padding:12px;display:flex;justify-content:space-between;align-items:center}.amount strong{font-size:22px}`;
  return printWindow(`Bukti Bayar Gaji ${payment?.employee_name_snapshot || ""}`, body, css);
}
