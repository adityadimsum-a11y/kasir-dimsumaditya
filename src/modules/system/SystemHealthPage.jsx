import { useEffect, useMemo, useState } from "react";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import {
  createSystemHealthSnapshot,
  getSystemSafetyBootstrap,
  systemSafetyHealth,
} from "../../lib/api/actions";
import { openFocusRoute } from "../../lib/navigation/focusRouter";
import SystemIntegrityRepairPanel from "./SystemIntegrityRepairPanel";

function tokenOf(session) {
  return session?.sessionToken || session?.session_token || "";
}
function authError(result) {
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  return ["AUTH_REQUIRED", "UNAUTHORIZED", "SESSION_EXPIRED", "AUTH_SESSION_INVALID"].includes(code);
}
function n(value) { const x = Number(value || 0); return Number.isFinite(x) ? x : 0; }
function tone(status) {
  const s = String(status || "").toUpperCase();
  if (s === "DANGER" || s === "BLOCKER") return "danger";
  if (s === "WARNING" || s === "CHECK_FAILED" || s === "NOT_AVAILABLE") return "warning";
  return "success";
}
function makeOperationId() { return `system-health-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

export default function SystemHealthPage({ session, onSessionExpired }) {
  const sessionToken = tokenOf(session);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState({});

  const summary = data.summary || {};
  const checks = Array.isArray(data.checks) ? data.checks : [];
  const tables = Array.isArray(data.tables) ? data.tables : [];
  const blockers = useMemo(() => checks.filter((row) => row.status !== "PASS"), [checks]);

  async function load() {
    setLoading(true); setError("");
    try {
      const [health, bootstrap] = await Promise.all([
        systemSafetyHealth(sessionToken),
        getSystemSafetyBootstrap(sessionToken, {}),
      ]);
      if (authError(health) || authError(bootstrap)) { onSessionExpired?.(); return; }
      if (!health?.success) throw new Error(health?.message || "Data Health belum siap.");
      if (!bootstrap?.success) throw new Error(bootstrap?.message || "Data Health gagal dibaca.");
      setData(bootstrap.data || {});
    } catch (e) { setError(e?.message || "Gagal membaca Data Health PHP/MySQL."); setData({}); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (sessionToken) load(); }, [sessionToken]);

  async function saveSnapshot() {
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await createSystemHealthSnapshot(sessionToken, {
        notes: "Snapshot manual sebelum operasional/closing.",
        operation_id: makeOperationId(),
      });
      if (authError(result)) { onSessionExpired?.(); return; }
      if (!result?.success) throw new Error(result?.message || "Snapshot gagal dicatat.");
      setNotice(result.message || "Snapshot berhasil dicatat.");
      await load();
    } catch (e) { setError(e?.message || "Snapshot gagal dicatat."); }
    finally { setSaving(false); }
  }

  return <div className="da-page-stack">
    <section className="da-page-header">
      <div><p className="da-kicker">Pusat Kendali</p><h1>Data Health PHP/MySQL</h1>
        <p className="da-muted">Mendeteksi data yatim, saldo/stok negatif, dan sumber yang putus. Tidak memperbaiki data otomatis.</p></div>
      <Badge tone={error ? "danger" : loading ? "warning" : tone(summary.status)}>
        {loading ? "Mengecek" : error ? "Perlu Cek" : `Health ${summary.status || "Ready"}`}
      </Badge>
    </section>

    {error ? <div className="da-form-error">{error}</div> : null}
    {notice ? <div className="da-form-success">{notice}</div> : null}

    <Card><div className="da-section-header"><div><p className="da-kicker">Single Source</p><h2>Pemeriksaan Integritas ERP</h2>
      <p className="da-muted">Perbaikan selalu dilakukan dari modul sumber; halaman ini hanya membaca dan mencatat snapshot.</p></div>
      <div className="da-actions"><Badge tone="success">PHP/MySQL</Badge><Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button><Button onClick={saveSnapshot} disabled={saving || loading}>{saving ? "Mencatat..." : "Catat Snapshot"}</Button></div></div></Card>

    <section className="da-grid da-grid-3">
      <StatCard label="Health Score" value={`${n(summary.score)} / 100`} tone={tone(summary.status)} />
      <StatCard label="Masalah Bahaya" value={n(summary.danger_count).toLocaleString("id-ID")} tone={n(summary.danger_count) ? "danger" : "success"} />
      <StatCard label="Peringatan" value={n(summary.warning_count).toLocaleString("id-ID")} tone={n(summary.warning_count) ? "warning" : "success"} />
      <StatCard label="Tabel Dicek" value={n(summary.table_count).toLocaleString("id-ID")} />
      <StatCard label="Baris Terbaca" value={n(summary.row_count).toLocaleString("id-ID")} />
      <StatCard label="Migration Aktif" value={n(summary.migration_count).toLocaleString("id-ID")} />
    </section>

    <Card><div className="da-section-header"><div><p className="da-kicker">Papan Pantau</p><h2>Masalah yang Memerlukan Tindakan</h2></div><Badge tone={blockers.length ? "warning" : "success"}>{blockers.length} item</Badge></div>
      <div className="da-table-wrap"><table className="da-table"><thead><tr><th>Pemeriksaan</th><th>Status</th><th>Jumlah</th><th>Keterangan</th><th>Aksi</th></tr></thead><tbody>
        {blockers.length ? blockers.map((row) => <tr key={row.check_code}><td><strong>{row.label}</strong><div className="da-muted">{row.check_code}</div></td><td><Badge tone={tone(row.status)}>{row.status}</Badge></td><td>{n(row.count).toLocaleString("id-ID")}</td><td>{row.message}</td><td><Button variant="secondary" onClick={() => openFocusRoute({ pageKey: row.page_key })}>Buka Modul</Button></td></tr>) : <tr><td colSpan="5">Tidak ditemukan blocker pada pemeriksaan yang tersedia.</td></tr>}
      </tbody></table></div>
    </Card>

    <SystemIntegrityRepairPanel
      sessionToken={sessionToken}
      onSessionExpired={onSessionExpired}
      onRepairComplete={load}
    />

    <Card><div className="da-section-header"><div><p className="da-kicker">Sumber Data</p><h2>Jumlah Baris per Tabel Inti</h2></div><Badge tone="success">Read Only</Badge></div>
      <div className="da-table-wrap"><table className="da-table"><thead><tr><th>Tabel</th><th>Baris</th><th>Status</th></tr></thead><tbody>
        {tables.map((row) => <tr key={row.table_name}><td>{row.table_name}</td><td>{n(row.row_count).toLocaleString("id-ID")}</td><td><Badge tone={row.status === "READY" ? "success" : "danger"}>{row.status}</Badge></td></tr>)}
      </tbody></table></div>
    </Card>
  </div>;
}
