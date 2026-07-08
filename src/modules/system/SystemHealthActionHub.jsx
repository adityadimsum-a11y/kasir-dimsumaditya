import React, { useEffect, useMemo, useState } from "react";

const BRAND = {
  red: "#b42318",
  orange: "#f97316",
  gold: "#f59e0b",
  ink: "#1f2937",
  muted: "#6b7280",
  bg: "#fff7ed",
  card: "#ffffff",
  line: "#fed7aa",
};

function getSessionToken() {
  return (
    localStorage.getItem("sessionToken") ||
    localStorage.getItem("da_session_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function getApiUrl() {
  return (
    import.meta.env.VITE_APPS_SCRIPT_URL ||
    import.meta.env.VITE_GOOGLE_SCRIPT_URL ||
    import.meta.env.VITE_GAS_URL ||
    import.meta.env.VITE_API_URL ||
    localStorage.getItem("DA_API_URL") ||
    ""
  );
}

async function callBackend(action, payload = {}) {
  const apiUrl = getApiUrl();

  if (!apiUrl) {
    throw new Error(
      "URL Apps Script belum ketemu. Cek env VITE_APPS_SCRIPT_URL / VITE_API_URL."
    );
  }

  const body = {
    action,
    sessionToken: getSessionToken(),
    payload,
  };

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (json.success === false || json.ok === false) {
    throw new Error(json.message || json.error || "Request gagal.");
  }

  return json.data || json.result || json;
}

function formatRupiah(value) {
  const n = Number(value || 0);
  if (!n) return "";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function severityMeta(severity) {
  if (severity === "CRITICAL") {
    return {
      label: "Butuh Dicek Cepat",
      bg: "#fef2f2",
      text: "#991b1b",
      border: "#fecaca",
      dot: "#dc2626",
    };
  }

  if (severity === "WARNING") {
    return {
      label: "Perlu Perhatian",
      bg: "#fffbeb",
      text: "#92400e",
      border: "#fde68a",
      dot: "#f59e0b",
    };
  }

  return {
    label: "Pantauan",
    bg: "#eff6ff",
    text: "#1d4ed8",
    border: "#bfdbfe",
    dot: "#2563eb",
  };
}

export default function SystemHealthActionHub() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const result = await callBackend("getLegacySystemHealthActionHub", {
        limit: 100,
      });

      setData(result);
    } catch (error) {
      setErr(error.message || "Gagal memuat Action Hub.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const cards = data?.cards || [];
  const summary = data?.summary || {};

  const filteredCards = useMemo(() => {
    if (filter === "ALL") return cards;
    return cards.filter((card) => card.severity === filter);
  }, [cards, filter]);

  function openRoute(route) {
    if (!route) return;
    window.location.href = route;
  }

  return (
    <section style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>Action Hub</div>
          <h2 style={styles.title}>Data yang perlu ditindaklanjuti</h2>
          <p style={styles.desc}>
            Ini papan pantau untuk transaksi yang belum selesai atau belum
            nyambung jejaknya. Aman, hanya untuk cek dan loncat ke sumber data.
          </p>
        </div>

        <button style={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? "Memuat..." : "Refresh"}
        </button>
      </div>

      <div style={styles.summaryGrid}>
        <SummaryCard
          label="Butuh Dicek Cepat"
          value={summary.CRITICAL || 0}
          tone="danger"
          onClick={() => setFilter("CRITICAL")}
        />
        <SummaryCard
          label="Perlu Perhatian"
          value={summary.WARNING || 0}
          tone="warning"
          onClick={() => setFilter("WARNING")}
        />
        <SummaryCard
          label="Pantauan"
          value={summary.INFO || 0}
          tone="info"
          onClick={() => setFilter("INFO")}
        />
        <SummaryCard
          label="Total Kartu"
          value={cards.length}
          tone="neutral"
          onClick={() => setFilter("ALL")}
        />
      </div>

      <div style={styles.filterRow}>
        {[
          ["ALL", "Semua"],
          ["CRITICAL", "Butuh Dicek Cepat"],
          ["WARNING", "Perlu Perhatian"],
          ["INFO", "Pantauan"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              ...styles.filterBtn,
              ...(filter === key ? styles.filterBtnActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {err ? (
        <div style={styles.errorBox}>
          <b>Action Hub belum bisa dibuka.</b>
          <br />
          {err}
        </div>
      ) : null}

      {loading ? (
        <div style={styles.emptyBox}>Membaca hubungan data...</div>
      ) : null}

      {!loading && !err && filteredCards.length === 0 ? (
        <div style={styles.emptyBox}>
          Aman bro. Tidak ada kartu tindakan untuk filter ini.
        </div>
      ) : null}

      <div style={styles.cardList}>
        {filteredCards.map((card) => (
          <ActionCard
            key={card.id}
            card={card}
            onOpen={() => openRoute(card.route)}
            onArchive={() => openRoute(card.archive_route)}
          />
        ))}
      </div>

      {data?.warnings?.length ? (
        <div style={styles.warningFoot}>
          <b>Catatan pembacaan:</b>
          {data.warnings.slice(0, 5).map((w, index) => (
            <div key={index}>• {w.message}</div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SummaryCard({ label, value, tone, onClick }) {
  const toneStyle = {
    danger: {
      bg: "#fef2f2",
      border: "#fecaca",
      text: "#991b1b",
    },
    warning: {
      bg: "#fffbeb",
      border: "#fde68a",
      text: "#92400e",
    },
    info: {
      bg: "#eff6ff",
      border: "#bfdbfe",
      text: "#1d4ed8",
    },
    neutral: {
      bg: "#ffffff",
      border: "#fed7aa",
      text: BRAND.ink,
    },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.summaryCard,
        background: toneStyle.bg,
        borderColor: toneStyle.border,
      }}
    >
      <div style={{ ...styles.summaryValue, color: toneStyle.text }}>
        {value}
      </div>
      <div style={styles.summaryLabel}>{label}</div>
    </button>
  );
}

function ActionCard({ card, onOpen, onArchive }) {
  const meta = severityMeta(card.severity);

  return (
    <article style={styles.actionCard}>
      <div style={styles.actionTop}>
        <div style={styles.modulePill}>{card.module}</div>
        <div
          style={{
            ...styles.severityPill,
            background: meta.bg,
            color: meta.text,
            borderColor: meta.border,
          }}
        >
          <span
            style={{
              ...styles.dot,
              background: meta.dot,
            }}
          />
          {meta.label}
        </div>
      </div>

      <h3 style={styles.actionTitle}>{card.title}</h3>
      <p style={styles.actionMsg}>{card.message}</p>

      <div style={styles.metaGrid}>
        <div>
          <span style={styles.metaLabel}>ID Sumber</span>
          <b style={styles.metaValue}>{card.source_id || "-"}</b>
        </div>

        <div>
          <span style={styles.metaLabel}>Tanggal</span>
          <b style={styles.metaValue}>{String(card.date || "-")}</b>
        </div>

        <div>
          <span style={styles.metaLabel}>Nominal</span>
          <b style={styles.metaValue}>{formatRupiah(card.amount) || "-"}</b>
        </div>
      </div>

      <div style={styles.safeNote}>{card.safe_note}</div>

      <div style={styles.actionButtons}>
        <button style={styles.primaryBtn} onClick={onOpen}>
          {card.action_label || "Buka Sumber"}
        </button>

        <button style={styles.secondaryBtn} onClick={onArchive}>
          Cari di Arsip
        </button>
      </div>
    </article>
  );
}

const styles = {
  wrap: {
    marginTop: 24,
    padding: 20,
    borderRadius: 24,
    border: `1px solid ${BRAND.line}`,
    background:
      "linear-gradient(135deg, rgba(255,247,237,1) 0%, rgba(255,255,255,1) 55%, rgba(254,242,242,1) 100%)",
    boxShadow: "0 18px 45px rgba(124, 45, 18, 0.08)",
  },
  header: {
    display: "flex",
    gap: 16,
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  kicker: {
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    color: BRAND.red,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    margin: 0,
    color: BRAND.ink,
    fontSize: 24,
    lineHeight: 1.2,
  },
  desc: {
    margin: "8px 0 0",
    color: BRAND.muted,
    fontSize: 14,
    lineHeight: 1.6,
    maxWidth: 760,
  },
  refreshBtn: {
    border: "none",
    borderRadius: 14,
    padding: "11px 16px",
    background: BRAND.red,
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(180, 35, 24, 0.2)",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 14,
  },
  summaryCard: {
    textAlign: "left",
    border: "1px solid",
    borderRadius: 18,
    padding: 16,
    cursor: "pointer",
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 900,
    lineHeight: 1,
  },
  summaryLabel: {
    marginTop: 8,
    color: BRAND.muted,
    fontSize: 13,
    fontWeight: 700,
  },
  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    margin: "14px 0 18px",
  },
  filterBtn: {
    border: "1px solid #fed7aa",
    background: "#fff",
    color: BRAND.ink,
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
  },
  filterBtnActive: {
    background: BRAND.ink,
    color: "#fff",
    borderColor: BRAND.ink,
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    lineHeight: 1.5,
  },
  emptyBox: {
    background: "#fff",
    border: "1px dashed #fed7aa",
    color: BRAND.muted,
    padding: 18,
    borderRadius: 18,
    textAlign: "center",
    fontWeight: 700,
  },
  cardList: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },
  actionCard: {
    background: BRAND.card,
    border: "1px solid #fed7aa",
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 12px 25px rgba(124,45,18,0.06)",
  },
  actionTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  modulePill: {
    background: "#fff7ed",
    color: BRAND.red,
    border: "1px solid #fed7aa",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  severityPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  actionTitle: {
    margin: "0 0 8px",
    color: BRAND.ink,
    fontSize: 17,
    lineHeight: 1.3,
  },
  actionMsg: {
    margin: 0,
    color: BRAND.muted,
    fontSize: 14,
    lineHeight: 1.55,
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1fr 1fr",
    gap: 10,
    marginTop: 14,
    padding: 12,
    background: "#fff7ed",
    borderRadius: 16,
  },
  metaLabel: {
    display: "block",
    color: BRAND.muted,
    fontSize: 11,
    fontWeight: 800,
    marginBottom: 4,
  },
  metaValue: {
    display: "block",
    color: BRAND.ink,
    fontSize: 12,
    overflowWrap: "anywhere",
  },
  safeNote: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 14,
    background: "#f9fafb",
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
    border: "1px solid #e5e7eb",
  },
  actionButtons: {
    display: "flex",
    gap: 10,
    marginTop: 14,
  },
  primaryBtn: {
    border: "none",
    borderRadius: 14,
    padding: "10px 13px",
    background: BRAND.red,
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "1px solid #fed7aa",
    borderRadius: 14,
    padding: "10px 13px",
    background: "#fff",
    color: BRAND.ink,
    fontWeight: 900,
    cursor: "pointer",
  },
  warningFoot: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    fontSize: 13,
    lineHeight: 1.5,
  },
};
