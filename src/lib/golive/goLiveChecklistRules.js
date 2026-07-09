import { useEffect, useMemo, useState } from "react";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import StatCard from "../../components/ui/StatCard";
import { legacySafeRequest, isLegacyAuthRequired } from "../../lib/api/legacySafeRequest";
import { formatDate } from "../../lib/format/date";
import { openFocusRoute } from "../../lib/navigation/focusRouter";
import {
  GO_LIVE_MANUAL_CHECKS,
  buildSystemGoLiveChecklist,
  summarizeGoLiveReadiness,
} from "../../lib/golive/goLiveChecklistRules";

const MANUAL_STORAGE_KEY = "da_go_live_manual_checks_v1";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayThisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function readManualState() {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem(MANUAL_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveManualState(nextState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(nextState || {}));
}

function renderStatus(row) {
  return row.status_label || row.status || "-";
}

function MiniProgress({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value || 0)));

  return (
    <div style={styles.progressWrap}>
      <div style={{ ...styles.progressBar, width: `${pct}%` }} />
    </div>
  );
}

export default function GoLiveChecklistPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [healthData, setHealthData] = useState({});
  const [actionHub, setActionHub] = useState({});
  const [manualState, setManualState] = useState(() => readManualState());
  const [activeTab, setActiveTab] = useState("system");
  const [copyMessage, setCopyMessage] = useState("");
  const [filters, setFilters] = useState({
    date_start: firstDayThisMonth(),
    date_end: today(),
    location_id: "ALL",
  });

  const sessionToken = session?.sessionToken || session?.session_token || "";

  const systemItems = useMemo(() => {
    return buildSystemGoLiveChecklist(healthData, actionHub);
  }, [healthData, actionHub]);

  const readiness = useMemo(() => {
    return summarizeGoLiveReadiness(systemItems, manualState);
  }, [systemItems, manualState]);

  const manualRows = useMemo(() => {
    return GO_LIVE_MANUAL_CHECKS.map((item) => ({
      ...item,
      done: Boolean(manualState[item.key]),
      status_label: manualState[item.key] ? "Selesai" : "Belum",
      tone: manualState[item.key] ? "success" : "warning",
    }));
  }, [manualState]);

  async function loadData(nextFilters = filters) {
    setLoading(true);
    setError("");
    setCopyMessage("");

    try {
      const [healthResult, actionResult] = await Promise.all([
        legacySafeRequest("getLegacySystemHealthBootstrap", nextFilters, sessionToken),
        legacySafeRequest("getLegacySystemHealthActionHub", { ...nextFilters, limit: 100 }, sessionToken),
      ]);

      if (isLegacyAuthRequired(healthResult) || isLegacyAuthRequired(actionResult)) {
        onSessionExpired?.();
        return;
      }

      if (!healthResult?.success) {
        setError(healthResult?.message || "Gagal membaca Data Health untuk Go-Live Check.");
        setHealthData({});
      } else {
        setHealthData(healthResult.data || {});
      }

      if (!actionResult?.success) {
        setActionHub({
          total_cards: 0,
          cards: [],
          summary: {},
          warning_message: actionResult?.message || "Action Hub belum terbaca.",
        });
      } else {
        setActionHub(actionResult.data || {});
      }
    } catch (err) {
      setError(err?.message || "Gagal koneksi ke backend.");
      setHealthData({});
      setActionHub({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionToken) loadData(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  function updateFilter(field, value) {
    setFilters((old) => ({ ...old, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    loadData(filters);
  }

  function toggleManual(key) {
    setManualState((old) => {
      const next = { ...old, [key]: !old[key] };
      saveManualState(next);
      return next;
    });
  }

  function resetManual() {
    setManualState({});
    saveManualState({});
  }

  function buildSummaryText() {
    const lines = [
      "GO-LIVE CHECK ERP DIMSUM ADITYA",
      `Periode: ${formatDate(filters.date_start)} - ${formatDate(filters.date_end)}`,
      `Status: ${readiness.status}`,
      `Score: ${readiness.score}/100`,
      `Blocker: ${readiness.blockers}`,
      `Perlu dirapikan: ${readiness.warnings}`,
      `Manual checklist: ${readiness.manual_done}/${readiness.manual_total}`,
      "",
      "Checklist Sistem:",
      ...systemItems.map((item) => `- ${item.title}: ${item.status_label} — ${item.note}`),
      "",
      "Checklist Manual:",
      ...manualRows.map((item) => `- ${item.title}: ${item.done ? "Selesai" : "Belum"}`),
    ];

    return lines.join("\n");
  }

  async function copySummary() {
    const text = buildSummaryText();
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Ringkasan berhasil dicopy.");
    } catch {
      setCopyMessage("Browser tidak mengizinkan copy otomatis. Salin manual dari checklist di layar.");
    }
  }

  function goToDataHealth() {
    openFocusRoute({ pageKey: "system-health" });
  }

  function goToArchive() {
    openFocusRoute({ pageKey: "arsip-digital" });
  }

  return (
    <div className="da-page-stack">
      <section className="da-page-header">
        <div>
          <p className="da-kicker">Dimsum Aditya</p>
          <h1>Go-Live Check</h1>
          <p className="da-muted">
            Checklist kesiapan sebelum sistem dipakai harian. Halaman ini membaca Data Health dan Action Hub, lalu digabung dengan checklist manual owner.
          </p>
        </div>
        <Badge tone={readiness.tone}>{loading ? "Mengecek" : readiness.status}</Badge>
      </section>

      {error ? <div className="da-form-error">{error}</div> : null}

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Cutover Control</p>
            <h2>Kesiapan Go-Live Bertahap</h2>
            <p className="da-muted">
              Layout ini masih alat kontrol data/kabel/logic. Final merchant layout tetap bisa dipoles di batch berikutnya setelah mesin ERP hijau.
            </p>
          </div>
          <Badge tone={readiness.tone}>{readiness.score}/100</Badge>
        </div>

        <MiniProgress value={readiness.score} />

        <p className="da-muted" style={{ marginTop: 12 }}>
          {readiness.note}
        </p>

        <form className="da-form-grid" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          <label className="da-form-field">
            <span>Tanggal Mulai</span>
            <input type="date" value={filters.date_start} onChange={(e) => updateFilter("date_start", e.target.value)} />
          </label>
          <label className="da-form-field">
            <span>Tanggal Sampai</span>
            <input type="date" value={filters.date_end} onChange={(e) => updateFilter("date_end", e.target.value)} />
          </label>
          <label className="da-form-field">
            <span>Lokasi</span>
            <input value={filters.location_id} onChange={(e) => updateFilter("location_id", e.target.value)} placeholder="ALL / TGR / PML / CBN" />
          </label>
          <div className="da-form-actions">
            <Button type="submit" disabled={loading}>{loading ? "Mengecek..." : "Refresh Check"}</Button>
          </div>
        </form>
      </Card>

      <section className="da-grid da-grid-3">
        <StatCard label="Score Go-Live" value={`${readiness.score}/100`} tone={readiness.tone === "success" ? "default" : readiness.tone} />
        <StatCard label="Blocker" value={readiness.blockers.toLocaleString("id-ID")} tone={readiness.blockers ? "danger" : "default"} />
        <StatCard label="Perlu Dirapikan" value={readiness.warnings.toLocaleString("id-ID")} tone={readiness.warnings ? "warning" : "default"} />
        <StatCard label="Checklist Sistem" value={`${readiness.system_pass}/${readiness.system_total}`} />
        <StatCard label="Checklist Manual" value={`${readiness.manual_done}/${readiness.manual_total}`} tone={readiness.manual_done === readiness.manual_total ? "default" : "warning"} />
        <StatCard label="Periode" value={`${formatDate(filters.date_start)} - ${formatDate(filters.date_end)}`} />
      </section>

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Mode Cek</p>
            <h2>Checklist Go-Live</h2>
          </div>
          <div style={styles.buttonRow}>
            <Button variant={activeTab === "system" ? "primary" : "secondary"} onClick={() => setActiveTab("system")}>Sistem</Button>
            <Button variant={activeTab === "manual" ? "primary" : "secondary"} onClick={() => setActiveTab("manual")}>Manual</Button>
            <Button variant={activeTab === "cutover" ? "primary" : "secondary"} onClick={() => setActiveTab("cutover")}>Cutover</Button>
          </div>
        </div>

        {activeTab === "system" ? (
          <DataTable
            columns={[
              { key: "status", label: "Status", render: renderStatus },
              { key: "title", label: "Cek Sistem" },
              { key: "owner", label: "PIC" },
              { key: "note", label: "Catatan" },
              { key: "source", label: "Sumber" },
            ]}
            rows={systemItems}
            emptyMessage="Checklist sistem belum terbaca."
          />
        ) : null}

        {activeTab === "manual" ? (
          <div className="da-page-stack">
            <DataTable
              columns={[
                {
                  key: "done",
                  label: "Done",
                  render: (row) => (
                    <input
                      type="checkbox"
                      checked={row.done}
                      onChange={() => toggleManual(row.key)}
                      aria-label={`Checklist ${row.title}`}
                    />
                  ),
                },
                { key: "status", label: "Status", render: renderStatus },
                { key: "title", label: "Cek Manual" },
                { key: "owner", label: "PIC" },
                { key: "note", label: "Catatan" },
              ]}
              rows={manualRows}
              emptyMessage="Checklist manual belum ada."
            />
            <div style={styles.buttonRow}>
              <Button variant="secondary" onClick={resetManual}>Reset Manual Checklist</Button>
            </div>
          </div>
        ) : null}

        {activeTab === "cutover" ? (
          <div className="da-grid da-grid-2">
            <div style={styles.cutoverBox}>
              <p className="da-kicker">Urutan Aman</p>
              <h3>Go-Live Bertahap</h3>
              <ol style={styles.list}>
                <li>Tangerang/Owner pakai dulu untuk input nyata dan cek benang merah.</li>
                <li>DROP Ayam → Produksi/Adukan → Stok Jadi → Order dicoba 1 hari penuh.</li>
                <li>Pemalang/Cibinong masuk setelah laporan harian dan setoran valid.</li>
                <li>Payroll, kewajiban, closing, dan 4 Amplop aktif setelah data operasional stabil.</li>
              </ol>
            </div>
            <div style={styles.cutoverBox}>
              <p className="da-kicker">Jangan Dilakukan</p>
              <h3>Safety Rules</h3>
              <ol style={styles.list}>
                <li>Jangan hapus transaksi live. Gunakan batal/void/koreksi dengan alasan.</li>
                <li>Jangan edit langsung data setelah closing tanpa flow revisi.</li>
                <li>Jangan isi Kas Masuk manual untuk pembayaran penjualan; harus dari invoice/payment.</li>
                <li>Jangan ubah HPP/modal lama setelah transaksi berjalan.</li>
              </ol>
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Tindak Lanjut</p>
            <h2>Shortcut Pemeriksaan</h2>
            <p className="da-muted">
              Kalau masih ada blocker/perlu dirapikan, buka Data Health dan Arsip Digital untuk melihat sumber ID-nya.
            </p>
          </div>
          <Badge tone="success">Read Only</Badge>
        </div>
        <div style={styles.buttonRow}>
          <Button onClick={goToDataHealth}>Buka Data Health</Button>
          <Button variant="secondary" onClick={goToArchive}>Buka Arsip Digital</Button>
          <Button variant="secondary" onClick={copySummary}>Copy Ringkasan</Button>
        </div>
        {copyMessage ? <p className="da-muted" style={{ marginTop: 10 }}>{copyMessage}</p> : null}
      </Card>
    </div>
  );
}

const styles = {
  progressWrap: {
    height: 12,
    borderRadius: 999,
    background: "#f1f5f9",
    overflow: "hidden",
    border: "1px solid #e5e7eb",
  },
  progressBar: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #dc2626, #f97316, #22c55e)",
    transition: "width 0.25s ease",
  },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  cutoverBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    background: "#fff",
  },
  list: {
    margin: "10px 0 0 18px",
    padding: 0,
    color: "#475569",
    lineHeight: 1.7,
  },
};
