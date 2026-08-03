import { useEffect, useMemo, useState } from "react";
import {
  createOwnerPeriodClosingRevision,
  createOwnerPeriodClosingSnapshot,
  getOwnerPeriodReportBootstrap,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import StatCard from "../../components/ui/StatCard";
import FinanceLockPanel from "../owner/FinanceLockPanel";

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

function formatKg(value) {
  return `${number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg`;
}

function formatPcs(value) {
  return `${number(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })} pcs`;
}

function printOwnerReport() {
  window.print();
}

function makeOperationId() {
  return `OP-CLOSE-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export default function ClosingOwnerPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [revisionSaving, setRevisionSaving] = useState(false);
  const [revisionDraft, setRevisionDraft] = useState({
    revision_type: "CATATAN_REVISI",
    reason: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState({});
  const [filters, setFilters] = useState({
    date_start: firstDayThisMonth(),
    date_end: today(),
    location_id: "ALL",
  });

  const sessionToken = session?.sessionToken || session?.session_token || "";
  const summary = data.summary || {};
  const health = data.health || {};
  const sections = data.sections || {};
  const records = data.recent_records || [];
  const locationOptions = data.location_options || [];
  const periodClosings = data.period_closings || [];
  const closingRevisions = data.closing_revisions || [];
  const currentClosing = data.current_closing || null;
  const isLocked = Boolean(health.closing_locked || currentClosing?.closing_id || summary.closing_id);
  const rowsWithoutSource = number(health.rows_without_source || health.wallet_mutations_without_source);

  const periodLabel = useMemo(() => {
    return `${formatDate(filters.date_start)} - ${formatDate(filters.date_end)}`;
  }, [filters.date_start, filters.date_end]);

  async function loadData(nextFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const result = await getOwnerPeriodReportBootstrap(sessionToken, nextFilters);
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal membaca Laporan Owner.");
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

  function handlePullPeriod(event) {
    event.preventDefault();
    setSuccess("");
    loadData(filters);
  }

  async function handleLockPeriod() {
    setError("");
    setSuccess("");

    if (isLocked) {
      setError("Periode ini sudah punya snapshot/lock closing.");
      return;
    }

    if (rowsWithoutSource > 0) {
      setError("Masih ada mutasi perlu sumber. Rapihkan dulu sebelum lock closing periode.");
      return;
    }

    const ok = window.confirm(
      `Simpan snapshot dan lock laporan owner periode ${periodLabel}?\n\nLock ini tidak membuat transaksi baru, tapi mengunci angka laporan periode supaya bisa diaudit.`
    );
    if (!ok) return;

    setLocking(true);
    try {
      const result = await createOwnerPeriodClosingSnapshot(sessionToken, {
        ...filters,
        operation_id: makeOperationId(),
      });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal lock closing periode.");
        return;
      }
      const closingId = result?.data?.closing?.closing_id || result?.data?.closing_id || "";
      setSuccess(closingId ? `Snapshot periode tersimpan: ${closingId}` : "Snapshot periode berhasil tersimpan.");
      await loadData(filters);
    } catch (err) {
      setError(err?.message || "Gagal koneksi saat lock closing periode.");
    } finally {
      setLocking(false);
    }
  }

  async function handleCreateRevision(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!isLocked) {
      setError("Periode belum lock. Catatan revisi hanya dibuat setelah snapshot/closing tersimpan.");
      return;
    }

    const reason = text(revisionDraft.reason, "");
    if (!reason || reason === "-") {
      setError("Alasan/catatan revisi wajib diisi.");
      return;
    }

    const ok = window.confirm(
      `Catat revisi untuk periode ${periodLabel}?\n\nCatatan ini tidak membuka kunci transaksi dan tidak mengubah angka. Perbaikan tetap dilakukan dari modul sumber.`
    );
    if (!ok) return;

    setRevisionSaving(true);
    try {
      const result = await createOwnerPeriodClosingRevision(sessionToken, {
        ...filters,
        closing_id: currentClosing?.closing_id || summary.closing_id || "",
        revision_type: revisionDraft.revision_type,
        reason,
        operation_id: `OP-REV-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal mencatat revisi closing.");
        return;
      }
      const revisionId = result?.data?.revision?.revision_id || result?.data?.revision_id || "";
      setSuccess(revisionId ? `Catatan revisi tersimpan: ${revisionId}` : "Catatan revisi berhasil tersimpan.");
      setRevisionDraft({ revision_type: "CATATAN_REVISI", reason: "" });
      await loadData(filters);
    } catch (err) {
      setError(err?.message || "Gagal koneksi saat mencatat revisi closing.");
    } finally {
      setRevisionSaving(false);
    }
  }

  const moneyRows = sections.money_flow || [];
  const obligationRows = sections.obligations || [];
  const stockRows = sections.stock_flow || [];
  const actionRows = sections.action_notes || [];

  return (
    <div className="da-page-stack">
      <section className="da-page-header">
        <div>
          <p className="da-kicker">Closing & Laporan Owner</p>
          <h1>Laporan Owner Periode</h1>
          <p className="da-muted">
            Tarik data periode dari transaksi hidup. Setelah dicek bersih, owner bisa simpan snapshot/lock periode.
          </p>
        </div>
        <Badge tone={loading ? "warning" : error ? "danger" : "success"}>
          {loading ? "Membaca" : error ? "Perlu Cek" : "Terhubung"}
        </Badge>
      </section>

      {error ? <div className="da-form-error">{error}</div> : null}
      {success ? <div className="da-form-success">{success}</div> : null}

      <Card>
        <form className="da-form-grid" onSubmit={handlePullPeriod}>
          <label className="da-form-field">
            <span>Tanggal Mulai</span>
            <input
              type="date"
              value={filters.date_start}
              onChange={(event) => updateFilter("date_start", event.target.value)}
            />
          </label>
          <label className="da-form-field">
            <span>Tanggal Sampai</span>
            <input
              type="date"
              value={filters.date_end}
              onChange={(event) => updateFilter("date_end", event.target.value)}
            />
          </label>
          <label className="da-form-field">
            <span>Lokasi</span>
            <select
              value={filters.location_id}
              onChange={(event) => updateFilter("location_id", event.target.value)}
            >
              <option value="ALL">Semua Lokasi</option>
              {locationOptions.map((loc) => (
                <option key={loc.location_id || loc.id || loc.code} value={loc.location_id || loc.id || loc.code}>
                  {loc.location_name || loc.name || loc.label || loc.location_id}
                </option>
              ))}
            </select>
          </label>
          <div className="da-form-actions">
            <Button type="submit" disabled={loading}>{loading ? "Menarik..." : "Tarik Data Periode"}</Button>
            <Button type="button" variant="secondary" onClick={printOwnerReport}>Cetak A4</Button>
            <Button type="button" variant={isLocked ? "secondary" : "primary"} disabled={loading || locking || isLocked} onClick={handleLockPeriod}>
              {locking ? "Menyimpan..." : isLocked ? "Sudah Lock" : "Lock / Simpan Snapshot"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="da-section-title-row">
          <div>
            <h2>Status Closing Periode</h2>
            <p className="da-muted">
              Lock closing hanya menyimpan snapshot laporan. Tidak membuat uang keluar/masuk dan tidak mengubah 4 Amplop.
            </p>
          </div>
          <Badge tone={isLocked ? "success" : rowsWithoutSource > 0 ? "danger" : "warning"}>
            {isLocked ? "Periode Sudah Lock" : rowsWithoutSource > 0 ? "Perlu Rapih Sumber" : "Siap Dicek"}
          </Badge>
        </div>
        <div className="da-stat-grid">
          <StatCard label="Closing ID" value={text(currentClosing?.closing_id || summary.closing_id)} description="ID snapshot periode." />
          <StatCard label="Perlu Sumber" value={rowsWithoutSource.toLocaleString("id-ID")} description="Harus 0 sebelum lock." tone={rowsWithoutSource > 0 ? "danger" : "success"} />
          <StatCard label="Jumlah Jejak" value={number(summary.records_count).toLocaleString("id-ID")} description="Record sumber yang ikut dibaca." />
          <StatCard label="Status" value={isLocked ? "LOCKED" : "DRAFT"} description="Status laporan periode." tone={isLocked ? "success" : "warning"} />
        </div>
      </Card>

      <Card>
        <div className="da-section-title-row">
          <div>
            <h2>Revisi / Catatan Setelah Lock</h2>
            <p className="da-muted">
              Setelah periode dikunci, angka tidak diedit langsung. Catat alasan revisi di sini, lalu koreksi transaksi dari modul sumber.
            </p>
          </div>
          <Badge tone={isLocked ? "warning" : "default"}>{isLocked ? "Audit Revisi" : "Menunggu Lock"}</Badge>
        </div>
        <form className="da-form-grid" onSubmit={handleCreateRevision}>
          <label className="da-form-field">
            <span>Jenis Catatan</span>
            <select
              value={revisionDraft.revision_type}
              onChange={(event) => setRevisionDraft((old) => ({ ...old, revision_type: event.target.value }))}
              disabled={!isLocked || revisionSaving}
            >
              <option value="CATATAN_REVISI">Catatan Revisi</option>
              <option value="PERLU_KOREKSI_SUMBER">Perlu Koreksi Sumber</option>
              <option value="BUKA_PANTAUAN">Buka Pantauan Owner</option>
            </select>
          </label>
          <label className="da-form-field da-form-field-wide">
            <span>Alasan / Catatan</span>
            <input
              value={revisionDraft.reason}
              onChange={(event) => setRevisionDraft((old) => ({ ...old, reason: event.target.value }))}
              placeholder="Contoh: ada kas keluar yang belum masuk periode ini, koreksi dilakukan dari Belanja & Kas Keluar."
              disabled={!isLocked || revisionSaving}
            />
          </label>
          <div className="da-form-actions">
            <Button type="submit" disabled={!isLocked || revisionSaving}>
              {revisionSaving ? "Menyimpan..." : "Simpan Catatan Revisi"}
            </Button>
          </div>
        </form>
        {!isLocked ? (
          <div className="da-form-info">Catatan revisi baru aktif setelah periode dikunci/snapshot tersimpan.</div>
        ) : null}
        <DataTable
          rows={closingRevisions}
          getRowKey={(row, index) => row.revision_id || index}
          columns={[
            { key: "created_at", label: "Tanggal", render: (row) => text(row.created_at || row.date) },
            { key: "revision_id", label: "Revision ID", render: (row) => <strong>{text(row.revision_id)}</strong> },
            { key: "revision_type", label: "Jenis", render: (row) => text(row.revision_type) },
            { key: "reason", label: "Catatan", render: (row) => text(row.reason || row.note) },
            { key: "status", label: "Status", render: (row) => <Badge tone="warning">{text(row.status || "OPEN")}</Badge> },
          ]}
        />
      </Card>

      <Card className="da-print-area">
        <div className="da-section-title-row">
          <div>
            <h2>Ringkasan Owner</h2>
            <p className="da-muted">Periode: {periodLabel}</p>
          </div>
          <Badge tone={isLocked ? "success" : "warning"}>{isLocked ? "Sudah Lock Closing" : "Belum Lock Closing"}</Badge>
        </div>
        <div className="da-stat-grid">
          <StatCard label="Uang Masuk Aktual" value={formatRupiah(summary.money_in_actual)} description="Dari mutasi dompet IN." tone="success" />
          <StatCard label="Uang Keluar Aktual" value={formatRupiah(summary.money_out_actual)} description="Kas keluar, gaji, hutang, kewajiban." tone="danger" />
          <StatCard label="Sisa Piutang" value={formatRupiah(summary.open_receivables)} description="Belum jadi uang masuk." />
          <StatCard label="Sisa Hutang Nana" value={formatRupiah(summary.hutang_nana_open)} description="Nota ayam belum lunas." tone="warning" />
        </div>
        <div className="da-stat-grid">
          <StatCard label="Kewajiban Owner" value={formatRupiah(summary.owner_obligation_remaining)} description="Sisa cicilan/tagihan usaha." tone="warning" />
          <StatCard label="Payroll Belum Dibayar" value={formatRupiah(summary.payroll_unpaid)} description="Draft/closing belum keluar uang." />
          <StatCard label="Sisa Ayam" value={formatKg(summary.chicken_remaining_kg)} description="Lot ayam aktif." />
          <StatCard label="Stok Ready" value={formatPcs(summary.finished_stock_ready_pcs)} description="Stok jadi bebas/ready." tone="success" />
        </div>
      </Card>

      <div className="da-two-column-grid">
        <Card>
          <div className="da-section-title-row">
            <div>
              <h2>Alur Uang Periode</h2>
              <p className="da-muted">Uang masuk/keluar yang sudah punya sumber.</p>
            </div>
          </div>
          <DataTable
            rows={moneyRows}
            getRowKey={(row, index) => row.id || `${row.type}-${index}`}
            columns={[
              { key: "label", label: "Kategori" },
              { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
              { key: "count", label: "Jumlah" },
              { key: "note", label: "Catatan", render: (row) => text(row.note) },
            ]}
          />
        </Card>

        <Card>
          <div className="da-section-title-row">
            <div>
              <h2>Stok & Modal</h2>
              <p className="da-muted">Pantauan ayam, produksi, dan stok jadi.</p>
            </div>
          </div>
          <DataTable
            rows={stockRows}
            getRowKey={(row, index) => row.id || `${row.label}-${index}`}
            columns={[
              { key: "label", label: "Bagian" },
              { key: "qty", label: "Qty", render: (row) => row.unit === "kg" ? formatKg(row.qty) : formatPcs(row.qty) },
              { key: "amount", label: "Nilai", render: (row) => row.amount ? formatRupiah(row.amount) : "-" },
            ]}
          />
        </Card>
      </div>

      <Card>
        <div className="da-section-title-row">
          <div>
            <h2>Kewajiban & Payroll</h2>
            <p className="da-muted">Tagihan owner, hutang, dan gaji yang perlu dipantau.</p>
          </div>
        </div>
        <DataTable
          rows={obligationRows}
          getRowKey={(row, index) => row.id || `${row.label}-${index}`}
          columns={[
            { key: "label", label: "Bagian" },
            { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
            { key: "count", label: "Jumlah" },
            { key: "status", label: "Status", render: (row) => <Badge tone={row.tone || "default"}>{text(row.status)}</Badge> },
          ]}
        />
      </Card>

      <Card>
        <div className="da-section-title-row">
          <div>
            <h2>Catatan Tindakan Owner</h2>
            <p className="da-muted">Sistem memberi sinyal dari data hidup, bukan angka dummy.</p>
          </div>
        </div>
        <DataTable
          rows={actionRows}
          getRowKey={(row, index) => row.key || index}
          columns={[
            { key: "priority", label: "Prioritas", render: (row) => <Badge tone={row.tone || "default"}>{text(row.priority)}</Badge> },
            { key: "title", label: "Tindakan" },
            { key: "note", label: "Catatan" },
          ]}
        />
      </Card>

      <Card>
        <div className="da-section-title-row">
          <div>
            <h2>Jejak Transaksi Terbaru</h2>
            <p className="da-muted">Dipakai untuk cek sumber sebelum periode dikunci.</p>
          </div>
          <Badge tone={rowsWithoutSource > 0 ? "warning" : "success"}>
            Perlu Sumber: {rowsWithoutSource}
          </Badge>
        </div>
        <DataTable
          rows={records}
          getRowKey={(row, index) => row.source_id || row.id || index}
          columns={[
            { key: "date", label: "Tanggal", render: (row) => formatDate(row.date || row.created_at) },
            { key: "source_module", label: "Modul", render: (row) => text(row.source_module) },
            { key: "source_id", label: "ID", render: (row) => <strong>{text(row.source_id || row.id)}</strong> },
            { key: "title", label: "Keterangan", render: (row) => text(row.title || row.description || row.note) },
            { key: "amount", label: "Nominal", render: (row) => row.amount ? formatRupiah(row.amount) : "-" },
          ]}
        />
      </Card>

      <Card>
        <div className="da-section-title-row">
          <div>
            <h2>Riwayat Snapshot / Lock Periode</h2>
            <p className="da-muted">Snapshot yang sudah tersimpan tidak mengubah transaksi lama, hanya mengunci laporan periode.</p>
          </div>
        </div>
        <DataTable
          rows={periodClosings}
          getRowKey={(row, index) => row.closing_id || row.source_id || index}
          columns={[
            { key: "date_start", label: "Periode", render: (row) => `${formatDate(row.date_start)} - ${formatDate(row.date_end)}` },
            { key: "closing_id", label: "Closing ID", render: (row) => <strong>{text(row.closing_id || row.source_id)}</strong> },
            { key: "location_id", label: "Lokasi", render: (row) => text(row.location_id || row.location) },
            { key: "money_in_actual", label: "Uang Masuk", render: (row) => formatRupiah(row.money_in_actual || row.amount) },
            { key: "status", label: "Status", render: (row) => <Badge tone="success">{text(row.status || "LOCKED")}</Badge> },
          ]}
        />
      </Card>

      <FinanceLockPanel session={session} onSessionExpired={onSessionExpired} compact />

      <Card>
        <p className="da-muted">
          Catatan: Lock closing owner hanya menyimpan snapshot angka periode ke arsip closing. Transaksi kas, stok, hutang, payroll, dan 4 Amplop tetap berasal dari modul aslinya masing-masing.
        </p>
      </Card>
    </div>
  );
}
