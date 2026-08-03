/**
 * printExportBackupRules.js
 * ERP DIMSUM ADITYA — Part 5W
 *
 * Pure JavaScript only. Tidak ada JSX di file ini.
 */

export function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function pickHealthSummary(healthData) {
  const raw = healthData?.summary || healthData?.data?.summary || healthData || {};
  return {
    danger: safeNumber(raw.danger || raw.critical || raw.masalah_bahaya || raw.CRITICAL),
    warning: safeNumber(raw.warning || raw.perlu_cek || raw.WARNING),
    ghost: safeNumber(raw.ghost || raw.ghost_rows || raw.hidden_ghost_rows),
    realRows: safeNumber(raw.real_rows || raw.realRows || raw.baris_nyata),
    modulesChecked: safeNumber(raw.modules_checked || raw.modulesChecked || raw.modul_dicek),
  };
}

export function pickActionHubSummary(actionHubData) {
  const raw = actionHubData?.summary || actionHubData?.data?.summary || actionHubData || {};
  return {
    critical: safeNumber(raw.CRITICAL || raw.critical),
    warning: safeNumber(raw.WARNING || raw.warning),
    info: safeNumber(raw.INFO || raw.info),
    totalCards: safeNumber(raw.total_cards || raw.totalCards || actionHubData?.total_cards),
  };
}

export function pickBackupSummary(backupData) {
  const raw = backupData?.summary || backupData?.data?.summary || backupData || {};
  return {
    sourceCount: safeNumber(raw.source_count || raw.sourceCount),
    backupCount: safeNumber(raw.backup_count || raw.backupCount),
    realRows: safeNumber(raw.real_rows || raw.realRows),
    ghostRows: safeNumber(raw.ghost_rows || raw.ghostRows),
    status: raw.status || backupData?.latest_backup?.status || "Belum Dicek",
  };
}

export function makeSafetyRow({ id, title, detail, status, tone = "warning", blocker = false, source = "-" }) {
  return {
    id,
    title,
    detail,
    status,
    tone,
    blocker: Boolean(blocker),
    source,
  };
}

