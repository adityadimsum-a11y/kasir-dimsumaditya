/********************************************************
 * goLiveChecklistRules.js
 * ERP DIMSUM ADITYA — Part 5U
 *
 * Tujuan:
 * - Mengubah hasil Data Health + Action Hub menjadi checklist go-live.
 * - Read-only, tidak membuat/mengubah transaksi.
 ********************************************************/

function asNumber(value) {
  const cleaned = String(value ?? "0").replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function findModule(modules, keys) {
  const targets = keys.map((key) => String(key || "").toLowerCase());
  return (modules || []).find((row) => {
    const text = `${row.module || ""} ${row.tab || ""} ${row.source || ""}`.toLowerCase();
    return targets.some((target) => text.includes(target));
  });
}

function statusFromCounts({ blockers = 0, warnings = 0, passWhenClean = true }) {
  if (blockers > 0) return "BLOCKER";
  if (warnings > 0) return "WARNING";
  return passWhenClean ? "PASS" : "MANUAL";
}

function labelStatus(status) {
  if (status === "PASS") return "Aman";
  if (status === "WARNING") return "Perlu Dirapikan";
  if (status === "BLOCKER") return "Jangan Go-Live Dulu";
  return "Manual Check";
}

function toneStatus(status) {
  if (status === "PASS") return "success";
  if (status === "BLOCKER") return "danger";
  if (status === "WARNING") return "warning";
  return "default";
}

function buildItem(key, title, owner, status, note, source = "Sistem") {
  return {
    key,
    title,
    owner,
    status,
    status_label: labelStatus(status),
    tone: toneStatus(status),
    note,
    source,
  };
}

export function buildSystemGoLiveChecklist(healthData = {}, actionHub = {}) {
  const summary = healthData.summary || {};
  const modules = healthData.modules || [];
  const checks = healthData.checks || [];
  const recent = healthData.recent || [];
  const issues = healthData.issues || [];
  const actionSummary = actionHub.summary || {};

  const errorCount = asNumber(summary.error_count);
  const warningCount = asNumber(summary.warning_count);
  const ghostRows = asNumber(summary.ghost_rows);
  const realRows = asNumber(summary.real_rows);
  const modulesChecked = asNumber(summary.modules_checked);
  const actionCritical = asNumber(actionSummary.CRITICAL);
  const actionWarning = asNumber(actionSummary.WARNING);
  const actionCards = asNumber(actionHub.total_cards || (actionHub.cards || []).length);

  const idProblemModules = modules.filter((row) => asNumber(row.missing_id) > 0);
  const ghostProblemModules = modules.filter((row) => asNumber(row.ghost_rows) > 0);

  const walletModule = findModule(modules, ["mutasi dompet", "walletmutations", "wallet"]);
  const orderModule = findModule(modules, ["order", "invoice", "payment", "piutang"]);
  const stockModule = findModule(modules, ["gerak stok", "stockmovements", "layer modal", "inventorycostlayers", "produksi"]);
  const archiveModule = findModule(modules, ["arsip", "archive"]);
  const payrollModule = findModule(modules, ["payroll", "hrd"]);
  const closingModule = findModule(modules, ["closing"]);

  const moneyChecks = checks.filter((row) => /uang|kas|hutang|kewajiban|payroll/i.test(row.label || ""));
  const stockChecks = checks.filter((row) => /stok|ayam|ready|produksi/i.test(row.label || ""));

  return [
    buildItem(
      "api-cable",
      "Kabel API, proxy, dan Apps Script",
      "Owner / Tech",
      realRows > 0 && modulesChecked > 0 ? "PASS" : "BLOCKER",
      realRows > 0
        ? `Backend sudah membaca ${realRows.toLocaleString("id-ID")} baris nyata dari ${modulesChecked.toLocaleString("id-ID")} modul.`
        : "Data Health belum membaca baris nyata. Jangan go-live sebelum kabel data hijau.",
      "Data Health"
    ),
    buildItem(
      "fatal-issues",
      "Masalah bahaya / error besar",
      "Owner / Admin HO",
      statusFromCounts({ blockers: errorCount }),
      errorCount > 0
        ? `${errorCount.toLocaleString("id-ID")} masalah bahaya masih ada.`
        : "Tidak ada masalah bahaya dari Data Health.",
      "Data Health"
    ),
    buildItem(
      "id-cleanup",
      "ID transaksi dan source ID",
      "Admin HO",
      statusFromCounts({ warnings: warningCount + idProblemModules.length }),
      warningCount + idProblemModules.length > 0
        ? `${warningCount.toLocaleString("id-ID")} catatan perlu cek. Modul dengan ID/source belum bersih: ${idProblemModules.length.toLocaleString("id-ID")}.`
        : "ID/source utama sudah bersih untuk periode ini.",
      "Data Health"
    ),
    buildItem(
      "ghost-row",
      "Ghost row / baris format kosong",
      "Admin HO",
      statusFromCounts({ warnings: ghostRows + ghostProblemModules.length }),
      ghostRows > 0
        ? `${ghostRows.toLocaleString("id-ID")} ghost row terdeteksi. Tidak dihitung transaksi, tapi sebaiknya dirapikan sebelum go-live final.`
        : "Tidak ada ghost row yang mengganggu pembacaan.",
      "Data Health"
    ),
    buildItem(
      "action-hub",
      "Action Hub transaksi yang belum nyambung",
      "Owner / Admin HO",
      statusFromCounts({ blockers: actionCritical, warnings: actionWarning }),
      actionCards > 0
        ? `${actionCards.toLocaleString("id-ID")} kartu aktif. Critical: ${actionCritical}, Warning: ${actionWarning}.`
        : "Action Hub aman, tidak ada kartu tindakan aktif.",
      "Action Hub"
    ),
    buildItem(
      "order-payment",
      "Order → Invoice → Uang Masuk → Piutang",
      "Kasir / Admin HO",
      orderModule ? statusFromCounts({ warnings: asNumber(orderModule.missing_id) }) : "WARNING",
      orderModule
        ? `Modul penjualan terbaca dari ${orderModule.tab || orderModule.module}. Perlu ID: ${asNumber(orderModule.missing_id)}.`
        : "Modul penjualan belum terbaca di Data Health.",
      "Benang Merah Penjualan"
    ),
    buildItem(
      "wallet-chain",
      "Kas keluar/masuk → Mutasi Dompet",
      "Owner / Admin HO",
      walletModule ? statusFromCounts({ warnings: asNumber(walletModule.missing_id) }) : "WARNING",
      walletModule
        ? `Mutasi dompet terbaca. Checklist uang: ${moneyChecks.length.toLocaleString("id-ID")} baris.`
        : "Mutasi dompet belum terbaca. Cek Kas & Dompet sebelum go-live.",
      "Benang Merah Uang"
    ),
    buildItem(
      "stock-chain",
      "DROP Ayam → Produksi → Stok Jadi",
      "Produksi / Admin HO",
      stockModule ? statusFromCounts({ warnings: asNumber(stockModule.missing_id) }) : "WARNING",
      stockModule
        ? `Stok/produksi terbaca. Checklist stok: ${stockChecks.length.toLocaleString("id-ID")} baris.`
        : "Rantai stok belum terbaca. Cek DROP Ayam, Produksi, dan Stok Jadi.",
      "Benang Merah Stok"
    ),
    buildItem(
      "archive-hook",
      "Arsip Digital dan timeline ID",
      "Owner / Admin HO",
      archiveModule && recent.length > 0 ? statusFromCounts({ warnings: asNumber(archiveModule.missing_id) }) : "WARNING",
      archiveModule
        ? `Arsip terbaca dari ${archiveModule.tab || archiveModule.module}. Jejak terakhir: ${recent.length.toLocaleString("id-ID")} item.`
        : "Arsip belum terbaca. Detail ID/timeline belum boleh dianggap final.",
      "Arsip Digital"
    ),
    buildItem(
      "payroll-closing",
      "Payroll, kewajiban, dan closing",
      "Owner / Admin HO",
      payrollModule || closingModule ? "MANUAL" : "MANUAL",
      "Wajib simulasi manual: buat periode payroll, cek kasbon/pinjaman, cek kewajiban owner, lalu closing tanpa mengubah data live sembarangan.",
      "Manual + Data Health"
    ),
  ];
}

export const GO_LIVE_MANUAL_CHECKS = [
  {
    key: "saldo-awal",
    title: "Saldo awal uang dan stok sudah diisi",
    owner: "Owner / Admin HO",
    note: "Cash, BCA, BRI, stok ayam, stok freezer, piutang lama, hutang lama, kasbon, dan kewajiban aktif sudah masuk sebagai saldo awal/opening balance.",
  },
  {
    key: "master-data",
    title: "Master data inti sudah bersih",
    owner: "Admin HO",
    note: "Produk, customer, supplier, lokasi, wallet, kategori transaksi, channel penjualan, dan reason code sudah aktif/tidak aktif dengan benar.",
  },
  {
    key: "role-permission",
    title: "Role dan permission sudah dites",
    owner: "Owner / Tech",
    note: "Owner, Tangerang, Pemalang, Cibinong sudah login sesuai hak akses. Cabang tidak melihat payroll/4 Amplop/owner-only data.",
  },
  {
    key: "daily-operation",
    title: "Simulasi operasional harian sudah jalan",
    owner: "Admin Operasional",
    note: "DROP Ayam, Produksi/Adukan, Stok Jadi, Kasir/Order, Pembayaran, Belanja, Hutang Nana, dan Arsip sudah dicoba end-to-end.",
  },
  {
    key: "branch-flow",
    title: "Cabang dan setoran sudah disimulasi",
    owner: "Admin Cabang / Owner",
    note: "Laporan harian, setoran cabang, validasi Tangerang, request/DO, dan penerimaan barang sudah dicoba minimal satu skenario.",
  },
  {
    key: "print-export",
    title: "Print, export, dan backup siap",
    owner: "Owner / Admin HO",
    note: "Nota/customer invoice, laporan owner, closing, payroll/slip, dan backup sheet/export sudah dicek formatnya.",
  },
  {
    key: "cutover-plan",
    title: "Tanggal cutover dan aturan input sudah diputuskan",
    owner: "Owner",
    note: "Sudah jelas kapan sistem mulai dipakai harian, siapa input apa, dan data lama mana yang hanya jadi arsip/referensi.",
  },
];

export function summarizeGoLiveReadiness(systemItems, manualState) {
  const manualValues = Object.values(manualState || {});
  const manualDone = manualValues.filter(Boolean).length;
  const manualTotal = GO_LIVE_MANUAL_CHECKS.length;
  const blockers = (systemItems || []).filter((item) => item.status === "BLOCKER").length;
  const warnings = (systemItems || []).filter((item) => item.status === "WARNING").length;
  const systemPass = (systemItems || []).filter((item) => item.status === "PASS").length;
  const systemTotal = (systemItems || []).length;

  const systemScore = systemTotal ? Math.round((systemPass / systemTotal) * 60) : 0;
  const manualScore = manualTotal ? Math.round((manualDone / manualTotal) * 40) : 0;
  const score = Math.min(100, systemScore + manualScore);

  let status = "Belum Siap Go-Live";
  let tone = "danger";
  let note = "Masih ada blocker sistem. Bereskan dulu sebelum uji operasional final.";

  if (blockers === 0 && warnings > 0) {
    status = "Siap UAT / Simulasi Terarah";
    tone = "warning";
    note = "Tidak ada blocker besar, tapi masih ada data yang perlu dirapikan sebelum go-live final.";
  }

  if (blockers === 0 && warnings === 0 && manualDone < manualTotal) {
    status = "Mesin Siap, Manual Checklist Belum Lengkap";
    tone = "warning";
    note = "Kabel sistem aman. Lengkapi checklist manual sebelum tanggal cutover.";
  }

  if (blockers === 0 && warnings === 0 && manualDone === manualTotal) {
    status = "Siap Go-Live Bertahap";
    tone = "success";
    note = "Kabel sistem dan checklist manual sudah hijau. Masuk go-live bertahap sesuai cabang/modul prioritas.";
  }

  return {
    score,
    status,
    tone,
    note,
    blockers,
    warnings,
    system_pass: systemPass,
    system_total: systemTotal,
    manual_done: manualDone,
    manual_total: manualTotal,
  };
}
