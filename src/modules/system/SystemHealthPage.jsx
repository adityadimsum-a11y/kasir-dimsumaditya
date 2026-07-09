import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api/client";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import StatCard from "../../components/ui/StatCard";
import SystemHealthActionHub from "./SystemHealthActionHub";

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

function toneBySeverity(severity) {
  const s = String(severity || "").toUpperCase();
  if (s === "ERROR" || s === "BAHAYA") return "danger";
  if (s === "WARNING" || s === "PERLU CEK") return "warning";
  return "success";
}

function issueLabel(row) {
  const severity = String(row?.severity || "INFO").toUpperCase();
  if (severity === "ERROR") return "Bahaya";
  if (severity === "WARNING") return "Perlu Cek";
  return "Aman";
}

export default function SystemHealthPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({});
  const [filters, setFilters] = useState({
    date_start: firstDayThisMonth(),
    date_end: today(),
    location_id: "ALL",
  });

  const sessionToken = session?.sessionToken || session?.session_token || "";
  const summary = data.summary || {};
  const modules = data.modules || [];
  const issues = data.issues || [];
  const checks = data.checks || [];
  const recent = data.recent || [];

  const healthTone = useMemo(() => {
    if (error) return "danger";
    if (number(summary.error_count) > 0) return "danger";
    if (number(summary.warning_count) > 0) return "warning";
    return "success";
  }, [error, summary.error_count, summary.warning_count]);

  async function loadData(nextFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("getLegacySystemHealthBootstrap", nextFilters, sessionToken);
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal membaca Data Health.");
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

  function handlePull(event) {
    event.preventDefault();
    loadData(filters);
  }

  return (
    <div className="da-page-stack">
      <section className="da-page-header">
        <div>
          <p className="da-kicker">Dimsum Aditya</p>
          <h1>Data Health</h1>
          <p className="da-muted">
            Cek kesehatan kabel ERP: ID transaksi, source ID, ghost row, uang, stok, payroll, kewajiban, closing, dan arsip.
          </p>
        </div>
        <Badge tone={loading ? "warning" : healthTone}>
          {loading ? "Mengecek" : healthTone === "success" ? "Sehat" : "Perlu Cek"}
        </Badge>
      </section>

      {error ? <div className="da-form-error">{error}</div> : null}

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Sistem Ringan & Bersih</p>
            <h2>Integrity Check ERP</h2>
            <p className="da-muted">
              Halaman ini read-only. Tidak membuat transaksi baru, hanya membaca sumber hidup dan menandai data yang perlu dirapikan.
            </p>
          </div>
          <Badge tone={healthTone}>{text(summary.status || (healthTone === "success" ? "Aman" : "Perlu Cek"))}</Badge>
        </div>

        <form className="da-form-grid" onSubmit={handlePull}>
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
            <Button type="submit" disabled={loading}>{loading ? "Mengecek..." : "Cek Data"}</Button>
          </div>
        </form>
      </Card>

      <section className="da-grid da-grid-3">
        <StatCard label="Masalah Bahaya" value={number(summary.error_count).toLocaleString("id-ID")} tone={number(summary.error_count) ? "danger" : "default"} />
        <StatCard label="Perlu Cek" value={number(summary.warning_count).toLocaleString("id-ID")} tone={number(summary.warning_count) ? "warning" : "default"} />
        <StatCard label="Ghost Row Disembunyikan" value={number(summary.ghost_rows).toLocaleString("id-ID")} tone="warning" />
        <StatCard label="Baris Nyata" value={number(summary.real_rows).toLocaleString("id-ID")} />
        <StatCard label="Modul Dicek" value={number(summary.modules_checked).toLocaleString("id-ID")} />
        <StatCard label="Periode" value={`${formatDate(filters.date_start)} - ${formatDate(filters.date_end)}`} />
      </section>

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Peta Modul</p>
            <h2>Kesehatan per Tab</h2>
            <p className="da-muted">Baris kosong/formatting tidak dihitung sebagai transaksi hidup.</p>
          </div>
          <Badge tone="success">Read Only</Badge>
        </div>
        <DataTable
          columns={[
            { key: "module", label: "Modul" },
            { key: "tab", label: "Tab/Sumber" },
            { key: "real_rows", label: "Baris Nyata", render: (row) => number(row.real_rows).toLocaleString("id-ID") },
            { key: "ghost_rows", label: "Ghost", render: (row) => number(row.ghost_rows).toLocaleString("id-ID") },
            { key: "missing_id", label: "Perlu ID", render: (row) => number(row.missing_id).toLocaleString("id-ID") },
            { key: "status", label: "Status", render: (row) => <Badge tone={toneBySeverity(row.severity)}>{text(row.status || issueLabel(row))}</Badge> },
          ]}
          rows={modules}
          emptyMessage="Belum ada modul yang terbaca."
        />
      </Card>

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Masalah yang Perlu Diperhatikan</p>
            <h2>Action List</h2>
            <p className="da-muted">Perbaikan tetap dilakukan dari modul sumber, bukan dari halaman Data Health.</p>
          </div>
          <Badge tone={issues.length ? "warning" : "success"}>{issues.length ? `${issues.length} catatan` : "Aman"}</Badge>
        </div>
        <DataTable
          columns={[
            { key: "severity", label: "Level", render: (row) => <Badge tone={toneBySeverity(row.severity)}>{issueLabel(row)}</Badge> },
            { key: "module", label: "Modul" },
            { key: "message", label: "Catatan" },
            { key: "source", label: "Sumber" },
            { key: "count", label: "Jumlah", render: (row) => number(row.count).toLocaleString("id-ID") },
          ]}
          rows={issues}
          emptyMessage="Belum ada alarm besar."
        />
      </Card>

      <section className="da-grid da-grid-2">
        <Card>
          <div className="da-section-header">
            <div>
              <p className="da-kicker">Benang Merah</p>
              <h2>Checklist Kabel Utama</h2>
            </div>
            <Badge tone="success">Live Check</Badge>
          </div>
          <DataTable
            columns={[
              { key: "label", label: "Cek" },
              { key: "value", label: "Nilai", render: (row) => row.type === "money" ? formatRupiah(number(row.value)) : text(row.value) },
              { key: "status", label: "Status", render: (row) => <Badge tone={toneBySeverity(row.severity)}>{text(row.status)}</Badge> },
            ]}
            rows={checks}
            emptyMessage="Belum ada checklist terbaca."
          />
        </Card>
        <Card>
          <div className="da-section-header">
            <div>
              <p className="da-kicker">Jejak Terakhir</p>
              <h2>Transaksi Terbaru</h2>
            </div>
            <Badge tone="success">Archive Hook</Badge>
          </div>
          <DataTable
            columns={[
              { key: "date", label: "Tanggal", render: (row) => formatDate(row.date) },
              { key: "module", label: "Modul" },
              { key: "id", label: "ID" },
              { key: "amount", label: "Nominal", render: (row) => formatRupiah(number(row.amount)) },
            ]}
            rows={recent.slice(0, 8)}
            emptyMessage="Belum ada transaksi terbaru."
          />
        </Card>
      </section>

      <SystemHealthActionHub
        session={session}
        onSessionExpired={onSessionExpired}
      />

      <Card>
        <p className="da-muted">
          Catatan: Data Health hanya membaca dan memberi alarm. Kalau ada sumber hilang, perbaiki dari modul asal seperti Kas & Dompet, Kas Keluar, Uang Masuk, Stok, Payroll, Kewajiban, atau Arsip Digital.
        </p>
      </Card>
    </div>
  );
}
