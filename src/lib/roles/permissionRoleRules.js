/**
 * frontend/src/lib/roles/permissionRoleRules.js
 * ERP DIMSUM ADITYA — Part 5V
 *
 * Pure JavaScript rules untuk cek permission/role final.
 * Tidak ada JSX di file ini.
 */

export const ROLE_SCOPES = [
  {
    key: "OWNER",
    label: "Owner / Tangerang HO",
    role_id: "OWNER",
    location_code: "TGR",
    expected: "Full owner center, approval, uang, payroll, master data, dan audit.",
  },
  {
    key: "TANGERANG",
    label: "Admin Tangerang / HO",
    role_id: "ADMIN_TANGERANG",
    location_code: "TGR",
    expected: "Operasional pusat sesuai izin HO. Sensitive owner bisa diatur nanti dari matrix detail.",
  },
  {
    key: "PEMALANG",
    label: "Produksi Pemalang",
    role_id: "ADMIN_PEMALANG",
    location_code: "PML",
    expected: "Produksi, stok, order/report cabang, request DO. Tidak lihat owner cash/payroll nominal.",
  },
  {
    key: "CIBINONG",
    label: "Resto Cibinong",
    role_id: "ADMIN_CIBINONG",
    location_code: "CBN",
    expected: "Kasir/order, laporan cabang, request DO. Tidak lihat produksi pusat, owner cash/payroll nominal.",
  },
  {
    key: "STAFF",
    label: "Staff Umum",
    role_id: "STAFF",
    location_code: "STAFF",
    expected: "Default paling sempit. Modul harus dibuka hanya kalau nanti diberi izin spesifik.",
  },
];

export const SENSITIVE_PAGE_KEYS = [
  "owner-control",
  "closing-owner",
  "system-health",
  "go-live-check",
  "permission-role-check",
  "uang-masuk",
  "kas-dompet",
  "kas-keluar",
  "hutang-nana",
  "kewajiban-owner",
  "empat-amplop",
  "hrd-payroll",
  "master-produk",
  "master-customer",
  "master-supplier",
  "master-lokasi",
];

export const OWNER_ONLY_PAGE_KEYS = [
  "owner-control",
  "system-health",
  "go-live-check",
  "permission-role-check",
  "closing-owner",
  "empat-amplop",
  "kewajiban-owner",
  "hrd-payroll",
];

export const BRANCH_FORBIDDEN_PAGE_KEYS = [
  "owner-control",
  "closing-owner",
  "system-health",
  "go-live-check",
  "permission-role-check",
  "uang-masuk",
  "kas-dompet",
  "kas-keluar",
  "hutang-nana",
  "kewajiban-owner",
  "empat-amplop",
  "hrd-payroll",
  "master-produk",
  "master-customer",
  "master-supplier",
  "master-lokasi",
];

export function makeMockSession(scopeKey) {
  const scope = ROLE_SCOPES.find((item) => item.key === scopeKey) || ROLE_SCOPES[0];

  return {
    sessionToken: `SIM-${scope.key}`,
    user: {
      user_id: `SIM-${scope.key}`,
      name: scope.label,
      role_id: scope.role_id,
      role_name: scope.role_id,
      location_code: scope.location_code,
      location_name: scope.label,
    },
  };
}

export function flattenMenuGroups(groups) {
  return (groups || []).flatMap((group) =>
    (group.items || []).map((item) => ({
      ...item,
      groupKey: group.key,
      groupTitle: group.title,
      visibleFor: group.visibleFor || [],
    }))
  );
}

export function getAllowedKeysForScope(menuGroups, getAllowedMenuGroups, scopeKey) {
  const session = makeMockSession(scopeKey);
  const groups = getAllowedMenuGroups(menuGroups, session);
  return flattenMenuGroups(groups).map((item) => item.key);
}

export function getPermissionMatrix(menuGroups, getAllowedMenuGroups) {
  return ROLE_SCOPES.map((scope) => {
    const allowedKeys = getAllowedKeysForScope(menuGroups, getAllowedMenuGroups, scope.key);
    const sensitiveKeys = allowedKeys.filter((key) => SENSITIVE_PAGE_KEYS.includes(key));
    const branchForbiddenKeys = ["PEMALANG", "CIBINONG", "STAFF"].includes(scope.key)
      ? allowedKeys.filter((key) => BRANCH_FORBIDDEN_PAGE_KEYS.includes(key))
      : [];

    return {
      ...scope,
      allowedKeys,
      allowedCount: allowedKeys.length,
      sensitiveKeys,
      sensitiveCount: sensitiveKeys.length,
      violationKeys: branchForbiddenKeys,
      violationCount: branchForbiddenKeys.length,
      status: branchForbiddenKeys.length ? "PERLU CEK" : "AMAN",
      tone: branchForbiddenKeys.length ? "danger" : "success",
    };
  });
}

export function getCurrentAccess(session, menuGroups, getAllowedMenuGroups, getUserScope) {
  const scope = getUserScope(session);
  const groups = getAllowedMenuGroups(menuGroups, session);
  const pages = flattenMenuGroups(groups);
  const sensitivePages = pages.filter((item) => SENSITIVE_PAGE_KEYS.includes(item.key));

  return {
    scope,
    groups,
    pages,
    pageCount: pages.length,
    groupCount: groups.length,
    sensitivePages,
    sensitiveCount: sensitivePages.length,
  };
}

