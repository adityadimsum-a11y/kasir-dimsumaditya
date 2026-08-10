import { AlertCircle, ArrowRight, Banknote, CheckCircle2, FileText, RefreshCw, Send, Store, Wallet } from "lucide-react";
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
import BranchFlowButton from "./BranchFlowButton";

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
const BRANCH_LOCATION_KEY = "da_branch_last_location";
const readStoredBranchLocation = () => {
  try { return typeof window !== "undefined" ? String(window.localStorage.getItem(BRANCH_LOCATION_KEY) || "") : ""; } catch { return ""; }
};
const storeBranchLocation = (value) => {
  try { if (typeof window !== "undefined" && value) window.localStorage.setItem(BRANCH_LOCATION_KEY, value); } catch {}
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
const statusLabel = (status) => {
  const value = String(status || "").toUpperCase();
  if (value === "SUBMITTED") return "Menunggu Review Pusat";
  if (value === "APPROVED") return "Disetujui";
  if (value === "REJECTED") return "Perlu Revisi";
  if (value === "PARTIAL") return "Setoran Sebagian";
  if (value === "SETTLED") return "Selesai";
  return safeText(status, "Belum Dikirim");
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
      total_central_in: numberValue(summary.total_central_in),
      total_merchant_pending: numberValue(summary.total_merchant_pending),
      depositable_income: numberValue(summary.depositable_income),
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
    activeReport: data.active_report ? normalizeReport(data.active_report) : null,
  };
}

