import { useEffect, useMemo, useState } from "react";
import {
  approveBranchDailyReport,
  getDailyReportBootstrap,
  rejectBranchDailyReport,
  submitBranchDailyReport,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";

const asArray = (value) => (Array.isArray(value) ? value : []);
const numberValue = (value) => {
  const parsed = Number(String(value ?? 0).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeText = (value, fallback = "-") => String(value || "").trim() || fallback;
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const authRequired = (result) => {
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || message.includes("AUTH_REQUIRED") || (message.includes("SESSION") && message.includes("TIDAK AKTIF"));
};
const statusTone = (status) => {
  const value = String(status || "").toUpperCase();
  if (["APPROVED", "SETTLED"].includes(value)) return "success";
  if (["REJECTED", "CANCELLED"].includes(value)) return "danger";
  return "warning";
};

function normalizeRow(row = {}) {
  return {
    ...row,
    id: row.id || row.source_id || row.transaction_id || "",
    date: row.date || row.source_date || row.created_at || "",
    module: row.module || row.source_module || "Transaksi",
    category: row.category || "LAINNYA",
    description: row.description || row.notes || "-",
    method: row.method || row.payment_method || "-",
    amount: numberValue(row.amount),
    status: row.status || row.source_status || "Tercatat",
  };
}

function normalizeReport(row = {}) {
  return {
    ...row,
    report_id: row.report_id || row.id || "",
    location_code: row.location_code || row.location_id || "",
    location_name: row.location_name || row.location_code || "",
    period_label: row.date_start === row.date_end ? row.date_start : `${row.date_start || "-"} s/d ${row.date_end || "-"}`,
    expected_deposit: numberValue(row.expected_deposit),
    approved_deposit_amount: numberValue(row.approved_deposit_amount),
    pending_deposit_amount: numberValue(row.pending_deposit_amount),
    items: asArray(row.items).map(normalizeRow),
  };
}

function normalizeBootstrap(payload) {
  const data = payload?.data || payload || {};
  const summary = data.summary || {};
  return {
    health: data.health || {},
    locations: asArray(data.locations),
    summary: {
      ...summary,
      sales_total: numberValue(summary.sales_total),
      total_cash_in: numberValue(summary.total_cash_in),
      total_transfer_in: numberValue(summary.total_transfer_in),
      total_other_in: numberValue(summary.total_other_in),
      total_income: numberValue(summary.total_income),
      total_expense: numberValue(summary.total_expense),
      total_receivable: numberValue(summary.total_receivable),
      estimated_cash_to_deposit: numberValue(summary.estimated_cash_to_deposit),
      transaction_count: numberValue(summary.transaction_count),
    },
    categories: asArray(data.categories).map((category) => ({
      ...category,
      amount: numberValue(category.amount),
      count: numberValue(category.count),
      rows: asArray(category.rows).map(normalizeRow),
    })),
    recent: asArray(data.recent_transactions).map(normalizeRow),
    warnings: asArray(data.warnings),
    reports: asArray(data.reports).map(normalizeReport),
  };
}

const SOURCE_COLUMNS = [
  { key: "date", label: "Tanggal" },
  { key: "module", label: "Sumber" },
  { key: "id", label: "ID", render: (row) => <strong>{safeText(row.id)}</strong> },
  { key: "description", label: "Keterangan" },
  { key: "method", label: "Cara Bayar/Dompet" },
  { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
  { key: "status", label: "Status" },
];

const REPORT_COLUMNS = [
  { key: "report_date", label: "Tanggal" },
  { key: "report_id", label: "Laporan ID", render: (row) => <strong>{row.report_id}</strong> },
  { key: "location_code", label: "Cabang" },
  { key: "period_label", label: "Periode" },
  { key: "expected_deposit", label: "Estimasi Setoran", render: (row) => formatRupiah(row.expected_deposit) },
  { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{safeText(row.status)}</Badge> },
];

export default function LaporanHarianPage({ session, onSessionExpired }) {
  const currentDate = today();
  const [filter, setFilter] = useState({
    report_mode: "daily",
    report_date: currentDate,
    date_start: currentDate,
    date_end: currentDate,
    location_code: session?.user?.location_code || "TGR",
  });
  const [data, setData] = useState(() => normalizeBootstrap({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const token = session?.sessionToken || "";
  const roleId = String(session?.user?.role_id || "").toUpperCase();
  const canApprove = roleId === "ROLE-OWNER" || roleId === "ROLE-HO-ADMIN";

  const requestPayload = useMemo(() => ({
    ...filter,
    report_date: filter.report_mode === "period" ? filter.date_start : filter.report_date,
    date_start: filter.report_mode === "period" ? filter.date_start : filter.report_date,
    date_end: filter.report_mode === "period" ? filter.date_end : filter.report_date,
  }), [filter]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getDailyReportBootstrap(token, requestPayload);
      if (authRequired(result)) return onSessionExpired?.();
      if (!result?.success) return setError(result?.message || "Gagal membaca laporan cabang.");
      setData(normalizeBootstrap(result.data || result));
    } catch (err) {
      setError(err?.message || "Gagal membaca laporan cabang.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const submitReport = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const result = await submitBranchDailyReport(token, {
        ...requestPayload,
        notes: "Closing cabang dari transaksi hidup. Tidak ada input transaksi manual.",
      });
      if (authRequired(result)) return onSessionExpired?.();
      if (!result?.success) return setError(result?.message || "Laporan gagal disubmit.");
      setSuccess(result?.message || "Laporan berhasil disubmit.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Laporan gagal disubmit.");
    } finally { setSaving(false); }
  };

  const processReport = async (action) => {
    if (!selectedReport) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const fn = action === "approve" ? approveBranchDailyReport : rejectBranchDailyReport;
      const result = await fn(token, {
        report_id: selectedReport.report_id,
        notes: action === "approve" ? "Laporan telah diperiksa Tangerang." : "Perlu revisi/cek ulang transaksi sumber.",
        reason: action === "reject" ? "Perlu revisi/cek ulang transaksi sumber." : "",
      });
      if (authRequired(result)) return onSessionExpired?.();
      if (!result?.success) return setError(result?.message || "Status laporan gagal diperbarui.");
      setSuccess(result?.message || "Status laporan berhasil diperbarui.");
      setSelectedReport(null);
      await loadData();
    } catch (err) {
      setError(err?.message || "Status laporan gagal diperbarui.");
    } finally { setSaving(false); }
  };

  return (
    <div className="da-page-stack">
      <PageHeader title="Laporan Harian" description="Transaksi order, pembayaran, uang keluar, dan piutang ditarik otomatis. Halaman ini tidak dipakai untuk input pengeluaran atau penjualan ulang." badge="PHP/MySQL Auto Pull" />

      <Card>
        <div className="da-card-header-row">
          <div>
            <div className="da-section-kicker">Closing Cabang</div>
            <h2>Transaksi Hidup → Ringkasan → Submit Tangerang</h2>
            <p className="da-muted">Laporan adalah snapshot yang dapat ditelusuri ke ID transaksi sumber. Submit laporan tidak mengubah saldo dompet.</p>
          </div>
          <div className="da-card-actions">
            <Badge tone={data.health?.ready ? "success" : "danger"}>{data.health?.ready ? "Closing Live Ready" : "Migration 020 Belum Siap"}</Badge>
            <Button variant="ghost" onClick={loadData} disabled={loading}>{loading ? "Menarik..." : "Refresh Data"}</Button>
          </div>
        </div>
        <div className="da-detail-grid" style={{ marginTop: 16 }}>
          <label className="da-detail-box"><strong>Mode</strong><select value={filter.report_mode} onChange={(e) => setFilter((v) => ({ ...v, report_mode: e.target.value }))}><option value="daily">Harian</option><option value="period">Periode</option></select></label>
          {filter.report_mode === "period" ? <>
            <label className="da-detail-box"><strong>Mulai</strong><input type="date" value={filter.date_start} onChange={(e) => setFilter((v) => ({ ...v, date_start: e.target.value }))} /></label>
            <label className="da-detail-box"><strong>Sampai</strong><input type="date" value={filter.date_end} onChange={(e) => setFilter((v) => ({ ...v, date_end: e.target.value }))} /></label>
          </> : <label className="da-detail-box"><strong>Tanggal</strong><input type="date" value={filter.report_date} onChange={(e) => setFilter((v) => ({ ...v, report_date: e.target.value }))} /></label>}
          <label className="da-detail-box"><strong>Lokasi</strong><select value={filter.location_code} onChange={(e) => setFilter((v) => ({ ...v, location_code: e.target.value }))}>{data.locations.length === 0 ? <option value={filter.location_code}>{filter.location_code}</option> : data.locations.map((loc) => <option key={loc.location_id} value={loc.location_code}>{loc.location_name} · {loc.location_code}</option>)}</select></label>
        </div>
        <div className="da-form-actions">
          <Button variant="ghost" onClick={loadData} disabled={loading}>Tarik Transaksi</Button>
          <Button variant="primary" onClick={submitReport} disabled={saving || loading || !data.health?.ready}>{saving ? "Menyimpan..." : "Submit Laporan Cabang"}</Button>
        </div>
        {error ? <div className="da-form-warning">{error}</div> : null}
        {success ? <div className="da-form-success">{success}</div> : null}
      </Card>

      <div className="da-grid da-grid-3">
        <StatCard label="Penjualan" value={formatRupiah(data.summary.sales_total)} description="Nilai order; belum tentu seluruhnya sudah menjadi uang." />
        <StatCard label="Uang Masuk Aktual" value={formatRupiah(data.summary.total_income)} description="Pembayaran dan mutasi IN lokasi." tone="success" />
        <StatCard label="Uang Keluar" value={formatRupiah(data.summary.total_expense)} description="Mutasi OUT operasional, bukan setoran." tone="warning" />
        <StatCard label="Estimasi Setoran" value={formatRupiah(data.summary.estimated_cash_to_deposit)} description="Uang masuk dikurangi uang keluar pada periode." />
        <StatCard label="Piutang Terbuka" value={formatRupiah(data.summary.total_receivable)} description="Sisa tagihan customer dari periode ini." tone="warning" />
        <StatCard label="Transaksi Sumber" value={data.summary.transaction_count} description="Baris sumber yang dapat diaudit." />
      </div>

      <Card>
        <div className="da-card-header-row"><div><div className="da-section-kicker">Ringkasan Otomatis</div><h2>Kategori Laporan</h2><p className="da-muted">Klik kartu untuk membuka transaksi sumber.</p></div><Badge tone="success">Read Only</Badge></div>
        <div className="da-action-grid" style={{ marginTop: 16 }}>{data.categories.map((category) => <button type="button" className="da-action-card" key={category.key} onClick={() => setSelectedCategory(category)}><div className="da-action-card-top"><Badge>{category.count} baris</Badge><span className="da-action-arrow">›</span></div><div className="da-action-value">{category.title}</div><div className="da-action-desc">{category.description}</div><strong>{formatRupiah(category.amount)}</strong></button>)}</div>
      </Card>

      <Card>
        <div className="da-card-header-row"><div><div className="da-section-kicker">Riwayat Closing</div><h2>Laporan Cabang yang Tercatat</h2><p className="da-muted">Klik laporan untuk melihat snapshot dan validasi Tangerang.</p></div><Badge tone="success">Live Data</Badge></div>
        <DataTable columns={REPORT_COLUMNS} rows={data.reports} getRowKey={(row) => row.report_id} onRowClick={setSelectedReport} />
      </Card>

      <Modal open={Boolean(selectedCategory)} title={selectedCategory?.title || "Transaksi Sumber"} subtitle={`${selectedCategory?.count || 0} baris · ${formatRupiah(selectedCategory?.amount || 0)}`} onClose={() => setSelectedCategory(null)}><DataTable columns={SOURCE_COLUMNS} rows={selectedCategory?.rows || []} getRowKey={(row, index) => `${row.module}-${row.id}-${index}`} /></Modal>

      <Modal open={Boolean(selectedReport)} title="Detail Laporan Cabang" subtitle={selectedReport?.report_id || ""} onClose={() => setSelectedReport(null)}>
        <div className="da-detail-grid" style={{ marginBottom: 16 }}><div className="da-detail-box"><strong>Cabang</strong><p>{selectedReport?.location_name}</p></div><div className="da-detail-box"><strong>Periode</strong><p>{selectedReport?.period_label}</p></div><div className="da-detail-box"><strong>Estimasi Setoran</strong><p>{formatRupiah(selectedReport?.expected_deposit || 0)}</p></div><div className="da-detail-box"><strong>Status</strong><p><Badge tone={statusTone(selectedReport?.status)}>{selectedReport?.status}</Badge></p></div></div>
        <DataTable columns={SOURCE_COLUMNS} rows={selectedReport?.items || []} getRowKey={(row, index) => `${row.source_module}-${row.source_id}-${index}`} />
        {canApprove && String(selectedReport?.status).toUpperCase() === "SUBMITTED" ? <div className="da-form-actions"><Button variant="ghost" onClick={() => processReport("reject")} disabled={saving}>Tolak / Revisi</Button><Button variant="primary" onClick={() => processReport("approve")} disabled={saving}>Setujui Laporan</Button></div> : null}
      </Modal>
    </div>
  );
}