export function buildPrintBackupReport({ healthData, actionHubData, backupData, session }) {
  const health = pickHealthSummary(healthData);
  const actionHub = pickActionHubSummary(actionHubData);
  const backup = pickBackupSummary(backupData);

  const rows = [
    makeSafetyRow({
      id: "proxy-json",
      title: "Kabel PHP/MySQL & Proxy",
      detail: healthData ? "Proxy dan backend PHP/MySQL sudah membalas JSON untuk laporan." : "Belum ada response Data Health.",
      status: healthData ? "AMAN" : "PERLU CEK",
      tone: healthData ? "success" : "danger",
      blocker: !healthData,
      source: "Data Health",
    }),
    makeSafetyRow({
      id: "data-health",
      title: "Data hidup terbaca",
      detail: `${health.modulesChecked} modul dicek, ${health.realRows} baris nyata terbaca.`,
      status: health.modulesChecked > 0 ? "AMAN" : "PERLU CEK",
      tone: health.modulesChecked > 0 ? "success" : "danger",
      blocker: health.modulesChecked <= 0,
      source: "Data Health",
    }),
    makeSafetyRow({
      id: "danger-zero",
      title: "Tidak ada masalah bahaya",
      detail: `${health.danger} masalah bahaya terdeteksi.`,
      status: health.danger === 0 ? "AMAN" : "BELUM AMAN",
      tone: health.danger === 0 ? "success" : "danger",
      blocker: health.danger > 0,
      source: "Data Health",
    }),
    makeSafetyRow({
      id: "action-hub",
      title: "Action Hub tidak punya blocker",
      detail: `${actionHub.critical} butuh dicek cepat, ${actionHub.warning} perlu perhatian, total ${actionHub.totalCards} kartu.`,
      status: actionHub.critical === 0 ? "AMAN" : "PERLU CEK",
      tone: actionHub.critical === 0 ? "success" : "danger",
      blocker: actionHub.critical > 0,
      source: "Action Hub",
    }),
    makeSafetyRow({
      id: "local-export",
      title: "Export ringkasan lokal tersedia",
      detail: "Owner bisa download JSON/CSV ringkasan safety tanpa mengubah transaksi.",
      status: "AMAN",
      tone: "success",
      blocker: false,
      source: "Browser Export",
    }),
    makeSafetyRow({
      id: "print-report",
      title: "Print laporan safety tersedia",
      detail: "Laporan safety bisa diprint/PDF dari browser sebagai bukti sebelum UAT/go-live bertahap.",
      status: "AMAN",
      tone: "success",
      blocker: false,
      source: "Browser Print",
    }),
    makeSafetyRow({
      id: "backup-log",
      title: "Riwayat backup dibaca",
      detail: `${backup.backupCount} backup/log terbaca dari sistem. Status terakhir: ${backup.status || "-"}.`,
      status: backupData ? "AMAN" : "OPSIONAL",
      tone: backupData ? "success" : "warning",
      blocker: false,
      source: "Backup Export",
    }),
    makeSafetyRow({
      id: "manual-drive-backup",
      title: "Backup file utama tetap perlu dicek owner",
      detail: "Sebelum dipakai full staff, owner tetap perlu menyimpan backup database, backend, dan frontend terbaru.",
      status: "PERLU UAT",
      tone: "warning",
      blocker: false,
      source: "Backup Produksi",
    }),
  ];

  const blockers = rows.filter((row) => row.blocker);
  let score = 100;
  if (!healthData) score -= 25;
  if (health.modulesChecked <= 0) score -= 20;
  if (health.danger > 0) score -= 25;
  if (actionHub.critical > 0) score -= 20;
  if (!backupData) score -= 5;
  score = Math.max(0, Math.min(100, score));

  return {
    generatedAt: new Date().toISOString(),
    score,
    statusLabel: blockers.length ? "Belum Aman" : score >= 90 ? "Aman untuk Go-Live Bertahap" : "Aman untuk UAT",
    tone: blockers.length ? "danger" : score >= 90 ? "success" : "warning",
    blockers,
    rows,
    health,
    actionHub,
    backup,
    session: {
      name: session?.name || session?.display_name || session?.user_name || "-",
      role: session?.role || session?.role_code || "-",
      location: session?.location_code || session?.location_id || "-",
    },
  };
}

export function makeExportPayload(report) {
  return {
    app: "ERP Dimsum Aditya",
    module: "Print / Export / Backup Safety",
    exported_at: new Date().toISOString(),
    report,
  };
}

export function buildSafetyCsv(report) {
  const rows = [
    ["Cek", "Detail", "Sumber", "Status"],
    ...(report?.rows || []).map((row) => [row.title, row.detail, row.source, row.status]),
  ];
  return rows
    .map((cols) =>
      cols
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
}

export function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function dateStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

export function buildCopySummary(report) {
  if (!report) return "";
  return [
    "PRINT / EXPORT / BACKUP SAFETY - ERP DIMSUM ADITYA",
    `Score: ${report.score}/100`,
    `Status: ${report.statusLabel}`,
    `Baris Nyata: ${report.health.realRows}`,
    `Modul Dicek: ${report.health.modulesChecked}`,
    `Masalah Bahaya: ${report.health.danger}`,
    `Action Hub: ${report.actionHub.totalCards}`,
    `Backup/Log: ${report.backup.backupCount}`,
  ].join("\n");
}

export default {
  safeNumber,
  pickHealthSummary,
  pickActionHubSummary,
  pickBackupSummary,
  buildPrintBackupReport,
  makeExportPayload,
  buildSafetyCsv,
  downloadTextFile,
  dateStamp,
  buildCopySummary,
};
