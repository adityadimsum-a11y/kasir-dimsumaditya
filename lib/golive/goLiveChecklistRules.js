/**
 * frontend/src/lib/golive/goLiveChecklistRules.js
 * ERP DIMSUM ADITYA
 * Part 5U-3 — Go-Live Checklist Reset Fix
 *
 * Pure JavaScript only. Jangan taruh JSX di file .js ini.
 */

export const GO_LIVE_STATUS = {
  NOT_READY: "BELUM_SIAP",
  UAT_READY: "SIAP_UAT",
  STAGED_READY: "SIAP_GO_LIVE_BERTAHAP",
};

export function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;

  const cleaned = String(value)
    .replace(/Rp/gi, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

export function pickHealthSummary(healthData) {
  const raw = healthData?.summary || healthData?.data?.summary || healthData || {};

  return {
    danger: safeNumber(
      raw.error_count ??
        raw.danger ??
        raw.critical ??
        raw.masalah_bahaya ??
        raw.CRITICAL
    ),
    warning: safeNumber(
      raw.warning_count ??
        raw.warning ??
        raw.perlu_cek ??
        raw.WARNING
    ),
    ghost: safeNumber(
      raw.ghost_rows ??
        raw.ghost ??
        raw.hidden_ghost_rows ??
        raw.ghostRows
    ),
    realRows: safeNumber(
      raw.real_rows ??
        raw.realRows ??
        raw.baris_nyata
    ),
    modulesChecked: safeNumber(
      raw.modules_checked ??
        raw.modulesChecked ??
        raw.modul_dicek
    ),
  };
}

export function pickActionHubSummary(actionHubData) {
  const raw = actionHubData?.summary || actionHubData?.data?.summary || actionHubData || {};

  return {
    critical: safeNumber(raw.CRITICAL ?? raw.critical),
    warning: safeNumber(raw.WARNING ?? raw.warning),
    info: safeNumber(raw.INFO ?? raw.info),
    totalCards: safeNumber(
      raw.total_cards ??
        raw.totalCards ??
        actionHubData?.total_cards ??
        actionHubData?.cards?.length
    ),
  };
}

export function makeCheck({
  id,
  title,
  detail,
  status = "PERLU CEK",
  tone = "warning",
  score = 0,
  blocker = false,
  source = "-",
}) {
  return {
    id,
    title,
    detail,
    status,
    tone,
    score: safeNumber(score),
    blocker: Boolean(blocker),
    source,
  };
}

export function getGoLiveReadiness({ healthData, actionHubData } = {}) {
  const health = pickHealthSummary(healthData);
  const actionHub = pickActionHubSummary(actionHubData);

  const checks = [
    makeCheck({
      id: "backend-json",
      title: "Backend PHP/MySQL & Proxy membalas JSON",
      detail: healthData
        ? "Kabel Vercel proxy dan backend PHP/MySQL sudah membalas data JSON."
        : "Belum ada response Data Health.",
      status: healthData ? "AMAN" : "PERLU CEK",
      tone: healthData ? "success" : "warning",
      score: healthData ? 15 : 0,
      blocker: !healthData,
      source: "Data Health",
    }),
    makeCheck({
      id: "data-health",
      title: "Data Health membaca sumber hidup",
      detail: `${health.modulesChecked} modul dicek, ${health.realRows} baris nyata terbaca.`,
      status: health.modulesChecked > 0 ? "AMAN" : "PERLU CEK",
      tone: health.modulesChecked > 0 ? "success" : "warning",
      score: health.modulesChecked > 0 ? 15 : 0,
      blocker: health.modulesChecked <= 0,
      source: "Data Health",
    }),
    makeCheck({
      id: "danger",
      title: "Tidak ada masalah bahaya",
      detail: `${health.danger} masalah bahaya terdeteksi.`,
      status: health.danger === 0 ? "AMAN" : "BELUM SIAP",
      tone: health.danger === 0 ? "success" : "danger",
      score: health.danger === 0 ? 15 : 0,
      blocker: health.danger > 0,
      source: "Data Health",
    }),
    makeCheck({
      id: "action-hub",
      title: "Action Hub tidak punya blocker aktif",
      detail: `${actionHub.critical} kartu cepat, ${actionHub.warning} kartu perhatian, total ${actionHub.totalCards} kartu.`,
      status: actionHub.critical === 0 ? "AMAN" : "BELUM SIAP",
      tone: actionHub.critical === 0 ? "success" : "danger",
      score: actionHub.critical === 0 ? 15 : 0,
      blocker: actionHub.critical > 0,
      source: "Action Hub",
    }),
    makeCheck({
      id: "ghost-row",
      title: "Ghost row tidak dihitung sebagai transaksi hidup",
      detail: `${health.ghost} baris ghost/formatting terdeteksi. Boleh dirapikan dari sumber data, tetapi tidak dihitung sebagai transaksi hidup.`,
      status: health.ghost <= 25 ? "AMAN" : "PERLU RAPUH",
      tone: health.ghost <= 25 ? "success" : "warning",
      score: health.ghost <= 25 ? 10 : 5,
      blocker: false,
      source: "Data Health",
    }),
    makeCheck({
      id: "warning",
      title: "Data perlu cek masih dalam batas UAT",
      detail: `${health.warning} catatan perlu cek. Rapikan bertahap dari modul sumber.`,
      status: health.warning <= 20 ? "AMAN UAT" : "PERLU DIRAPIKAN",
      tone: health.warning <= 20 ? "success" : "warning",
      score: health.warning <= 20 ? 10 : 5,
      blocker: false,
      source: "Data Health",
    }),
    makeCheck({
      id: "focus-detail",
      title: "Focus ID & detail arsip aktif",
      detail: "Cross Module Focus dan Auto Open Detail sudah menjadi jalur cek ID transaksi.",
      status: "AMAN",
      tone: "success",
      score: 10,
      blocker: false,
      source: "Arsip Digital",
    }),
    makeCheck({
      id: "manual-uat",
      title: "UAT operasional masih perlu simulasi owner",
      detail: "Simulasi harian tetap perlu dijalankan sebelum dipakai full staff.",
      status: "PERLU UAT",
      tone: "warning",
      score: 5,
      blocker: false,
      source: "Manual Owner",
    }),
  ];

  const score = Math.max(
    0,
    Math.min(
      100,
      checks.reduce((sum, row) => sum + safeNumber(row.score), 0)
    )
  );

  const blockers = checks.filter((row) => row.blocker);

  let status = GO_LIVE_STATUS.NOT_READY;
  let statusLabel = "Belum Siap";
  let tone = "danger";

  if (blockers.length === 0 && score >= 85) {
    status = GO_LIVE_STATUS.STAGED_READY;
    statusLabel = "Siap Go-Live Bertahap";
    tone = "success";
  } else if (blockers.length === 0 && score >= 70) {
    status = GO_LIVE_STATUS.UAT_READY;
    statusLabel = "Siap UAT";
    tone = "warning";
  }

  return {
    score,
    status,
    statusLabel,
    tone,
    blockers,
    checks,
    health,
    actionHub,
  };
}

export function buildCopySummary(report) {
  if (!report) return "";

  return [
    "GO-LIVE CHECK ERP DIMSUM ADITYA",
    `Score: ${report.score}/100`,
    `Status: ${report.statusLabel}`,
    "",
    "Ringkasan Data Health:",
    `- Baris nyata: ${report.health?.realRows ?? 0}`,
    `- Modul dicek: ${report.health?.modulesChecked ?? 0}`,
    `- Masalah bahaya: ${report.health?.danger ?? 0}`,
    `- Perlu cek: ${report.health?.warning ?? 0}`,
    `- Ghost row: ${report.health?.ghost ?? 0}`,
    "",
    "Action Hub:",
    `- Critical: ${report.actionHub?.critical ?? 0}`,
    `- Warning: ${report.actionHub?.warning ?? 0}`,
    `- Total kartu: ${report.actionHub?.totalCards ?? 0}`,
  ].join("\n");
}

/**
 * Kompatibilitas kalau ada file lama masih memanggil renderStatus().
 * Return text saja; JSX tetap di file .jsx.
 */
export function renderStatus(row) {
  return row?.status_label || row?.status || "-";
}

export default {
  GO_LIVE_STATUS,
  safeNumber,
  pickHealthSummary,
  pickActionHubSummary,
  makeCheck,
  getGoLiveReadiness,
  buildCopySummary,
  renderStatus,
};