export function buildPermissionChecks({ currentAccess, matrix }) {
  const branchViolations = (matrix || []).filter((row) => row.violationCount > 0);
  const ownerRow = (matrix || []).find((row) => row.key === "OWNER");
  const pemalangRow = (matrix || []).find((row) => row.key === "PEMALANG");
  const cibinongRow = (matrix || []).find((row) => row.key === "CIBINONG");

  return [
    {
      id: "owner-access",
      title: "Owner/HO punya pusat kendali lengkap",
      detail: `Owner terbaca ${ownerRow?.allowedCount || 0} menu. Harus punya akses kontrol, data health, arsip, closing, uang, dan master data.`,
      status: ownerRow?.allowedCount ? "AMAN" : "PERLU CEK",
      tone: ownerRow?.allowedCount ? "success" : "warning",
      source: "Menu Permission",
    },
    {
      id: "branch-sensitive-lock",
      title: "Cabang tidak melihat menu sensitif owner",
      detail: branchViolations.length
        ? `${branchViolations.length} scope cabang/staff masih melihat menu sensitif.`
        : "Pemalang, Cibinong, dan Staff tidak melihat menu uang owner, payroll nominal, data health, master data pusat, atau 4 Amplop.",
      status: branchViolations.length ? "PERLU CEK" : "AMAN",
      tone: branchViolations.length ? "danger" : "success",
      source: "Menu Permission",
    },
    {
      id: "pemalang-workspace",
      title: "Pemalang masuk workspace produksi/cabang",
      detail: `Pemalang terbaca ${pemalangRow?.allowedCount || 0} menu. Fokus produksi, stok, penjualan, laporan, dan request DO.`,
      status: pemalangRow?.allowedCount ? "AMAN" : "PERLU CEK",
      tone: pemalangRow?.allowedCount ? "success" : "warning",
      source: "Role Simulation",
    },
    {
      id: "cibinong-workspace",
      title: "Cibinong masuk workspace outlet/resto",
      detail: `Cibinong terbaca ${cibinongRow?.allowedCount || 0} menu. Fokus kasir/order, laporan, setoran, dan request DO.`,
      status: cibinongRow?.allowedCount ? "AMAN" : "PERLU CEK",
      tone: cibinongRow?.allowedCount ? "success" : "warning",
      source: "Role Simulation",
    },
    {
      id: "current-session",
      title: "Session login saat ini terbaca",
      detail: `Scope aktif: ${currentAccess?.scope || "-"}. Menu terlihat: ${currentAccess?.pageCount || 0}.`,
      status: currentAccess?.scope ? "AMAN" : "PERLU CEK",
      tone: currentAccess?.scope ? "success" : "warning",
      source: "Session Browser",
    },
  ];
}

export function getPermissionReadiness({ session, menuGroups, getAllowedMenuGroups, getUserScope }) {
  const matrix = getPermissionMatrix(menuGroups, getAllowedMenuGroups);
  const currentAccess = getCurrentAccess(session, menuGroups, getAllowedMenuGroups, getUserScope);
  const checks = buildPermissionChecks({ currentAccess, matrix });
  const blockers = checks.filter((row) => row.tone === "danger");
  const warnings = checks.filter((row) => row.tone === "warning");

  const score = Math.max(
    0,
    Math.min(
      100,
      100 - blockers.length * 25 - warnings.length * 10
    )
  );

  let status = "BELUM SIAP";
  let tone = "danger";

  if (!blockers.length && score >= 90) {
    status = "AMAN UNTUK UAT";
    tone = "success";
  } else if (!blockers.length) {
    status = "PERLU CEK RINGAN";
    tone = "warning";
  }

  return {
    score,
    status,
    tone,
    blockers,
    warnings,
    checks,
    matrix,
    currentAccess,
  };
}

export function buildPermissionCopySummary(report) {
  if (!report) return "";

  const lines = [
    "PERMISSION & ROLE FINAL CHECK — ERP DIMSUM ADITYA",
    `Score: ${report.score}/100`,
    `Status: ${report.status}`,
    `Scope aktif: ${report.currentAccess?.scope || "-"}`,
    `Menu aktif terlihat: ${report.currentAccess?.pageCount || 0}`,
    "",
    "Matrix Role:",
  ];

  (report.matrix || []).forEach((row) => {
    lines.push(`- ${row.label}: ${row.allowedCount} menu, status ${row.status}`);
    if (row.violationKeys?.length) {
      lines.push(`  Perlu cek: ${row.violationKeys.join(", ")}`);
    }
  });

  return lines.join("\n");
}

export default {
  ROLE_SCOPES,
  SENSITIVE_PAGE_KEYS,
  OWNER_ONLY_PAGE_KEYS,
  BRANCH_FORBIDDEN_PAGE_KEYS,
  makeMockSession,
  flattenMenuGroups,
  getAllowedKeysForScope,
  getPermissionMatrix,
  getCurrentAccess,
  buildPermissionChecks,
  getPermissionReadiness,
  buildPermissionCopySummary,
};
