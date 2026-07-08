import { useEffect, useMemo, useState } from "react";
import { getOwnerPeriodReportBootstrap } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
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

function formatKg(value) {
  return `${number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg`;
}

function formatPcs(value) {
  return `${number(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })} pcs`;
}

function printOwnerReport() {
  window.print();
}

export default function ClosingOwnerPage({ session, onSessionExpired }) {
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
  const health = data.health || {};
  const sections = data.sections || {};
  const records = data.recent_records || [];
  const locationOptions = data.location_options || [];

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
    loadData(filters);
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
            Tarik data periode dari transaksi hidup. Part ini masih read-only: belum mengunci periode dan belum membuat transaksi baru.
          </p>
        </div>
        <Badge tone={loading ? "warning" : error ? "danger" : "success"}>
          {loading ? "Membaca" : error ? "Perlu Cek" : "Terhubung"}
        </Badge>
      </section>

      {error ? <div className="da-form-error">{error}</div> : null}

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
          </div>
        </form>
      </Card>

      <Card className="da-print-area">
        <div className="da-section-title-row">
          <div>
            <h2>Ringkasan Owner</h2>
            <p className="da-muted">Periode: {periodLabel}</p>
          </div>
          <Badge tone="warning">Belum Lock Closing</Badge>
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
            <p className="da-muted">Dipakai untuk cek sumber sebelum nanti periode dikunci.</p>
          </div>
          <Badge tone={number(health.rows_without_source) > 0 ? "warning" : "success"}>
            Perlu Sumber: {number(health.rows_without_source)}
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
        <p className="da-muted">
          Catatan: Part 5M ini hanya menarik dan mencetak laporan owner. Lock closing, snapshot periode, dan koreksi setelah closing disambungkan di part berikutnya supaya aman dan tidak mengunci data terlalu cepat.
        </p>
      </Card>
    </div>
  );
}
