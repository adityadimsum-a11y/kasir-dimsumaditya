import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api/client";
import { formatDate } from "../../lib/format/date";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import StatCard from "../../components/ui/StatCard";

function isAuthRequired(result) {
  const code = String(result?.code || result?.error?.code || "").toUpperCase();
  return code === "UNAUTHORIZED" || code === "SESSION_EXPIRED" || code === "AUTH_REQUIRED";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayThisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function text(value, fallback = "-") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function number(value) {
  const n = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function statusTone(value) {
  const s = String(value || "").toUpperCase();
  if (s.includes("GAGAL") || s.includes("FAILED") || s.includes("ERROR")) return "danger";
  if (s.includes("PERLU") || s.includes("WARNING") || s.includes("LOG")) return "warning";
  return "success";
}

function makeOperationId(prefix = "backup") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function BackupExportPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState({});
  const [filters, setFilters] = useState({
    date_start: firstDayThisMonth(),
    date_end: today(),
    location_id: "ALL",
  });
  const [form, setForm] = useState({
    backup_mode: "GOOGLE_SHEET_COPY",
    note: "Backup manual sebelum lanjut build/operasional.",
  });

  const sessionToken = session?.sessionToken || session?.session_token || "";
  const summary = data.summary || {};
  const backups = data.backups || [];
  const sources = data.sources || [];
  const latest = data.latest_backup || {};

  const canBackup = useMemo(() => !saving && !loading, [saving, loading]);

  async function loadData(nextFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("getLegacyBackupExportBootstrap", nextFilters, sessionToken);
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal membaca Backup & Export.");
        setData({});
        return;
      }
      setData(result.data || {});
    } catch (err) {
      setError(err?.message || "Gagal koneksi ke backend.");
      setData({});
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

  function updateForm(field, value) {
    setForm((old) => ({ ...old, [field]: value }));
  }

  async function handleRefresh(event) {
    event?.preventDefault?.();
    setNotice("");
    await loadData(filters);
  }

  async function handleCreateBackup() {
    if (!canBackup) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(
        "legacyCreateManualBackupExport",
        {
          ...filters,
          ...form,
          operation_id: makeOperationId("manual-backup"),
        },
        sessionToken
      );
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal membuat backup.");
        return;
      }
      setNotice(result?.message || "Backup berhasil dicatat.");
      await loadData(filters);
    } catch (err) {
      setError(err?.message || "Gagal membuat backup.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="da-page-stack">
      <section className="da-page-header">
        <div>
          <p className="da-kicker">Dimsum Aditya</p>
          <h1>Backup & Export</h1>
          <p className="da-muted">
            Pengamanan data ERP: backup Google Sheet, catatan backup, sumber tab, dan export ringkasan sebelum/ setelah closing.
          </p>
        </div>
        <Badge tone={error ? "danger" : loading ? "warning" : "success"}>{loading ? "Mengecek" : error ? "Perlu Cek" : "Backup Ready"}</Badge>
      </section>

      {error ? <div className="da-form-error">{error}</div> : null}
      {notice ? <div className="da-form-success">{notice}</div> : null}

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Sistem Aman</p>
            <h2>Backup DB Google Sheet</h2>
            <p className="da-muted">
              Halaman ini tidak membuat transaksi uang/stok. Backup hanya mencatat pengamanan data dan, jika diizinkan, membuat salinan file Google Sheet aktif.
            </p>
          </div>
          <Badge tone="success">Tidak Ubah Transaksi</Badge>
        </div>

        <form className="da-form-grid" onSubmit={handleRefresh}>
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
            <Button type="submit" variant="secondary" disabled={loading}>{loading ? "Membaca..." : "Refresh Data"}</Button>
          </div>
        </form>
      </Card>

      <section className="da-grid da-grid-3">
        <StatCard label="Backup Tercatat" value={number(summary.backup_count).toLocaleString("id-ID")} />
        <StatCard label="Tab Sumber" value={number(summary.source_count).toLocaleString("id-ID")} />
        <StatCard label="Baris Nyata" value={number(summary.real_rows).toLocaleString("id-ID")} />
        <StatCard label="Ghost Disembunyikan" value={number(summary.ghost_rows).toLocaleString("id-ID")} tone="warning" />
        <StatCard label="Backup Terakhir" value={latest?.created_at ? formatDate(latest.created_at) : "-"} />
        <StatCard label="Status Terakhir" value={text(latest?.status)} tone={statusTone(latest?.status)} />
      </section>

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Backup Manual</p>
            <h2>Buat Backup Sekarang</h2>
            <p className="da-muted">
              Mode salin spreadsheet akan mencoba membuat copy file database aktif. Jika izin Drive belum tersedia, sistem tetap mencatat log backup tanpa mengubah transaksi.
            </p>
          </div>
          <Badge tone="warning">Owner Only</Badge>
        </div>

        <div className="da-form-grid">
          <label className="da-form-field">
            <span>Mode Backup</span>
            <select value={form.backup_mode} onChange={(e) => updateForm("backup_mode", e.target.value)}>
              <option value="GOOGLE_SHEET_COPY">Salin Google Sheet DB</option>
              <option value="LOG_ONLY">Catat Log Saja</option>
            </select>
          </label>
          <label className="da-form-field da-form-field-wide">
            <span>Catatan Backup</span>
            <input value={form.note} onChange={(e) => updateForm("note", e.target.value)} placeholder="Contoh: Backup sebelum closing / sebelum deploy" />
          </label>
          <div className="da-form-actions">
            <Button type="button" onClick={handleCreateBackup} disabled={!canBackup}>{saving ? "Membuat Backup..." : "Buat Backup"}</Button>
          </div>
        </div>

        <div className="da-form-warning">
          Backup bukan closing dan bukan koreksi transaksi. Tetap pakai modul sumber untuk memperbaiki data: Kas Keluar, Uang Masuk, Stok, Payroll, Kewajiban, atau 4 Amplop.
        </div>
      </Card>

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Riwayat Backup</p>
            <h2>Backup yang Sudah Dicatat</h2>
            <p className="da-muted">Klik link Drive jika backup berhasil membuat salinan Google Sheet.</p>
          </div>
          <Badge tone="success">Live Log</Badge>
        </div>
        <DataTable
          columns={[
            { key: "created_at", label: "Tanggal", render: (row) => formatDate(row.created_at || row.date) },
            { key: "backup_id", label: "Backup ID", render: (row) => <strong>{text(row.backup_id || row.id)}</strong> },
            { key: "mode", label: "Mode" },
            { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{text(row.status)}</Badge> },
            { key: "source_count", label: "Tab", render: (row) => number(row.source_count).toLocaleString("id-ID") },
            { key: "real_rows", label: "Baris", render: (row) => number(row.real_rows).toLocaleString("id-ID") },
            {
              key: "file_url",
              label: "File",
              render: (row) => row.file_url ? <a href={row.file_url} target="_blank" rel="noreferrer">Buka Backup</a> : "-",
            },
          ]}
          rows={backups}
          emptyMessage="Belum ada backup tercatat."
        />
      </Card>

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Sumber Data</p>
            <h2>Tab yang Ikut Dipantau</h2>
            <p className="da-muted">Ini daftar sumber hidup yang dibaca sebagai manifest backup/export.</p>
          </div>
          <Badge tone="success">Read Only</Badge>
        </div>
        <DataTable
          columns={[
            { key: "module", label: "Modul" },
            { key: "tab", label: "Tab" },
            { key: "real_rows", label: "Baris Nyata", render: (row) => number(row.real_rows).toLocaleString("id-ID") },
            { key: "ghost_rows", label: "Ghost", render: (row) => number(row.ghost_rows).toLocaleString("id-ID") },
            { key: "last_date", label: "Terakhir", render: (row) => row.last_date ? formatDate(row.last_date) : "-" },
            { key: "status", label: "Status", render: (row) => <Badge tone={number(row.real_rows) ? "success" : "warning"}>{number(row.real_rows) ? "Ada Data" : "Kosong"}</Badge> },
          ]}
          rows={sources}
          emptyMessage="Belum ada sumber backup terbaca."
        />
      </Card>
    </div>
  );
}
