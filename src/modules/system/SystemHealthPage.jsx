import { useEffect, useMemo, useState } from "react";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Tabs from "../../components/ui/Tabs";
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
function n(value) {
  const x = Number(value || 0);
  return Number.isFinite(x) ? x : 0;
}
function tone(status) {
  const s = String(status || "").toUpperCase();
  if (s === "DANGER" || s === "BLOCKER") return "danger";
  if (s === "WARNING" || s === "CHECK_FAILED" || s === "NOT_AVAILABLE") return "warning";
  return "success";
}
function makeOperationId() {
  return `system-health-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function formatDateTime(value) {
  if (!value) return "Belum tercatat";
  const raw = String(value).replace(" ", "T");
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const TABS = [
  { key: "overview", label: "Ringkasan" },
  { key: "checks", label: "Pemeriksaan" },
  { key: "repair", label: "Perbaikan Aman" },
  { key: "tables", label: "Tabel Sistem" },
];

export default function SystemHealthPage({ session, onSessionExpired }) {
  const sessionToken = tokenOf(session);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState({});
  const [activeTab, setActiveTab] = useState("overview");
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotNote, setSnapshotNote] = useState("Snapshot manual sebelum operasional/closing.");

  const summary = data.summary || {};
  const checks = Array.isArray(data.checks) ? data.checks : [];
  const tables = Array.isArray(data.tables) ? data.tables : [];
  const blockers = useMemo(() => checks.filter((row) => String(row.status || "").toUpperCase() !== "PASS"), [checks]);
  const latestBackup = data.latest_backup || null;
  const latestSnapshot = data.latest_snapshot || null;
  const dataHealthy = n(summary.danger_count) === 0 && n(summary.warning_count) === 0;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [health, bootstrap] = await Promise.all([
        systemSafetyHealth(sessionToken),
        getSystemSafetyBootstrap(sessionToken, {}),
      ]);
      if (authError(health) || authError(bootstrap)) {
        onSessionExpired?.();
        return;
      }
      if (!health?.success) throw new Error(health?.message || "Integritas Data belum siap.");
      if (!bootstrap?.success) throw new Error(bootstrap?.message || "Integritas Data gagal dibaca.");
      setData(bootstrap.data || {});
    } catch (e) {
      setError(e?.message || "Gagal membaca Integritas Data.");
      setData({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionToken) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  async function saveSnapshot() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await createSystemHealthSnapshot(sessionToken, {
        notes: snapshotNote.trim() || "Snapshot manual Integritas Data.",
        operation_id: makeOperationId(),
      });
      if (authError(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) throw new Error(result?.message || "Snapshot gagal dicatat.");
      setNotice(result.message || "Snapshot berhasil dicatat.");
      setSnapshotOpen(false);
      await load();
    } catch (e) {
      setError(e?.message || "Snapshot gagal dicatat.");
    } finally {
      setSaving(false);
    }
  }

  const checkColumns = [
    { key: "label", label: "Pemeriksaan", render: (row) => <div><strong>{row.label}</strong><small className="system-inline-code">{row.check_code}</small></div> },
    { key: "status", label: "Status", render: (row) => <Badge tone={tone(row.status)}>{row.status}</Badge> },
    { key: "count", label: "Jumlah", render: (row) => n(row.count).toLocaleString("id-ID") },
    { key: "message", label: "Keterangan" },
    { key: "action", label: "Aksi", render: (row) => row.page_key ? <Button variant="secondary" onClick={(event) => { event?.stopPropagation?.(); openFocusRoute({ pageKey: row.page_key }); }}>Buka Modul</Button> : "-" },
  ];

  const tableColumns = [
    { key: "table_name", label: "Tabel" },
    { key: "row_count", label: "Baris", render: (row) => n(row.row_count).toLocaleString("id-ID") },
    { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "READY" ? "success" : "danger"}>{row.status}</Badge> },
  ];

  return (
    <main className="da-page system-control-page system-health-v17">
      <PageHeader
        eyebrow="Sistem · Owner Control"
        title="Integritas Data"
        description="Pusat pemeriksaan kesehatan data ERP, keterhubungan transaksi, snapshot, dan perbaikan aman tanpa mengubah data bisnis secara otomatis."
        actions={(
          <div className="da-actions">
            <Button variant="secondary" onClick={load} disabled={loading}>{loading ? "Membaca..." : "Perbarui"}</Button>
            <Button onClick={() => setSnapshotOpen(true)} disabled={loading}>Catat Snapshot</Button>
          </div>
        )}
      />

      {error ? <div className="da-alert da-alert-danger">{error}</div> : null}
      {notice ? <div className="da-alert da-alert-success">{notice}</div> : null}

      <section className="system-hero-grid">
        <div className={`system-score-panel ${dataHealthy ? "is-good" : "is-warning"}`}>
          <div>
            <span className="system-eyebrow">Kesehatan Data</span>
            <h2>{n(summary.score)}<small>/100</small></h2>
            <p>{dataHealthy ? "Data inti konsisten pada pemeriksaan yang tersedia." : "Ada pemeriksaan yang memerlukan perhatian Owner."}</p>
          </div>
          <Badge tone={dataHealthy ? "success" : "warning"}>{dataHealthy ? "Konsisten" : "Perlu Tindakan"}</Badge>
        </div>

        <div className="system-safety-panel">
          <div className="system-safety-row">
            <span>Snapshot terakhir</span>
            <strong>{formatDateTime(latestSnapshot?.snapshot_at)}</strong>
          </div>
          <div className="system-safety-row">
            <span>Backup SQL tercatat</span>
            <strong>{formatDateTime(latestBackup?.backup_at)}</strong>
          </div>
          <div className="system-safety-row">
            <span>Perbaikan otomatis</span>
            <strong>Tidak aktif</strong>
          </div>
        </div>
      </section>

      <section className="system-kpi-grid">
        <StatCard label="Bahaya" value={n(summary.danger_count).toLocaleString("id-ID")} description="Masalah yang dapat mengganggu integritas." tone={n(summary.danger_count) ? "danger" : "success"} />
        <StatCard label="Peringatan" value={n(summary.warning_count).toLocaleString("id-ID")} description="Item yang perlu dipantau." tone={n(summary.warning_count) ? "warning" : "success"} />
        <StatCard label="Tabel Dicek" value={n(summary.table_count).toLocaleString("id-ID")} description="Tabel inti yang diperiksa." />
        <StatCard label="Baris Terbaca" value={n(summary.row_count).toLocaleString("id-ID")} description="Total baris pada tabel inti." />
      </section>

      <div className="system-tabs-wrap"><Tabs items={TABS} activeKey={activeTab} onChange={setActiveTab} /></div>

      {activeTab === "overview" ? (
        <div className="system-workspace-grid">
          <Card
            title="Yang Memerlukan Tindakan"
            description="Hanya item yang belum PASS. Buka modul sumber untuk memperbaiki transaksi dari tempat asalnya."
            action={<Badge tone={blockers.length ? "warning" : "success"}>{blockers.length} item</Badge>}
          >
            {blockers.length ? <DataTable columns={checkColumns} rows={blockers.slice(0, 8)} getRowKey={(row) => row.check_code} /> : (
              <div className="system-empty-success"><strong>Tidak ada masalah integritas yang terbuka.</strong><span>Semua pemeriksaan yang tersedia berstatus PASS.</span></div>
            )}
          </Card>

          <Card title="Pagar Pengaman" description="Batas yang menjaga halaman sistem tetap aman untuk operasional.">
            <div className="system-rule-list">
              <div><strong>Tidak ada auto-repair</strong><span>Perbaikan transaksi tetap dilakukan melalui modul sumber atau repair yang dikonfirmasi Owner.</span></div>
              <div><strong>Tidak ada seed data bisnis</strong><span>Saldo, stok, harga, order, dan transaksi tidak dibuat dari halaman sistem.</span></div>
              <div><strong>Snapshot tidak mengubah saldo</strong><span>Snapshot hanya menyimpan hasil pemeriksaan untuk jejak kontrol.</span></div>
              <div><strong>Backup SQL tetap eksternal</strong><span>File SQL dibuat melalui hosting/phpMyAdmin lalu manifestnya dicatat di ERP.</span></div>
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "checks" ? (
        <Card title="Daftar Pemeriksaan" description="Seluruh pemeriksaan integritas yang dijalankan oleh backend.">
          <DataTable columns={checkColumns} rows={checks} getRowKey={(row) => row.check_code} />
        </Card>
      ) : null}

      {activeTab === "repair" ? (
        <SystemIntegrityRepairPanel
          sessionToken={sessionToken}
          onSessionExpired={onSessionExpired}
          onRepairComplete={load}
        />
      ) : null}

      {activeTab === "tables" ? (
        <Card title="Tabel Sistem Inti" description="Jumlah baris untuk pemeriksaan cepat. Tabel ini read-only.">
          <DataTable columns={tableColumns} rows={tables} getRowKey={(row) => row.table_name} />
        </Card>
      ) : null}

      <Modal open={snapshotOpen} title="Catat Snapshot Integritas" subtitle="Menyimpan hasil pemeriksaan saat ini tanpa mengubah transaksi." onClose={() => setSnapshotOpen(false)} size="md">
        <div className="system-modal-stack">
          <div className="system-modal-summary">
            <div><span>Health score</span><strong>{n(summary.score)}/100</strong></div>
            <div><span>Bahaya</span><strong>{n(summary.danger_count)}</strong></div>
            <div><span>Peringatan</span><strong>{n(summary.warning_count)}</strong></div>
          </div>
          <label className="da-field">
            Catatan Snapshot
            <textarea rows={4} value={snapshotNote} onChange={(event) => setSnapshotNote(event.target.value)} placeholder="Contoh: snapshot sebelum closing mingguan." />
          </label>
          <div className="da-form-actions system-modal-actions">
            <Button variant="secondary" onClick={() => setSnapshotOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={saveSnapshot} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Snapshot"}</Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
