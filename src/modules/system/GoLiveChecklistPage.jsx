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
      const [health, hub] = await Promise.all([
        callBackend("getLegacySystemHealthBootstrap", period, session),
        callBackend(
          "getLegacySystemHealthActionHub",
          {
            limit: 100,
          },
          session
        ),
      ]);

      setHealthData(health);
      setActionHubData(hub);
      setLastRefresh(new Date().toLocaleString("id-ID"));
    } catch (error) {
      setErrorText(error.message || "Gagal membaca Go-Live Check.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const report = useMemo(
    () => getGoLiveReadiness({ healthData, actionHubData }),
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
            read-only dan membaca Data Health, Action Hub, arsip, serta status
            kabel utama ERP.
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
            Status ini bukan tombol final go-live. Ini alat bantu owner untuk
            melihat apakah data, kabel, dan benang merah sudah layak masuk UAT
            atau go-live bertahap.
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
        <b>Catatan layout final:</b> halaman ini masih alat audit/kabel/logic.
        Untuk go-live staff, layout final tetap akan dipoles ke arah Merchant
        Clean Layout / Dimsum Merchant OS yang lebih ringan dan operasional.
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
