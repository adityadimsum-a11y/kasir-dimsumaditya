import { useEffect, useMemo, useState } from "react";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import {
  createSystemBackupManifest,
  getSystemSafetyBootstrap,
} from "../../lib/api/actions";

function n(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function tokenOf(session) {
  return session?.sessionToken || session?.session_token || "";
}
function authError(result) {
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  return ["AUTH_REQUIRED", "UNAUTHORIZED", "SESSION_EXPIRED", "AUTH_SESSION_INVALID"].includes(code);
}
function operationId() {
  return `backup-manifest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
function csvCell(value) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}
function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function formatBytes(value) {
  const bytes = n(value);
  if (!bytes) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toLocaleString("id-ID", { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
}
function formatDateTime(value) {
  if (!value) return "Belum tercatat";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const EMPTY_FORM = {
  file_reference: "",
  file_size_bytes: "",
  checksum_sha256: "",
  notes: "Backup SQL manual dari phpMyAdmin/hPanel.",
};

export default function PrintExportBackupSafetyPage({ session, onSessionExpired }) {
  const sessionToken = tokenOf(session);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [manifestOpen, setManifestOpen] = useState(false);

  const summary = data.summary || {};
  const backups = Array.isArray(data.backups) ? data.backups : [];
  const tables = Array.isArray(data.tables) ? data.tables : [];
  const exportData = useMemo(() => data.export_payload || {}, [data]);
  const latestBackup = data.latest_backup || backups[0] || null;
  const backupRecorded = Boolean(latestBackup?.backup_id || latestBackup?.file_reference);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await getSystemSafetyBootstrap(sessionToken, {});
      if (authError(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) throw new Error(result?.message || "Cetak & Backup gagal dibaca.");
      setData(result.data || {});
    } catch (e) {
      setError(e?.message || "Gagal membaca Cetak & Backup.");
      setData({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionToken) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  function exportJson() {
    download(`ERP_DIMSUM_ADITYA_SAFETY_${stamp()}.json`, JSON.stringify(exportData, null, 2), "application/json;charset=utf-8");
  }
  function exportCsv() {
    const rows = [["TABLE", "ROW_COUNT", "STATUS"], ...tables.map((row) => [row.table_name, row.row_count, row.status])];
    download(`ERP_DIMSUM_ADITYA_TABLE_COUNTS_${stamp()}.csv`, rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
  }

  async function saveManifest() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await createSystemBackupManifest(sessionToken, {
        ...form,
        file_size_bytes: n(form.file_size_bytes),
        backup_type: "SQL_EXPORT",
        operation_id: operationId(),
      });
      if (authError(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) throw new Error(result?.message || "Manifest gagal dicatat.");
      setNotice(result.message || "Manifest berhasil dicatat.");
      setForm(EMPTY_FORM);
      setManifestOpen(false);
      await load();
    } catch (e) {
      setError(e?.message || "Manifest gagal dicatat.");
    } finally {
      setSaving(false);
    }
  }

  const backupColumns = [
    { key: "backup_at", label: "Waktu", render: (row) => formatDateTime(row.backup_at) },
    { key: "backup_id", label: "Backup ID" },
    { key: "file_reference", label: "File" },
    { key: "file_size_bytes", label: "Ukuran", render: (row) => formatBytes(row.file_size_bytes) },
    { key: "status", label: "Status", render: (row) => <Badge tone="success">{row.status || "RECORDED"}</Badge> },
  ];

  return (
    <main className="da-page system-control-page system-backup-v17">
      <PageHeader
        eyebrow="Sistem · Owner Control"
        title="Cetak & Backup"
        description="Ekspor ringkasan kontrol sistem, cetak laporan safety, dan catat bukti backup SQL yang benar-benar sudah dibuat."
        actions={(
          <div className="da-actions">
            <Button variant="secondary" onClick={load} disabled={loading}>{loading ? "Membaca..." : "Perbarui"}</Button>
            <Button variant="secondary" onClick={() => window.print()}>Print / PDF</Button>
            <Button onClick={() => setManifestOpen(true)}>+ Catat Backup</Button>
          </div>
        )}
      />

      {error ? <div className="da-alert da-alert-danger">{error}</div> : null}
      {notice ? <div className="da-alert da-alert-success">{notice}</div> : null}

      <section className="system-backup-hero">
        <div className="system-backup-main">
          <span className="system-eyebrow">Status Perlindungan Data</span>
          <h2>{backupRecorded ? "Backup SQL sudah memiliki manifest" : "Backup SQL belum tercatat di ERP"}</h2>
          <p>ERP tidak membuat dump database otomatis. File SQL tetap dibuat melalui phpMyAdmin/hPanel atau fitur backup hosting, lalu referensinya dicatat di sini.</p>
          <div className="system-chip-row">
            <Badge tone={n(summary.danger_count) ? "danger" : "success"}>Integritas {n(summary.score)}/100</Badge>
            <Badge tone={backupRecorded ? "success" : "warning"}>{backupRecorded ? "Manifest Tercatat" : "Manifest Belum Ada"}</Badge>
            <Badge tone="success">Owner Only</Badge>
          </div>
        </div>
        <div className="system-backup-latest">
          <span>Backup terakhir</span>
          <strong>{formatDateTime(latestBackup?.backup_at)}</strong>
          <small>{latestBackup?.file_reference || "Belum ada referensi file SQL."}</small>
        </div>
      </section>

      <section className="system-kpi-grid system-kpi-grid-4">
        <StatCard label="Health Score" value={`${n(summary.score)} / 100`} description="Ringkasan integritas data saat ini." tone={n(summary.danger_count) ? "danger" : "success"} />
        <StatCard label="Tabel Dipantau" value={n(summary.table_count).toLocaleString("id-ID")} description="Tabel inti dalam laporan safety." />
        <StatCard label="Total Baris" value={n(summary.row_count).toLocaleString("id-ID")} description="Jumlah baris pada tabel inti." />
        <StatCard label="Backup Tercatat" value={backups.length.toLocaleString("id-ID")} description="Manifest file backup yang disimpan Owner." tone={backups.length ? "success" : "warning"} />
      </section>

      <div className="system-workspace-grid system-backup-grid">
        <Card title="Paket Ekspor Kontrol" description="Untuk dokumentasi dan pemeriksaan. Bukan pengganti full backup SQL.">
          <div className="system-export-grid">
            <button type="button" onClick={exportJson}><strong>Export JSON</strong><span>Ringkasan health, checks, tabel, dan migration untuk dokumentasi.</span></button>
            <button type="button" onClick={exportCsv}><strong>Export CSV</strong><span>Daftar jumlah baris per tabel untuk pemeriksaan cepat.</span></button>
            <button type="button" onClick={() => window.print()}><strong>Print / PDF</strong><span>Cetak tampilan safety sebagai dokumentasi kontrol Owner.</span></button>
          </div>
        </Card>

        <Card title="Aturan Backup" description="Cara membaca fungsi halaman ini.">
          <div className="system-rule-list">
            <div><strong>File SQL dibuat di hosting</strong><span>Gunakan phpMyAdmin/hPanel atau backup hosting untuk membuat file database nyata.</span></div>
            <div><strong>Manifest bukan file backup</strong><span>ERP hanya menyimpan nama file, ukuran, checksum, waktu, dan catatan.</span></div>
            <div><strong>SHA-256 disarankan</strong><span>Checksum membantu membuktikan file yang disimpan tidak berubah.</span></div>
            <div><strong>Tidak mengubah transaksi</strong><span>Export dan pencatatan manifest tidak memengaruhi kas, stok, hutang, payroll, atau 4 Amplop.</span></div>
          </div>
        </Card>
      </div>

      <Card title="Riwayat Backup SQL" description="Manifest backup yang sudah dicatat oleh Owner." action={<Badge tone={backups.length ? "success" : "warning"}>{backups.length} manifest</Badge>}>
        <DataTable columns={backupColumns} rows={backups} getRowKey={(row) => row.backup_id} />
      </Card>

      <Modal open={manifestOpen} title="Catat Backup SQL" subtitle="Isi setelah file database benar-benar sudah dibuat dan disimpan." onClose={() => !saving && setManifestOpen(false)} size="md">
        <div className="system-modal-stack">
          <div className="system-modal-warning">Halaman ini tidak membuat dump database otomatis. Pastikan file SQL sudah ada sebelum mencatat manifest.</div>
          <div className="da-form-grid">
            <label className="da-field">
              Nama / Referensi File SQL
              <input value={form.file_reference} onChange={(event) => setForm((current) => ({ ...current, file_reference: event.target.value }))} placeholder="contoh: u1272653_erp_2026-08-10.sql.gz" />
            </label>
            <label className="da-field">
              Ukuran File (byte)
              <input inputMode="numeric" value={form.file_size_bytes} onChange={(event) => setForm((current) => ({ ...current, file_size_bytes: event.target.value.replace(/[^0-9]/g, "") }))} placeholder="Opsional" />
            </label>
            <label className="da-field system-span-2">
              SHA-256
              <input value={form.checksum_sha256} onChange={(event) => setForm((current) => ({ ...current, checksum_sha256: event.target.value.trim().toLowerCase() }))} placeholder="64 karakter, opsional" />
            </label>
            <label className="da-field system-span-2">
              Catatan
              <textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            </label>
          </div>
          <div className="da-form-actions system-modal-actions">
            <Button variant="secondary" onClick={() => setManifestOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={saveManifest} disabled={saving || !form.file_reference.trim()}>{saving ? "Menyimpan..." : "Catat Manifest"}</Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
