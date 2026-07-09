import React, { useEffect, useMemo, useState } from "react";
import {
  buildCopySummary,
  buildPrintBackupReport,
  buildSafetyCsv,
  dateStamp,
  downloadTextFile,
  makeExportPayload,
} from "../../lib/golive/printExportBackupRules";

const BRAND = {
  red: "#b42318",
  redSoft: "#fef2f2",
  orange: "#f97316",
  goldSoft: "#fffbeb",
  green: "#16a34a",
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

async function callBackend(action, payload = {}, session) {
  const body = {
    action,
    sessionToken: getSessionToken(session),
    payload,
  };

  const response = await fetch("/api/apps-script", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error("Proxy/API belum membalas JSON valid.");
  }

  if (!response.ok || json.success === false || json.ok === false) {
    throw new Error(json.message || json.error || "Request gagal.");
  }

  return json.data || json.result || json;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthISO() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default function PrintExportBackupSafetyPage({ session }) {
  const [healthData, setHealthData] = useState(null);
  const [actionHubData, setActionHubData] = useState(null);
  const [backupData, setBackupData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  const period = useMemo(
    () => ({
      start_date: firstDayOfMonthISO(),
      end_date: todayISO(),
      location: "ALL",
      location_id: "ALL",
      limit: 100,
    }),
    []
  );

  async function load() {
    setLoading(true);
    setErrorText("");

    try {
      const [health, hub, backup] = await Promise.all([
        callBackend("getLegacySystemHealthBootstrap", period, session),
        callBackend("getLegacySystemHealthActionHub", { limit: 100 }, session),
        callBackend("getLegacyBackupExportBootstrap", period, session).catch(() => null),
      ]);

      setHealthData(health);
      setActionHubData(hub);
      setBackupData(backup);
      setLastRefresh(new Date().toLocaleString("id-ID"));
    } catch (error) {
      setErrorText(error.message || "Gagal membaca Print / Export / Backup Safety.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const report = useMemo(
    () => buildPrintBackupReport({ healthData, actionHubData, backupData, session }),
    [healthData, actionHubData, backupData, session]
  );

  function printReport() {
    window.print();
  }

  function exportJson() {
    const payload = makeExportPayload(report);
    downloadTextFile(
      `ERP_DIMSUM_ADITYA_BACKUP_SAFETY_${dateStamp()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8"
    );
  }

  function exportCsv() {
    downloadTextFile(
      `ERP_DIMSUM_ADITYA_BACKUP_SAFETY_${dateStamp()}.csv`,
      buildSafetyCsv(report),
      "text/csv;charset=utf-8"
    );
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(buildCopySummary(report));
      alert("Ringkasan safety sudah disalin.");
    } catch (error) {
      alert("Browser belum mengizinkan copy otomatis.");
    }
  }

  function openPage(page) {
    window.location.href = `/?page=${page}`;
  }

  return (
    <main style={styles.page}>
      <style>{printStyles}</style>

      <section style={styles.hero} className="no-print">
        <div>
          <div style={styles.kicker}>Pusat Kendali</div>
          <h1 style={styles.title}>Print / Export / Backup Safety</h1>
          <p style={styles.desc}>
            Pengaman sebelum go-live bertahap: cetak laporan safety, export ringkasan JSON/CSV,
            dan cek status backup tanpa mengubah transaksi uang, stok, payroll, atau closing.
          </p>
        </div>

        <Badge tone={report.tone}>{report.statusLabel}</Badge>
      </section>

      {errorText ? <div style={styles.error}>{errorText}</div> : null}

      <section style={styles.scoreCard}>
        <div>
          <div style={styles.scoreLabel}>Score Backup Safety</div>
          <div style={styles.score}>
            {report.score}
            <span>/100</span>
          </div>
          <p style={styles.scoreDesc}>
            Ini alat safety. Tombol print/export hanya mengambil ringkasan dari data yang sudah terbaca.
            Backup file utama Google Sheet tetap perlu dicek owner sebelum dipakai full staff.
          </p>
          <div style={styles.printOnlyTitle}>ERP Dimsum Aditya — Print / Export / Backup Safety</div>
        </div>

        <div style={styles.actionBox} className="no-print">
          <button style={styles.primaryBtn} onClick={load} disabled={loading}>
            {loading ? "Membaca..." : "Refresh Safety"}
          </button>
          <button style={styles.secondaryBtn} onClick={printReport}>Print / Save PDF</button>
          <button style={styles.secondaryBtn} onClick={exportJson}>Export JSON</button>
          <button style={styles.secondaryBtn} onClick={exportCsv}>Export CSV</button>
          <button style={styles.ghostBtn} onClick={copySummary}>Copy Ringkasan</button>
          <div style={styles.lastRefresh}>Terakhir refresh: {lastRefresh || "-"}</div>
        </div>
      </section>

      <section style={styles.grid}>
        <MiniCard label="Baris Nyata" value={report.health.realRows} note="Data hidup terbaca" />
        <MiniCard label="Modul Dicek" value={report.health.modulesChecked} note="Sumber dicek" />
        <MiniCard label="Masalah Bahaya" value={report.health.danger} note="Harus nol" danger={report.health.danger > 0} />
        <MiniCard label="Action Hub" value={report.actionHub.totalCards} note="Kartu aktif" danger={report.actionHub.critical > 0} />
        <MiniCard label="Backup / Log" value={report.backup.backupCount} note="Riwayat terbaca" />
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHead}>
          <div>
            <h2 style={styles.panelTitle}>Checklist Safety</h2>
            <p style={styles.panelDesc}>
              Kalau ada blocker, perbaiki dari modul sumber dulu sebelum dipakai staff.
            </p>
          </div>
          <Badge tone={report.blockers.length ? "danger" : "success"}>
            {report.blockers.length ? `${report.blockers.length} blocker` : "Tidak ada blocker"}
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
              {report.rows.map((row) => (
                <tr key={row.id}>
                  <td style={styles.td}><b>{row.title}</b></td>
                  <td style={styles.td}>{row.detail}</td>
                  <td style={styles.td}>{row.source}</td>
                  <td style={styles.td}><Badge tone={row.tone}>{row.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.panel} className="no-print">
        <div style={styles.panelHead}>
          <div>
            <h2 style={styles.panelTitle}>Arah Cepat</h2>
            <p style={styles.panelDesc}>Buka halaman pendukung untuk cek benang merah sebelum export/print final.</p>
          </div>
        </div>

        <div style={styles.quickGrid}>
          <button style={styles.secondaryBtn} onClick={() => openPage("data-health")}>Buka Data Health</button>
          <button style={styles.secondaryBtn} onClick={() => openPage("go-live-check")}>Buka Go-Live Check</button>
          <button style={styles.secondaryBtn} onClick={() => openPage("permission-role-check")}>Buka Permission & Role</button>
          <button style={styles.secondaryBtn} onClick={() => openPage("arsip-digital")}>Buka Arsip Digital</button>
        </div>
      </section>

      <section style={styles.noteBox}>
        <b>Rule aman:</b> halaman ini tidak membuat transaksi baru, tidak memotong dompet,
        tidak mengubah stok, tidak mengubah payroll, dan tidak lock closing. Export JSON/CSV hanya file lokal dari browser.
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
      success: { bg: BRAND.greenSoft, color: "#15803d", border: "#bbf7d0" },
      danger: { bg: BRAND.redSoft, color: "#991b1b", border: "#fecaca" },
      warning: { bg: BRAND.goldSoft, color: "#92400e", border: "#fde68a" },
      info: { bg: BRAND.blueSoft, color: "#1d4ed8", border: "#bfdbfe" },
      default: { bg: "#f8fafc", color: BRAND.ink, border: BRAND.line },
    }[tone] || { bg: "#f8fafc", color: BRAND.ink, border: BRAND.line };

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

const printStyles = `
@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
}
`;

const styles = {
  page: { padding: "28px 32px 48px", color: BRAND.ink },
  hero: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 },
  kicker: { color: BRAND.muted, fontSize: 14, fontWeight: 800, marginBottom: 4 },
  title: { margin: 0, fontSize: 34, lineHeight: 1.1, fontWeight: 950 },
  desc: { maxWidth: 850, margin: "10px 0 0", color: BRAND.muted, lineHeight: 1.6 },
  error: { background: BRAND.redSoft, color: "#991b1b", border: "1px solid #fecaca", borderRadius: 16, padding: 14, marginBottom: 16, fontWeight: 700 },
  scoreCard: { display: "grid", gridTemplateColumns: "1fr 280px", gap: 18, background: "linear-gradient(135deg, #fff 0%, #fff7ed 100%)", border: "1px solid #fed7aa", borderRadius: 24, padding: 22, boxShadow: "0 18px 45px rgba(124,45,18,0.08)", marginBottom: 16 },
  scoreLabel: { color: BRAND.muted, fontWeight: 900, textTransform: "uppercase", fontSize: 12, letterSpacing: 0.7 },
  score: { fontSize: 68, fontWeight: 950, color: BRAND.red, lineHeight: 1, marginTop: 8 },
  scoreDesc: { color: BRAND.muted, lineHeight: 1.55, maxWidth: 720, margin: "12px 0 0" },
  printOnlyTitle: { display: "none" },
  actionBox: { display: "grid", gap: 10, alignContent: "start" },
  primaryBtn: { border: "none", borderRadius: 14, padding: "12px 14px", background: BRAND.red, color: "#fff", fontWeight: 900, cursor: "pointer" },
  secondaryBtn: { border: "1px solid #fed7aa", borderRadius: 14, padding: "12px 14px", background: "#fff", color: BRAND.ink, fontWeight: 900, cursor: "pointer" },
  ghostBtn: { border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: "12px 14px", background: "#f8fafc", color: BRAND.ink, fontWeight: 900, cursor: "pointer" },
  lastRefresh: { color: BRAND.muted, fontSize: 12, textAlign: "center" },
  grid: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12, marginBottom: 16 },
  miniCard: { border: "1px solid", borderRadius: 18, padding: 16 },
  miniLabel: { color: BRAND.muted, fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5 },
  miniValue: { fontSize: 30, fontWeight: 950, marginTop: 8 },
  miniNote: { color: BRAND.muted, fontSize: 13, marginTop: 4 },
  panel: { background: "#fff", border: `1px solid ${BRAND.line}`, borderRadius: 22, padding: 18, marginBottom: 16 },
  panelHead: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 12 },
  panelTitle: { margin: 0, fontSize: 20, fontWeight: 950 },
  panelDesc: { margin: "6px 0 0", color: BRAND.muted },
  tableWrap: { overflowX: "auto", border: `1px solid ${BRAND.line}`, borderRadius: 16 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "12px 14px", background: "#f8fafc", color: BRAND.ink, borderBottom: `1px solid ${BRAND.line}`, fontSize: 12 },
  td: { padding: "12px 14px", borderBottom: `1px solid ${BRAND.line}`, verticalAlign: "top" },
  quickGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 },
  noteBox: { background: "#f8fafc", border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 16, color: BRAND.muted, lineHeight: 1.55 },
};
