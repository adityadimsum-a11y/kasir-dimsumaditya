import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api/client";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";

function isAuthRequired(result) {
  const code = String(result?.code || result?.error?.code || "").toUpperCase();
  return code === "UNAUTHORIZED" || code === "SESSION_EXPIRED" || code === "AUTH_REQUIRED";
}

function text(value, fallback = "-") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function number(value) {
  const n = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function severityTone(severity) {
  const s = String(severity || "INFO").toUpperCase();
  if (s === "CRITICAL" || s === "ERROR") return "danger";
  if (s === "WARNING") return "warning";
  return "success";
}

function severityLabel(severity) {
  const s = String(severity || "INFO").toUpperCase();
  if (s === "CRITICAL" || s === "ERROR") return "Butuh Dicek Cepat";
  if (s === "WARNING") return "Perlu Perhatian";
  return "Pantauan";
}

function safeOpen(route) {
  if (!route) return;
  window.location.href = route;
}

export default function SystemHealthActionHub({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({});
  const [filter, setFilter] = useState("ALL");

  const sessionToken = session?.sessionToken || session?.session_token || "";
  const cards = data.cards || [];
  const summary = data.summary || {};
  const warnings = data.warnings || [];

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("getLegacySystemHealthActionHub", { limit: 120 }, sessionToken);
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal membaca Action Hub.");
        setData({});
        return;
      }
      setData(result.data || {});
    } catch (err) {
      setError(err?.message || "Gagal koneksi ke backend Action Hub.");
      setData({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionToken) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  const visibleCards = useMemo(() => {
    if (filter === "ALL") return cards;
    return cards.filter((card) => String(card.severity || "INFO").toUpperCase() === filter);
  }, [cards, filter]);

  return (
    <section className="da-page-stack">
      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Action Hub</p>
            <h2>Data yang Perlu Ditindaklanjuti</h2>
            <p className="da-muted">
              Papan ini membaca transaksi yang belum selesai atau belum nyambung jejaknya. Read-only, hanya untuk cek dan buka sumber data.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge tone={cards.length ? "warning" : "success"}>{cards.length ? `${cards.length} kartu` : "Aman"}</Badge>
            <Button type="button" variant="secondary" onClick={loadData} disabled={loading}>
              {loading ? "Membaca..." : "Refresh"}
            </Button>
          </div>
        </div>

        {error ? <div className="da-form-error">{error}</div> : null}

        <div className="da-grid da-grid-4" style={{ marginTop: 16 }}>
          <button type="button" className="da-mini-card" onClick={() => setFilter("CRITICAL")}>
            <span className="da-muted">Butuh Dicek Cepat</span>
            <strong>{number(summary.CRITICAL).toLocaleString("id-ID")}</strong>
          </button>
          <button type="button" className="da-mini-card" onClick={() => setFilter("WARNING")}>
            <span className="da-muted">Perlu Perhatian</span>
            <strong>{number(summary.WARNING).toLocaleString("id-ID")}</strong>
          </button>
          <button type="button" className="da-mini-card" onClick={() => setFilter("INFO")}>
            <span className="da-muted">Pantauan</span>
            <strong>{number(summary.INFO).toLocaleString("id-ID")}</strong>
          </button>
          <button type="button" className="da-mini-card" onClick={() => setFilter("ALL")}>
            <span className="da-muted">Total Kartu</span>
            <strong>{cards.length.toLocaleString("id-ID")}</strong>
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          {[
            ["ALL", "Semua"],
            ["CRITICAL", "Butuh Dicek Cepat"],
            ["WARNING", "Perlu Perhatian"],
            ["INFO", "Pantauan"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={filter === key ? "da-chip da-chip-active" : "da-chip"}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <Card>
          <p className="da-muted">Membaca kartu tindakan...</p>
        </Card>
      ) : null}

      {!loading && !error && visibleCards.length === 0 ? (
        <Card>
          <p className="da-muted">Aman bro. Tidak ada kartu tindakan untuk filter ini.</p>
        </Card>
      ) : null}

      <section className="da-grid da-grid-2">
        {visibleCards.map((card) => (
          <Card key={card.id}>
            <div className="da-section-header">
              <div>
                <p className="da-kicker">{text(card.module, "Modul")}</p>
                <h2>{text(card.title, "Kartu tindakan")}</h2>
              </div>
              <Badge tone={severityTone(card.severity)}>{severityLabel(card.severity)}</Badge>
            </div>

            <p className="da-muted">{text(card.message)}</p>

            <div className="da-grid da-grid-3" style={{ marginTop: 14 }}>
              <div className="da-mini-card">
                <span className="da-muted">ID Sumber</span>
                <strong>{text(card.source_id)}</strong>
              </div>
              <div className="da-mini-card">
                <span className="da-muted">Tanggal</span>
                <strong>{card.date ? formatDate(card.date) : "-"}</strong>
              </div>
              <div className="da-mini-card">
                <span className="da-muted">Nominal</span>
                <strong>{number(card.amount) ? formatRupiah(number(card.amount)) : "-"}</strong>
              </div>
            </div>

            <p className="da-muted" style={{ marginTop: 12 }}>{text(card.safe_note, "Aman: hanya baca data.")}</p>

            <div className="da-form-actions" style={{ justifyContent: "flex-start" }}>
              <Button type="button" onClick={() => safeOpen(card.route)}>
                {text(card.action_label, "Buka Sumber")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => safeOpen(card.archive_route)}>
                Cari di Arsip
              </Button>
            </div>
          </Card>
        ))}
      </section>

      {warnings.length ? (
        <Card>
          <div className="da-section-header">
            <div>
              <p className="da-kicker">Catatan Pembacaan</p>
              <h2>Sheet yang Belum Lengkap</h2>
            </div>
            <Badge tone="warning">{warnings.length} catatan</Badge>
          </div>
          <ul className="da-muted">
            {warnings.slice(0, 8).map((item, index) => (
              <li key={`${item.type || "warn"}-${index}`}>{text(item.message)}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
