import { useEffect, useMemo, useState } from "react";
import {
  buildCopySummary,
  getGoLiveReadiness,
} from "../../lib/golive/goLiveChecklistRules";

const BRAND = {
  red: "#b42318",
  redSoft: "#fef2f2",
  goldSoft: "#fffbeb",
  greenSoft: "#f0fdf4",
  blueSoft: "#eff6ff",
  ink: "#111827",
  muted: "#64748b",
  line: "#e5e7eb",
};

function getSessionToken(session) {
  return (
    session?.sessionToken ||
    session?.session_token ||
    localStorage.getItem("sessionToken") ||
    localStorage.getItem("da_session_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function normalizeLocationScopePayload(payload = {}) {
  const next = { ...(payload || {}) };

  for (const key of [
    "location_id",
    "locationId",
    "workspace_location_id",
    "branch_id",
  ]) {
    const value = String(next[key] ?? "").trim();

    // "ALL" is only a frontend filter label.
    // Sending "ALL" to PHP/MySQL makes LocationScope search for a fake location.
    if (!value || value.toUpperCase() === "ALL") {
      delete next[key];
    }
  }

  return next;
}

async function callBackend(action, payload = {}, session) {
  const body = {
    action,
    sessionToken: getSessionToken(session),
    payload: normalizeLocationScopePayload(payload),
  };

  const response = await fetch("/api/erp-v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error("PHP/MySQL API belum membalas JSON valid.");
  }

  if (!response.ok || json.success === false || json.ok === false) {
    throw new Error(json.message || json.error || "Request gagal.");
  }

  return json.data || json.result || json;
}


function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const cleaned = String(value)
    .replace(/Rp/gi, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstArray(data, keys = []) {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function parseChecklist(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}

async function safeCall(action, payload, session) {
  try {
    return {
      ok: true,
      action,
      data: await callBackend(action, payload, session),
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      action,
      data: {},
      error: error?.message || String(error),
    };
  }
}

async function buildFinalGoLiveInputs(period, session) {
  const requests = [
    ["frontendCutoverHealth", {}],
    ["getFrontendCutoverWalletBootstrap", period],
    ["getFrontendCutoverFinishedStockBootstrap", period],
    ["getFrontendCutoverMoneyInBootstrap", period],
    ["getSupplierDebtBootstrap", period],
    ["getOwnerControlBootstrap", period],
    ["getFrontendCutoverEnvelopeBootstrap", period],
    ["getLegacyChickenPurchaseBootstrap", period],
    ["getLegacyProductionBootstrap", period],
    ["getLegacyOrderBootstrap", period],
    ["searchArchive", { q: "", limit: 100, offset: 0 }],
    ["getReconciliationBootstrap", {}],
  ];

  const responses = await Promise.all(
    requests.map(([action, payload]) =>
      safeCall(action, payload, session)
    )
  );

  const byAction = Object.fromEntries(
    responses.map((item) => [item.action, item])
  );

  const bridge = byAction.frontendCutoverHealth?.data || {};
  const wallet = byAction.getFrontendCutoverWalletBootstrap?.data || {};
  const stock = byAction.getFrontendCutoverFinishedStockBootstrap?.data || {};
  const money = byAction.getFrontendCutoverMoneyInBootstrap?.data || {};
  const supplier = byAction.getSupplierDebtBootstrap?.data || {};
  const owner = byAction.getOwnerControlBootstrap?.data || {};
  const envelope = byAction.getFrontendCutoverEnvelopeBootstrap?.data || {};
  const drop = byAction.getLegacyChickenPurchaseBootstrap?.data || {};
  const production = byAction.getLegacyProductionBootstrap?.data || {};
  const order = byAction.getLegacyOrderBootstrap?.data || {};
  const archive = byAction.searchArchive?.data || {};
  const reconciliation = byAction.getReconciliationBootstrap?.data || {};

  const errors = responses.filter((row) => !row.ok);

  const supplierOutstanding = safeNumber(
    supplier?.summary?.grand_outstanding ??
      supplier?.grand_outstanding ??
      0
  );

  const ownerSupplierOutstanding = safeNumber(
    owner?.supplier_position?.total_outstanding ??
      owner?.supplier_position?.grand_outstanding ??
      owner?.supplier_position?.outstanding ??
      0
  );

  const supplierMismatch =
    supplierOutstanding !== ownerSupplierOutstanding;

  const walletMutations = firstArray(wallet, [
    "wallet_mutations",
    "mutations",
  ]);
  const walletMissingSource = walletMutations.filter((row) => {
    const sourceId = String(
      row?.source_id ?? row?.sourceId ?? ""
    ).trim();
    return !sourceId && safeNumber(row?.amount) !== 0;
  }).length;

  const plan = reconciliation?.latest_cutover_plan || null;
  const checklist = parseChecklist(plan?.checklist_json);

  const cutoverApproved =
    String(plan?.status || "").toUpperCase() ===
      "FRONTEND_SWITCH_APPROVED" &&
    checklist.full_uat_passed === true &&
    checklist.frontend_switch_approved === true;

  const bridgeHealthy =
    bridge.frontend_cutover_bridge_loaded === true &&
    bridge.php_mysql_primary === true &&
    bridge.split_brain_core_writes_blocked === true;

  const archiveRows = firstArray(archive, [
    "items",
    "results",
    "recent_records",
    "rows",
  ]);

  const realRows = [
    firstArray(drop, ["chicken_drops", "purchases", "drops", "rows"]).length,
    firstArray(production, ["production_batches", "batches"]).length,
    firstArray(stock, ["finished_stock", "finished_goods_stock", "stock"]).length,
    firstArray(order, ["orders", "rows"]).length,
    firstArray(money, ["payments"]).length,
    firstArray(money, ["receivables"]).length,
    walletMutations.length,
    firstArray(supplier, ["payables"]).length ||
      firstArray(supplier, ["current_notes"]).length +
        firstArray(supplier, ["old_debts"]).length,
    firstArray(envelope, ["allocations", "recent_allocations"]).length,
    archiveRows.length,
  ].reduce((sum, value) => sum + safeNumber(value), 0);

  const danger =
    errors.length +
    (bridgeHealthy ? 0 : 1) +
    (supplierMismatch ? 1 : 0);

  const warning =
    walletMissingSource +
    (cutoverApproved ? 0 : 1);

  const healthData = {
    summary: {
      error_count: danger,
      warning_count: warning,
      ghost_rows: 0,
      real_rows: realRows,
      modules_checked: 11,
      source_of_truth: "PHP + MySQL",
    },
    meta: {
      bridgeHealthy,
      supplierOutstanding,
      ownerSupplierOutstanding,
      supplierMismatch,
      walletMissingSource,
      cutoverApproved,
      cutoverPlanStatus: plan?.status || "",
      fullUatPassed: checklist.full_uat_passed === true,
      frontendSwitchApproved:
        checklist.frontend_switch_approved === true,
    },
  };

  const actionHubData = {
    summary: {
      CRITICAL: danger,
      WARNING: warning,
      INFO: 0,
      total_cards: danger + warning,
    },
    cards: [],
  };

  return { healthData, actionHubData };
}

function buildFinalReadiness({ healthData, actionHubData }) {
  const base = getGoLiveReadiness({
    healthData,
    actionHubData,
  });

  const meta = healthData?.meta || {};
  const checks = base.checks.map((row) => {
    if (row.id === "backend-json") {
      return {
        ...row,
        title: "PHP/MySQL + Vercel Proxy membalas JSON",
        detail: meta.bridgeHealthy
          ? "Frontend Cutover Bridge aktif, PHP/MySQL primary, dan split-brain core write diblokir."
          : "Frontend Cutover Bridge belum lolos health gate.",
        status: meta.bridgeHealthy ? "AMAN" : "BELUM SIAP",
        tone: meta.bridgeHealthy ? "success" : "danger",
        score: meta.bridgeHealthy ? 15 : 0,
        blocker: !meta.bridgeHealthy,
        source: "PHP/MySQL api-v2",
      };
    }

    if (row.id === "manual-uat") {
      const passed =
        meta.fullUatPassed === true &&
        meta.frontendSwitchApproved === true &&
        meta.cutoverApproved === true;

      return {
        ...row,
        title: "Full UAT + Frontend Switch Approval",
        detail: passed
          ? "Full UAT backend sudah dikunci PASSED dan Owner sudah APPROVE frontend switch."
          : "Full UAT/approval switch belum lengkap.",
        status: passed ? "AMAN" : "BELUM SIAP",
        tone: passed ? "success" : "danger",
        score: passed ? 15 : 0,
        blocker: !passed,
        source: "Reconciliation / Cutover Plan",
      };
    }

    if (row.id === "ghost-row") {
      return {
        ...row,
        title: "Tidak memakai ghost row Google Sheets",
        detail:
          "Data Health final membaca PHP/MySQL; ghost/formatting row legacy tidak menjadi sumber keputusan go-live.",
        status: "AMAN",
        tone: "success",
        score: 10,
        blocker: false,
        source: "PHP/MySQL",
      };
    }

    if (row.id === "warning") {
      return {
        ...row,
        title: "Tidak ada warning core yang memblokir cutover",
        detail: `${base.health.warning} warning terdeteksi dari core PHP/MySQL.`,
        status:
          base.health.warning === 0 ? "AMAN" : "PERLU DIRAPIKAN",
        tone:
          base.health.warning === 0 ? "success" : "warning",
        score:
          base.health.warning === 0 ? 10 : 5,
        blocker: false,
        source: "PHP/MySQL Data Health",
      };
    }

    return row;
  });

  const blockers = checks.filter((row) => row.blocker);
  const score = Math.max(
    0,
    Math.min(
      100,
      checks.reduce(
        (sum, row) => sum + safeNumber(row.score),
        0
      )
    )
  );

  return {
    ...base,
    checks,
    blockers,
    score,
    status:
      blockers.length === 0 && score >= 95
        ? "SIAP_GO_LIVE"
        : base.status,
    statusLabel:
      blockers.length === 0 && score >= 95
        ? "Siap Go-Live"
        : base.statusLabel,
    tone:
      blockers.length === 0 && score >= 95
        ? "success"
        : base.tone,
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthISO() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

export default function GoLiveChecklistPage({ session }) {
  const [healthData, setHealthData] = useState(null);
  const [actionHubData, setActionHubData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  const period = useMemo(
    () => ({
      date_start: firstDayOfMonthISO(),
      date_end: todayISO(),
      location_id: "ALL",
      limit: 100,
    }),
    []
  );

  async function load() {
    setLoading(true);
    setErrorText("");

    try {
      const {
        healthData: health,
        actionHubData: hub,
      } = await buildFinalGoLiveInputs(period, session);

      setHealthData(health);
      setActionHubData(hub);
      setLastRefresh(new Date().toLocaleString("id-ID"));
    } catch (error) {
      setErrorText(
        error?.message ||
          "Gagal membaca Go-Live Check PHP/MySQL."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const report = useMemo(
    () => buildFinalReadiness({ healthData, actionHubData }),
    [healthData, actionHubData]
  );

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(buildCopySummary(report));
      alert("Ringkasan Go-Live Check sudah disalin.");
    } catch (error) {
      alert("Browser belum mengizinkan copy otomatis.");
    }
  }

  function openPage(page) {
    window.location.href = `/?page=${page}`;
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <div style={styles.kicker}>Pusat Kendali</div>
          <h1 style={styles.title}>Go-Live Check</h1>
          <p style={styles.desc}>
            Pengecekan kesiapan sistem sebelum dipakai operasional. Halaman ini
            read-only dan membaca health gate PHP/MySQL, arsip, reconciliation,
            Full UAT, serta approval frontend switch.
          </p>
        </div>

        <Badge tone={report.tone}>{report.statusLabel}</Badge>
      </section>

      {errorText ? <div style={styles.error}>{errorText}</div> : null}

      <section style={styles.scoreCard}>
        <div>
          <div style={styles.scoreLabel}>Score Kesiapan</div>
          <div style={styles.score}>
            {report.score}
            <span>/100</span>
          </div>
          <p style={styles.scoreDesc}>
            Status ini adalah gate kesiapan final berbasis PHP/MySQL. Deployment production tetap dilakukan terpisah setelah Preview benar-benar bersih.
          </p>
        </div>

        <div style={styles.actionBox}>
          <button style={styles.primaryBtn} onClick={load} disabled={loading}>
            {loading ? "Membaca..." : "Refresh Check"}
          </button>

          <button
            style={styles.secondaryBtn}
            onClick={() => openPage("system-health")}
          >
            Buka Data Health
          </button>

          <button
            style={styles.secondaryBtn}
            onClick={() => openPage("arsip-digital")}
          >
            Buka Arsip Digital
          </button>

          <button style={styles.ghostBtn} onClick={copySummary}>
            Copy Ringkasan
          </button>

          <div style={styles.lastRefresh}>
            Terakhir refresh: {lastRefresh || "-"}
          </div>
        </div>
      </section>

      <section style={styles.grid}>
        <MiniCard
          label="Baris Nyata"
          value={report.health.realRows}
          note="Data hidup terbaca"
        />

        <MiniCard
          label="Modul Dicek"
          value={report.health.modulesChecked}
          note="Tab/sumber diperiksa"
        />

        <MiniCard
          label="Masalah Bahaya"
          value={report.health.danger}
          note="Harus nol sebelum live"
          danger={report.health.danger > 0}
        />

        <MiniCard
          label="Action Hub"
          value={report.actionHub.totalCards}
          note="Kartu tindak lanjut aktif"
          danger={report.actionHub.critical > 0}
        />
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHead}>
          <div>
            <h2 style={styles.panelTitle}>Checklist Sistem</h2>
            <p style={styles.panelDesc}>
              Perbaikan tetap dilakukan dari modul sumber, bukan dari halaman
              ini.
            </p>
          </div>

          <Badge tone={report.blockers.length ? "danger" : "success"}>
            {report.blockers.length
              ? `${report.blockers.length} blocker`
              : "Tidak ada blocker"}
          </Badge>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>CEK</th>
                <th style={styles.th}>DETAIL</th>
                <th style={styles.th}>SUMBER</th>
                <th style={styles.th}>STATUS</th>
              </tr>
            </thead>

            <tbody>
              {report.checks.map((row) => (
                <tr key={row.id}>
                  <td style={styles.td}>
                    <b>{row.title}</b>
                  </td>
                  <td style={styles.td}>{row.detail}</td>
                  <td style={styles.td}>{row.source}</td>
                  <td style={styles.td}>
                    <Badge tone={row.tone}>{row.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.noteBox}>
        <b>Catatan cutover:</b> halaman ini read-only. Nilai readiness final berasal dari PHP/MySQL dan tidak memakai Data Health Google Sheets legacy sebagai source of truth.
      </section>
    </main>
  );
}

function MiniCard({ label, value, note, danger }) {
  return (
    <div
      style={{
        ...styles.miniCard,
        borderColor: danger ? "#fecaca" : BRAND.line,
        background: danger ? BRAND.redSoft : "#fff",
      }}
    >
      <div style={styles.miniLabel}>{label}</div>
      <div style={styles.miniValue}>{value ?? 0}</div>
      <div style={styles.miniNote}>{note}</div>
    </div>
  );
}

function Badge({ children, tone = "default" }) {
  const meta =
    {
      success: {
        bg: BRAND.greenSoft,
        color: "#15803d",
        border: "#bbf7d0",
      },
      danger: {
        bg: BRAND.redSoft,
        color: "#991b1b",
        border: "#fecaca",
      },
      warning: {
        bg: BRAND.goldSoft,
        color: "#92400e",
        border: "#fde68a",
      },
      info: {
        bg: BRAND.blueSoft,
        color: "#1d4ed8",
        border: "#bfdbfe",
      },
      default: {
        bg: "#f8fafc",
        color: BRAND.ink,
        border: BRAND.line,
      },
    }[tone] || {
      bg: "#f8fafc",
      color: BRAND.ink,
      border: BRAND.line,
    };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 900,
        background: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

const styles = {
  page: {
    padding: "28px 32px 48px",
    color: BRAND.ink,
  },
  hero: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20,
  },
  kicker: {
    color: BRAND.muted,
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 4,
  },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.1,
    fontWeight: 950,
  },
  desc: {
    maxWidth: 820,
    margin: "10px 0 0",
    color: BRAND.muted,
    lineHeight: 1.6,
  },
  error: {
    background: BRAND.redSoft,
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    fontWeight: 700,
  },
  scoreCard: {
    display: "grid",
    gridTemplateColumns: "1fr 290px",
    gap: 18,
    background: "linear-gradient(135deg, #fff 0%, #fff7ed 100%)",
    border: "1px solid #fed7aa",
    borderRadius: 24,
    padding: 22,
    boxShadow: "0 18px 45px rgba(124,45,18,0.08)",
    marginBottom: 16,
  },
  scoreLabel: {
    color: BRAND.muted,
    fontWeight: 900,
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 0.7,
  },
  score: {
    fontSize: 68,
    fontWeight: 950,
    color: BRAND.red,
    lineHeight: 1,
    marginTop: 8,
  },
  scoreDesc: {
    color: BRAND.muted,
    lineHeight: 1.55,
    maxWidth: 720,
    margin: "12px 0 0",
  },
  actionBox: {
    display: "grid",
    gap: 10,
    alignContent: "start",
  },
  primaryBtn: {
    border: "none",
    borderRadius: 14,
    padding: "12px 14px",
    background: BRAND.red,
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "1px solid #fed7aa",
    borderRadius: 14,
    padding: "12px 14px",
    background: "#fff",
    color: BRAND.ink,
    fontWeight: 900,
    cursor: "pointer",
  },
  ghostBtn: {
    border: `1px solid ${BRAND.line}`,
    borderRadius: 14,
    padding: "12px 14px",
    background: "#f8fafc",
    color: BRAND.ink,
    fontWeight: 900,
    cursor: "pointer",
  },
  lastRefresh: {
    color: BRAND.muted,
    fontSize: 12,
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  miniCard: {
    border: "1px solid",
    borderRadius: 18,
    padding: 16,
  },
  miniLabel: {
    color: BRAND.muted,
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  miniValue: {
    fontSize: 30,
    fontWeight: 950,
    marginTop: 8,
  },
  miniNote: {
    color: BRAND.muted,
    fontSize: 13,
    marginTop: 4,
  },
  panel: {
    background: "#fff",
    border: `1px solid ${BRAND.line}`,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  panelHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  panelTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 950,
  },
  panelDesc: {
    margin: "6px 0 0",
    color: BRAND.muted,
  },
  tableWrap: {
    overflowX: "auto",
    border: `1px solid ${BRAND.line}`,
    borderRadius: 16,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "12px 14px",
    background: "#f8fafc",
    color: BRAND.ink,
    borderBottom: `1px solid ${BRAND.line}`,
    fontSize: 12,
  },
  td: {
    padding: "12px 14px",
    borderBottom: `1px solid ${BRAND.line}`,
    verticalAlign: "top",
  },
  noteBox: {
    background: "#f8fafc",
    border: `1px solid ${BRAND.line}`,
    borderRadius: 18,
    padding: 16,
    color: BRAND.muted,
    lineHeight: 1.55,
  },
};