const SOURCE_COLUMNS = [
  { key: "date", label: "Tanggal" },
  { key: "module", label: "Sumber" },
  { key: "id", label: "ID", render: (row) => <strong>{safeText(row.id)}</strong> },
  { key: "description", label: "Keterangan" },
  { key: "method", label: "Cara Bayar / Dompet" },
  { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
  { key: "status", label: "Status" },
];

const REPORT_COLUMNS = [
  { key: "report_date", label: "Tanggal" },
  { key: "report_id", label: "Laporan ID", render: (row) => <strong>{row.report_id}</strong> },
  { key: "location_code", label: "Cabang" },
  { key: "period_label", label: "Periode" },
  { key: "expected_deposit", label: "Setoran", render: (row) => formatRupiah(row.expected_deposit) },
  { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge> },
];

function statusMessage(report) {
  const status = String(report?.status || "").toUpperCase();
  if (status === "SUBMITTED") return { tone: "warning", title: "Menunggu pemeriksaan Tangerang", text: "Snapshot sudah dikirim. Transaksi sumber akan diperiksa sebelum periode dikunci." };
  if (status === "APPROVED") return { tone: "success", title: "Laporan sudah disetujui", text: "Periode cabang sudah dikunci. Laporan ini dapat dilanjutkan ke Setoran Cabang." };
  if (status === "PARTIAL") return { tone: "warning", title: "Setoran belum lengkap", text: "Sebagian setoran sudah diterima pusat dan masih ada sisa yang perlu diselesaikan." };
  if (status === "SETTLED") return { tone: "success", title: "Laporan selesai", text: "Laporan dan setoran sudah selesai diproses." };
  if (status === "REJECTED") return { tone: "danger", title: "Perlu perbaikan", text: report?.rejection_reason || "Periksa transaksi sumber lalu kirim ulang laporan." };
  return { tone: "default", title: "Belum dikirim", text: "Tarik transaksi hari ini, periksa ringkasan, lalu kirim laporan ke pusat." };
}

export default function LaporanHarianPage({ session, onSessionExpired, onNavigate }) {
  const currentDate = today();
  const roleId = String(session?.user?.role_id || "").toUpperCase();
  const canApprove = roleId === "ROLE-OWNER" || roleId === "ROLE-HO-ADMIN";
  const defaultLocation = canApprove ? readStoredBranchLocation() : (session?.user?.location_code || "");
  const [filter, setFilter] = useState({
    report_mode: "daily",
    report_date: currentDate,
    date_start: currentDate,
    date_end: currentDate,
    location_code: defaultLocation,
  });
  const [data, setData] = useState(() => normalizeBootstrap({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const token = session?.sessionToken || "";

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
      const next = normalizeBootstrap(result.data || result);
      setData(next);
      if (!filter.location_code && next.summary.location_code) {
        setFilter((value) => ({ ...value, location_code: next.summary.location_code }));
        storeBranchLocation(next.summary.location_code);
      }
    } catch (err) {
      setError(err?.message || "Gagal membaca laporan cabang.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const submitReport = async () => {
    if (canApprove) {
      setSuccess("");
      setError("Laporan cabang harus dikirim oleh akun cabang. Owner/HO hanya melakukan review dan persetujuan.");
      return;
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      const result = await submitBranchDailyReport(token, {
        ...requestPayload,
        notes: "Laporan cabang dibuat dari transaksi sumber pada periode yang dipilih.",
      });
      if (authRequired(result)) return onSessionExpired?.();
      if (!result?.success) return setError(result?.message || "Laporan gagal dikirim.");
      setSuccess(result?.message || "Laporan berhasil dikirim ke Tangerang.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Laporan gagal dikirim.");
    } finally { setSaving(false); }
  };

  const processReport = async (action) => {
    if (!selectedReport) return;
    if (action === "reject" && reviewNote.trim() === "") {
      setError("Tuliskan alasan revisi agar cabang tahu bagian yang perlu diperbaiki.");
      return;
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      const fn = action === "approve" ? approveBranchDailyReport : rejectBranchDailyReport;
      const result = await fn(token, {
        report_id: selectedReport.report_id,
        notes: reviewNote.trim() || "Laporan telah diperiksa Owner/HO Tangerang.",
        reason: action === "reject" ? reviewNote.trim() : "",
      });
      if (authRequired(result)) return onSessionExpired?.();
      if (!result?.success) return setError(result?.message || "Status laporan gagal diperbarui.");
      setSuccess(result?.message || "Status laporan berhasil diperbarui.");
      setSelectedReport(null);
      setReviewNote("");
      await loadData();
    } catch (err) {
      setError(err?.message || "Status laporan gagal diperbarui.");
    } finally { setSaving(false); }
  };

  const currentReport = data.reports[0] || data.activeReport || null;
  const baseWorkflow = statusMessage(currentReport);
  const workflow = canApprove && !currentReport
    ? { tone: "default", title: "Menunggu laporan cabang", text: "Belum ada laporan yang dikirim oleh cabang untuk periode ini. Data transaksi tetap dapat dipantau tanpa membuat laporan atas nama cabang." }
    : canApprove && String(currentReport?.status || "").toUpperCase() === "SUBMITTED"
      ? { tone: "warning", title: "Siap direview", text: "Laporan sudah dikirim oleh cabang dan menunggu keputusan Owner/HO." }
      : baseWorkflow;
  const periodLabel = data.summary.period_label || requestPayload.date_start;
  const currentStatus = String(currentReport?.status || "").toUpperCase();
  const selectedLocationName = safeText(data.summary.location_name, "Cabang");
  const workflowIndex = currentStatus === "SETTLED" ? 5
    : currentStatus === "PARTIAL" ? 4
      : currentStatus === "APPROVED" ? 3
        : currentStatus === "SUBMITTED" ? 2
          : currentStatus === "REJECTED" ? 2
            : data.summary.transaction_count > 0 ? 1 : 0;
  const workflowSteps = [
    { label: "Transaksi", hint: "Sumber tercatat" },
    { label: "Ringkasan", hint: "Siap diperiksa" },
    { label: "Review", hint: currentStatus === "REJECTED" ? "Perlu revisi" : "Pusat memeriksa" },
    { label: "Disetujui", hint: "Periode dikunci" },
    { label: "Setoran", hint: currentStatus === "PARTIAL" ? "Sebagian" : "Dana dikirim" },
    { label: "Selesai", hint: "Dana diterima" },
  ];

  const ownerHeaderTitle = selectedLocationName !== "Cabang"
    ? `Laporan Harian — ${selectedLocationName}`
    : "Laporan Harian Cabang";

  const headerTitle = canApprove ? ownerHeaderTitle : "Laporan Harian";
  const headerDescription = canApprove
    ? `Pantau dan review ringkasan operasional ${selectedLocationName}. Laporan dikirim oleh akun cabang; Owner/HO tidak membuat laporan atas nama cabang.`
    : "Ringkas transaksi operasional periode ini dan kirim laporan ke pusat untuk direview.";

  const renderPrimaryAction = () => {
    if (canApprove) {
      if (currentStatus === "SUBMITTED") {
        return (
          <Button variant="primary" onClick={() => { setSelectedReport(currentReport); setReviewNote(""); }} disabled={saving || loading}>
            <FileText size={16} /> Review Laporan
          </Button>
        );
      }
      if (["APPROVED", "PARTIAL"].includes(currentStatus) && onNavigate) {
        return (
          <Button variant="primary" onClick={() => onNavigate("setoran-cabang")} disabled={loading}>
            Lanjut ke Setoran <ArrowRight size={16} />
          </Button>
        );
      }
      if (currentStatus === "SETTLED") {
        return (
          <Button variant="ghost" disabled>
            <CheckCircle2 size={16} /> Laporan Selesai
          </Button>
        );
      }
      if (currentStatus === "REJECTED") {
        return (
          <Button variant="ghost" disabled>
            <AlertCircle size={16} /> Menunggu Perbaikan Cabang
          </Button>
        );
      }
      return (
        <Button variant="ghost" disabled>
          <FileText size={16} /> Menunggu Laporan Cabang
        </Button>
      );
    }

    if (currentStatus === "SUBMITTED") {
      return (
        <Button variant="ghost" disabled>
          <FileText size={16} /> Menunggu Review Pusat
        </Button>
      );
    }
    if (["APPROVED", "PARTIAL"].includes(currentStatus) && onNavigate) {
      return (
        <Button variant="primary" onClick={() => onNavigate("setoran-cabang")} disabled={loading}>
          Lanjut ke Setoran <ArrowRight size={16} />
        </Button>
      );
    }
    if (currentStatus === "SETTLED") {
      return (
        <Button variant="ghost" disabled>
          <CheckCircle2 size={16} /> Laporan Selesai
        </Button>
      );
    }
    return (
      <Button
        variant="primary"
        onClick={submitReport}
        disabled={saving || loading || !data.health?.ready || data.locations.length === 0}
      >
        <Send size={16} /> {saving ? "Mengirim..." : "Kirim Laporan ke Pusat"}
      </Button>
    );
  };

  return (
    <div className="da-page-stack da-branch-page">
      <PageHeader
        title={headerTitle}
        description={headerDescription}
        eyebrow={canApprove ? "Cabang · Review Pusat" : "Cabang · Laporan Harian"}
        actions={<>
          <BranchFlowButton current="report" onNavigate={onNavigate} />
          <Button variant="ghost" onClick={loadData} disabled={loading}><RefreshCw size={16} /> {loading ? "Memuat..." : "Perbarui"}</Button>
          {renderPrimaryAction()}
        </>}
      />

      <div className="da-branch-filterbar">
        <label><span>Mode</span><select value={filter.report_mode} onChange={(e) => setFilter((v) => ({ ...v, report_mode: e.target.value }))}><option value="daily">Harian</option><option value="period">Periode</option></select></label>
        {filter.report_mode === "period" ? <>
          <label><span>Mulai</span><input type="date" value={filter.date_start} onChange={(e) => setFilter((v) => ({ ...v, date_start: e.target.value }))} /></label>
          <label><span>Sampai</span><input type="date" value={filter.date_end} onChange={(e) => setFilter((v) => ({ ...v, date_end: e.target.value }))} /></label>
        </> : <label><span>Tanggal</span><input type="date" value={filter.report_date} onChange={(e) => setFilter((v) => ({ ...v, report_date: e.target.value }))} /></label>}
        <label className="da-branch-filter-location"><span>{canApprove ? "Cabang" : "Lokasi Anda"}</span><select value={filter.location_code} onChange={(e) => { const code = e.target.value; setFilter((v) => ({ ...v, location_code: code })); storeBranchLocation(code); }} disabled={!canApprove}>{data.locations.length === 0 ? <option value="">Belum ada cabang aktif</option> : data.locations.map((loc) => <option key={loc.location_id} value={loc.location_code}>{loc.location_name} · {loc.location_code}</option>)}</select></label>
        <Button variant="ghost" onClick={loadData} disabled={loading}>Terapkan</Button>
      </div>

      {error ? <div className="da-form-warning">{error}</div> : null}
      {success ? <div className="da-form-success">{success}</div> : null}

      <section className="da-branch-command">
        <div className="da-branch-command-main">
          <div className="da-branch-command-kicker"><Store size={15} /> {safeText(data.summary.location_name, "Cabang")}</div>
          <span>Dana cabang yang perlu disetor</span>
          <strong>{formatRupiah(data.summary.estimated_cash_to_deposit)}</strong>
          <p>{periodLabel} · dihitung dari dana yang benar-benar berada di dompet cabang setelah pengeluaran periode.</p>
        </div>
        <div className="da-branch-command-metrics">
          <div><span>Penjualan</span><strong>{formatRupiah(data.summary.sales_total)}</strong></div>
          <div><span>Sudah di Pusat</span><strong>{formatRupiah(data.summary.total_central_in)}</strong></div>
          <div><span>Merchant Pending</span><strong>{formatRupiah(data.summary.total_merchant_pending)}</strong></div>
          <div><span>Piutang Akhir Periode</span><strong>{formatRupiah(data.summary.total_receivable)}</strong></div>
        </div>
      </section>

      <div className="da-branch-workspace">
        <Card className="da-branch-source-card">
          <div className="da-card-header-row">
            <div><div className="da-section-kicker">Rincian Hari Ini</div><h2>Sumber Laporan</h2><p className="da-muted">Klik kategori untuk memeriksa transaksi yang membentuk laporan.</p></div>
            <Badge tone="default">{data.summary.transaction_count} transaksi</Badge>
          </div>
          <div className="da-branch-category-grid">
            {data.categories.map((category) => (
              <button type="button" key={category.key} className={`da-branch-category is-${String(category.key).toLowerCase()}`} onClick={() => setSelectedCategory(category)}>
                <div><span>{category.title}</span><small>{category.count} transaksi</small></div>
                <strong>{formatRupiah(category.amount)}</strong>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </Card>

        <Card className="da-branch-status-card da-branch-status-card-v14b">
          <div className="da-card-header-row da-branch-status-heading">
            <div><div className="da-section-kicker">Progres Penutupan</div><h2>{statusLabel(currentReport?.status)}</h2></div>
            <Badge tone={statusTone(currentReport?.status)}>{currentReport ? statusLabel(currentReport.status) : "Belum Dikirim"}</Badge>
          </div>
          <div className="da-branch-timeline" aria-label="Progres laporan cabang">
            {workflowSteps.map((step, index) => {
              const done = index < workflowIndex || currentStatus === "SETTLED";
              const current = index === workflowIndex && currentStatus !== "SETTLED";
              const danger = currentStatus === "REJECTED" && index === 2;
              return (
                <div key={step.label} className={`da-branch-timeline-step ${done ? "is-done" : ""} ${current ? "is-current" : ""} ${danger ? "is-danger" : ""}`}>
                  <span className="da-branch-timeline-dot">{done ? <CheckCircle2 size={13} /> : index + 1}</span>
                  <div><strong>{step.label}</strong><small>{step.hint}</small></div>
                </div>
              );
            })}
          </div>
          <div className={`da-branch-status-hero da-branch-status-hero-compact tone-${workflow.tone}`}>
            {workflow.tone === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <div><strong>{workflow.title}</strong><span>{workflow.text}</span></div>
          </div>
          <div className="da-branch-status-list da-branch-status-list-compact">
            <div><FileText size={15} /><span>Transaksi</span><strong>{data.summary.transaction_count}</strong></div>
            <div><Banknote size={15} /><span>Dana Cabang</span><strong>{formatRupiah(data.summary.depositable_income)}</strong></div>
            <div><Wallet size={15} /><span>Pengeluaran</span><strong>{formatRupiah(data.summary.total_expense)}</strong></div>
          </div>
          {data.warnings.length ? <div className="da-branch-warning-list">{data.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}
          {currentReport && ["APPROVED", "PARTIAL"].includes(String(currentReport.status).toUpperCase()) && onNavigate ? (
            <Button variant="ghost" onClick={() => onNavigate("setoran-cabang")}>Buka Setoran <ArrowRight size={15} /></Button>
          ) : null}
        </Card>
      </div>

      <Card>
        <div className="da-card-header-row"><div><div className="da-section-kicker">Riwayat Laporan</div><h2>Laporan yang Tercatat</h2><p className="da-muted">Klik laporan untuk melihat snapshot, transaksi sumber, dan hasil review Tangerang.</p></div><Badge tone="success">Data Aktual</Badge></div>
        {data.reports.length ? (
          <DataTable columns={REPORT_COLUMNS} rows={data.reports} getRowKey={(row) => row.report_id} onRowClick={(row) => { setSelectedReport(row); setReviewNote(""); }} />
        ) : (
          <div className="da-branch-empty-state">
            <FileText size={24} />
            <strong>{canApprove ? `Belum ada laporan dari ${selectedLocationName}` : "Belum ada laporan pada periode ini"}</strong>
            <span>{canApprove ? "Laporan akan muncul setelah akun cabang mengirimkannya ke pusat." : "Tarik transaksi, periksa ringkasan, lalu kirim laporan ke pusat saat siap."}</span>
          </div>
        )}
      </Card>

      <Modal open={Boolean(selectedCategory)} title={selectedCategory?.title || "Transaksi Sumber"} subtitle={`${selectedCategory?.count || 0} transaksi · ${formatRupiah(selectedCategory?.amount || 0)}`} onClose={() => setSelectedCategory(null)} size="xl">
        <DataTable columns={SOURCE_COLUMNS} rows={selectedCategory?.rows || []} getRowKey={(row, index) => `${row.module}-${row.id}-${index}`} />
      </Modal>

      <Modal open={Boolean(selectedReport)} title="Detail Laporan Cabang" subtitle={selectedReport?.report_id || ""} onClose={() => { setSelectedReport(null); setReviewNote(""); }} size="xl">
        <div className="da-branch-detail-summary">
          <div><span>Cabang</span><strong>{selectedReport?.location_name}</strong></div>
          <div><span>Periode</span><strong>{selectedReport?.period_label}</strong></div>
          <div><span>Setoran</span><strong>{formatRupiah(selectedReport?.expected_deposit || 0)}</strong></div>
          <div><span>Status</span><strong><Badge tone={statusTone(selectedReport?.status)}>{statusLabel(selectedReport?.status)}</Badge></strong></div>
        </div>
        <DataTable columns={SOURCE_COLUMNS} rows={selectedReport?.items || []} getRowKey={(row, index) => `${row.source_module}-${row.source_id}-${index}`} />
        {canApprove && String(selectedReport?.status).toUpperCase() === "SUBMITTED" ? <>
          <label className="da-modal-note"><span>Catatan Review</span><textarea rows="3" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Opsional untuk persetujuan, wajib jika dikembalikan untuk revisi." /></label>
          <div className="da-form-actions"><Button variant="ghost" onClick={() => processReport("reject")} disabled={saving}>Kembalikan untuk Revisi</Button><Button variant="primary" onClick={() => processReport("approve")} disabled={saving}>Setujui Laporan</Button></div>
        </> : null}
      </Modal>
    </div>
  );
}
