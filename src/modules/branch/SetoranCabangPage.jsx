import { useEffect, useMemo, useState } from "react";
import {
  approveSetoranCabang,
  createSetoranCabang,
  getSetoranCabangBootstrap,
  rejectSetoranCabang,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  const parsed = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

function todayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  return (
    code.includes("AUTH_REQUIRED") ||
    message.includes("AUTH_REQUIRED") ||
    (message.includes("SESSION") && message.includes("TIDAK AKTIF"))
  );
}

function normalizeWallet(row) {
  return {
    id: row.wallet_id || row.id || row.code || row.wallet_code || "",
    name: row.wallet_name || row.name || row.label || row.dompet || row.wallet_id || "Dompet",
    location_code: row.location_code || row.location_id || "",
    balance: numberValue(row.balance || row.current_balance || row.saldo || 0),
  };
}

function normalizeTransaction(row) {
  return {
    ...row,
    id: row.id || row.source_id || row.transaction_id || row.payment_id || row.invoice_id || row.order_id || row.mutation_id || "",
    date: row.date || row.transaction_date || row.created_at || "",
    module: row.module_label || row.module || row.source_module || "Transaksi",
    description: row.description || row.keterangan || row.notes || row.customer_name || row.supplier_name || "-",
    method: row.method || row.payment_method || row.wallet_name || row.dompet || "-",
    amount: numberValue(row.amount || row.nominal || row.total_amount || row.remaining_amount || 0),
    status: row.status || row.payment_status || row.transaction_status || "Tercatat",
  };
}

function normalizeDeposit(row) {
  const items = asArray(row.items || row.source_transactions || row.transactions).map(normalizeTransaction);
  return {
    ...row,
    deposit_id: row.deposit_id || row.setoran_id || row.id || "",
    deposit_date: row.deposit_date || row.setoran_date || row.date || row.created_at || "",
    date_start: row.date_start || row.start_date || row.report_date || row.deposit_date || "",
    date_end: row.date_end || row.end_date || row.report_date || row.deposit_date || "",
    period_label: row.period_label || row.report_period || row.report_date || row.date_start || "",
    location_code: row.location_code || row.location_id || row.branch_code || "",
    location_name: row.location_name || row.branch_name || row.location_code || "",
    expected_amount: numberValue(row.expected_amount || row.estimated_amount || row.estimasi_setoran || 0),
    deposit_amount: numberValue(row.deposit_amount || row.amount || row.nominal || 0),
    destination_wallet_id: row.destination_wallet_id || row.wallet_id || "",
    destination_wallet_name: row.destination_wallet_name || row.wallet_name || row.dompet || "",
    transaction_count: numberValue(row.transaction_count || row.source_count || items.length || 0),
    status: row.status || row.deposit_status || "PENDING_OWNER",
    notes: row.notes || row.catatan || "",
    wallet_mutation_id: row.wallet_mutation_id || "",
    items,
  };
}

function normalizeBootstrap(payload) {
  const data = payload?.data || payload || {};
  const report = data.report || data.daily_report || {};
  const summary = data.summary || {};
  const reportSummary = report.summary || data.report_summary || {};

  return {
    summary: {
      total_income: numberValue(summary.total_income ?? reportSummary.total_income),
      total_expense: numberValue(summary.total_expense ?? reportSummary.total_expense),
      estimated_deposit: numberValue(summary.estimated_deposit ?? summary.estimated_cash_to_deposit ?? reportSummary.estimated_cash_to_deposit),
      pending_amount: numberValue(summary.pending_amount),
      approved_amount: numberValue(summary.approved_amount),
      rejected_amount: numberValue(summary.rejected_amount),
      deposit_count: numberValue(summary.deposit_count),
      pending_count: numberValue(summary.pending_count),
      approved_count: numberValue(summary.approved_count),
      transaction_count: numberValue(summary.transaction_count ?? reportSummary.transaction_count),
    },
    report: {
      summary: reportSummary,
      transactions: asArray(report.recent_transactions || data.source_transactions).map(normalizeTransaction),
      warnings: asArray(report.warnings || data.warnings),
    },
    deposits: asArray(data.deposits || data.branch_deposits).map(normalizeDeposit),
    wallets: asArray(data.wallets || data.destination_wallets).map(normalizeWallet),
  };
}

function badgeTone(status) {
  const text = String(status || "").toLowerCase();
  if (text.includes("approved") || text.includes("diterima") || text.includes("selesai")) return "success";
  if (text.includes("reject") || text.includes("tolak") || text.includes("revisi")) return "danger";
  if (text.includes("pending") || text.includes("menunggu")) return "warning";
  return "default";
}

const SOURCE_COLUMNS = [
  { key: "date", label: "Tanggal", render: (row) => formatDisplayDate(row.date) },
  { key: "module", label: "Modul" },
  { key: "id", label: "ID", render: (row) => <strong>{safeText(row.id)}</strong> },
  { key: "description", label: "Keterangan" },
  { key: "method", label: "Metode/Dompet" },
  { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
  { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{safeText(row.status, "Tercatat")}</Badge> },
];

const DEPOSIT_COLUMNS = [
  { key: "deposit_date", label: "Tanggal", render: (row) => formatDisplayDate(row.deposit_date) },
  { key: "deposit_id", label: "Setoran ID", render: (row) => <strong>{safeText(row.deposit_id)}</strong> },
  { key: "location_code", label: "Cabang" },
  { key: "period_label", label: "Periode" },
  { key: "deposit_amount", label: "Nominal", render: (row) => formatRupiah(row.deposit_amount) },
  { key: "destination_wallet_name", label: "Dompet Tujuan", render: (row) => safeText(row.destination_wallet_name) },
  { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{safeText(row.status)}</Badge> },
];

export default function SetoranCabangPage({ session, onSessionExpired }) {
  const today = todayInputValue();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState(() => ({
    report_mode: "daily",
    report_date: today,
    date_start: today,
    date_end: today,
    location_code: session?.user?.location_code || session?.user?.location_id || "TGR",
  }));
  const [bootstrap, setBootstrap] = useState(() => normalizeBootstrap({}));
  const [draft, setDraft] = useState(() => ({
    deposit_date: today,
    deposit_amount: "0",
    destination_wallet_id: "",
    payment_method: "Transfer",
    notes: "Setoran cabang dari laporan harian/periode.",
  }));
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [selectedSourceOpen, setSelectedSourceOpen] = useState(false);

  const sessionToken = session?.sessionToken || "";

  const requestPayload = useMemo(() => {
    return {
      ...filter,
      report_date: filter.report_mode === "period" ? filter.date_start : filter.report_date,
      date_start: filter.report_mode === "period" ? filter.date_start : filter.report_date,
      date_end: filter.report_mode === "period" ? filter.date_end : filter.report_date,
    };
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getSetoranCabangBootstrap(sessionToken, requestPayload);

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      if (!result?.success) {
        setError(result?.message || "Gagal membaca setoran cabang.");
        return;
      }

      const normalized = normalizeBootstrap(result.data || result);
      setBootstrap(normalized);
      setDraft((current) => ({
        ...current,
        deposit_amount: current.deposit_amount && current.deposit_amount !== "0" ? current.deposit_amount : String(Math.max(0, normalized.summary.estimated_deposit || 0)),
        destination_wallet_id: current.destination_wallet_id || normalized.wallets[0]?.id || "",
      }));
    } catch (err) {
      setError(err?.message || "Gagal membaca setoran cabang.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedWallet = useMemo(() => {
    return bootstrap.wallets.find((wallet) => wallet.id === draft.destination_wallet_id) || bootstrap.wallets[0] || null;
  }, [bootstrap.wallets, draft.destination_wallet_id]);

  const submitDeposit = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...requestPayload,
        deposit_date: draft.deposit_date || today,
        deposit_amount: numberValue(draft.deposit_amount),
        expected_amount: bootstrap.summary.estimated_deposit,
        destination_wallet_id: selectedWallet?.id || draft.destination_wallet_id,
        destination_wallet_name: selectedWallet?.name || "",
        payment_method: draft.payment_method,
        notes: draft.notes,
        source_transactions: bootstrap.report.transactions,
        report_summary: bootstrap.report.summary,
      };

      if (!payload.deposit_amount || payload.deposit_amount <= 0) {
        setError("Nominal setoran wajib lebih dari 0.");
        return;
      }

      const result = await createSetoranCabang(sessionToken, payload);
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal menyimpan setoran cabang.");
        return;
      }

      setSuccess(result?.message || "Setoran cabang berhasil dicatat sebagai pending owner.");
      setDraft((current) => ({ ...current, deposit_amount: "0" }));
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal menyimpan setoran cabang.");
    } finally {
      setSaving(false);
    }
  };

  const handleApproval = async (type) => {
    if (!selectedDeposit) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const fn = type === "approve" ? approveSetoranCabang : rejectSetoranCabang;
      const result = await fn(sessionToken, {
        deposit_id: selectedDeposit.deposit_id,
        notes: type === "approve" ? "Disetujui owner/Tangerang." : "Ditolak / perlu revisi.",
      });

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal update status setoran.");
        return;
      }

      setSuccess(result?.message || "Status setoran berhasil diperbarui.");
      setSelectedDeposit(null);
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal update status setoran.");
    } finally {
      setSaving(false);
    }
  };

  const deposits = bootstrap.deposits;
  const sourceTransactions = bootstrap.report.transactions;

  return (
    <div className="da-page-stack">
      <PageHeader
        title="Setoran Cabang"
        description="Tarik laporan harian/periode, buat setoran pending, lalu owner/Tangerang approve agar uang masuk ke dompet pusat. Admin tidak perlu input ulang detail transaksi."
        badge="Auto Pull + Approval"
      />

      <Card>
        <div className="da-card-header-row">
          <div>
            <div className="da-section-kicker">Gerbang Setoran</div>
            <h2>Laporan Harian → Setoran Pending → Approve Owner</h2>
            <p className="da-muted">
              Bahan setoran ditarik dari transaksi hidup. Approval baru mencatat mutasi uang masuk ke dompet tujuan.
            </p>
          </div>
          <div className="da-card-actions">
            <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Dicek" : "Terhubung"}</Badge>
            <Button variant="ghost" onClick={loadData} disabled={loading}>{loading ? "Menarik..." : "Refresh Data"}</Button>
          </div>
        </div>

        <div className="da-detail-grid" style={{ marginTop: 16 }}>
          <label className="da-detail-box">
            <strong>Mode Setoran</strong>
            <select
              value={filter.report_mode}
              onChange={(event) => {
                const mode = event.target.value;
                setFilter((current) => ({
                  ...current,
                  report_mode: mode,
                  date_start: current.date_start || current.report_date,
                  date_end: mode === "period" ? (current.date_end || current.report_date) : current.report_date,
                }));
              }}
              style={{ width: "100%", marginTop: 10, border: "1px solid var(--da-color-border)", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
            >
              <option value="daily">Harian / 1 Tanggal</option>
              <option value="period">Periode / Rentang Tanggal</option>
            </select>
            <p>{filter.report_mode === "period" ? "Cocok untuk setoran beberapa hari sekaligus." : "Cocok untuk closing harian cabang."}</p>
          </label>

          {filter.report_mode === "period" ? (
            <>
              <label className="da-detail-box">
                <strong>Tanggal Mulai</strong>
                <input type="date" value={filter.date_start} onChange={(event) => setFilter((current) => ({ ...current, date_start: event.target.value }))} style={{ width: "100%", marginTop: 10, border: "1px solid var(--da-color-border)", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }} />
              </label>
              <label className="da-detail-box">
                <strong>Tanggal Sampai</strong>
                <input type="date" value={filter.date_end} onChange={(event) => setFilter((current) => ({ ...current, date_end: event.target.value }))} style={{ width: "100%", marginTop: 10, border: "1px solid var(--da-color-border)", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }} />
              </label>
            </>
          ) : (
            <label className="da-detail-box">
              <strong>Tanggal Setoran</strong>
              <input type="date" value={filter.report_date} onChange={(event) => setFilter((current) => ({ ...current, report_date: event.target.value, date_start: event.target.value, date_end: event.target.value }))} style={{ width: "100%", marginTop: 10, border: "1px solid var(--da-color-border)", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }} />
            </label>
          )}

          <label className="da-detail-box">
            <strong>Lokasi / Cabang</strong>
            <input type="text" value={filter.location_code} onChange={(event) => setFilter((current) => ({ ...current, location_code: event.target.value }))} placeholder="TGR / PML / CBN" style={{ width: "100%", marginTop: 10, border: "1px solid var(--da-color-border)", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }} />
            <p>Owner bisa cek semua cabang. Cabang hanya cabangnya sendiri.</p>
          </label>
        </div>

        <div className="da-form-actions">
          <Button variant="primary" onClick={loadData} disabled={loading}>{loading ? "Menarik Bahan..." : "Tarik Bahan Setoran"}</Button>
        </div>

        {error ? <div className="da-form-warning">{error}</div> : null}
        {success ? <div className="da-form-success">{success}</div> : null}
      </Card>

      <div className="da-grid da-grid-3">
        <StatCard label="Uang Masuk Aktual" value={formatRupiah(bootstrap.summary.total_income)} description="Bahan setoran dari payment/mutasi IN." tone="success" />
        <StatCard label="Uang Keluar" value={formatRupiah(bootstrap.summary.total_expense)} description="Belanja, hutang, dan mutasi OUT pada filter ini." tone="warning" />
        <StatCard label="Estimasi Setoran" value={formatRupiah(bootstrap.summary.estimated_deposit)} description="Uang yang perlu dicek sebelum disetor." />
        <StatCard label="Pending Owner" value={formatRupiah(bootstrap.summary.pending_amount)} description={`${bootstrap.summary.pending_count} setoran menunggu approval.`} tone="warning" />
        <StatCard label="Sudah Approved" value={formatRupiah(bootstrap.summary.approved_amount)} description={`${bootstrap.summary.approved_count} setoran sudah masuk catatan pusat.`} tone="success" />
        <StatCard label="Transaksi Sumber" value={bootstrap.summary.transaction_count} description="Jumlah baris laporan harian/periode yang ditarik." />
      </div>

      <Card>
        <div className="da-card-header-row">
          <div>
            <div className="da-section-kicker">Input Setoran</div>
            <h2>Buat Setoran Pending</h2>
            <p className="da-muted">Simpan setoran dari bahan laporan. Approval owner/Tangerang yang membuat mutasi uang masuk dompet pusat.</p>
          </div>
          <Badge tone="warning">Pending dulu</Badge>
        </div>

        <div className="da-detail-grid" style={{ marginTop: 16 }}>
          <label className="da-detail-box">
            <strong>Tanggal Kirim/Setor</strong>
            <input type="date" value={draft.deposit_date} onChange={(event) => setDraft((current) => ({ ...current, deposit_date: event.target.value }))} style={{ width: "100%", marginTop: 10, border: "1px solid var(--da-color-border)", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }} />
          </label>
          <label className="da-detail-box">
            <strong>Nominal Disetor</strong>
            <input type="number" value={draft.deposit_amount} onChange={(event) => setDraft((current) => ({ ...current, deposit_amount: event.target.value }))} style={{ width: "100%", marginTop: 10, border: "1px solid var(--da-color-border)", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }} />
            <p>Estimasi dari laporan: {formatRupiah(bootstrap.summary.estimated_deposit)}</p>
          </label>
          <label className="da-detail-box">
            <strong>Dompet Tujuan Pusat</strong>
            <select value={draft.destination_wallet_id} onChange={(event) => setDraft((current) => ({ ...current, destination_wallet_id: event.target.value }))} style={{ width: "100%", marginTop: 10, border: "1px solid var(--da-color-border)", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}>
              {bootstrap.wallets.length === 0 ? <option value="">Belum ada dompet</option> : null}
              {bootstrap.wallets.map((wallet) => <option key={wallet.id || wallet.name} value={wallet.id}>{wallet.name}</option>)}
            </select>
            <p>{selectedWallet ? `Saldo terbaca: ${formatRupiah(selectedWallet.balance)}` : "Akan masuk setelah owner approve."}</p>
          </label>
          <label className="da-detail-box">
            <strong>Metode Setoran</strong>
            <select value={draft.payment_method} onChange={(event) => setDraft((current) => ({ ...current, payment_method: event.target.value }))} style={{ width: "100%", marginTop: 10, border: "1px solid var(--da-color-border)", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}>
              <option value="Transfer">Transfer</option>
              <option value="Cash">Cash/Tunai</option>
              <option value="QRIS">QRIS</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </label>
        </div>

        <label className="da-detail-box" style={{ display: "block", marginTop: 14 }}>
          <strong>Catatan</strong>
          <input type="text" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} style={{ width: "100%", marginTop: 10, border: "1px solid var(--da-color-border)", borderRadius: 12, padding: "10px 12px", fontWeight: 700 }} />
        </label>

        <div className="da-form-warning" style={{ marginTop: 14 }}>
          Setoran ini belum langsung menambah saldo dompet pusat. Saldo pusat baru bertambah saat owner/Tangerang approve.
        </div>

        <div className="da-form-actions">
          <Button variant="ghost" onClick={() => setSelectedSourceOpen(true)}>Lihat {sourceTransactions.length} Transaksi Sumber</Button>
          <Button variant="primary" onClick={submitDeposit} disabled={saving || loading}>{saving ? "Menyimpan..." : "Simpan Setoran Pending"}</Button>
        </div>
      </Card>

      <Card>
        <div className="da-card-header-row">
          <div>
            <div className="da-section-kicker">Setoran Tercatat</div>
            <h2>Riwayat Setoran Cabang</h2>
            <p className="da-muted">Klik baris untuk membuka detail transaksi sumber, approval, dan mutasi dompet jika sudah approved.</p>
          </div>
          <Badge tone="success">Live Data</Badge>
        </div>
        <DataTable columns={DEPOSIT_COLUMNS} rows={deposits} getRowKey={(row, index) => `${row.deposit_id}-${index}`} onRowClick={setSelectedDeposit} />
      </Card>

      <Modal open={selectedSourceOpen} title="Transaksi Sumber Setoran" subtitle={`${sourceTransactions.length} baris dari laporan harian/periode`} onClose={() => setSelectedSourceOpen(false)}>
        <DataTable columns={SOURCE_COLUMNS} rows={sourceTransactions} getRowKey={(row, index) => `${row.module}-${row.id}-${index}`} />
      </Modal>

      <Modal open={Boolean(selectedDeposit)} title="Detail Setoran Cabang" subtitle={selectedDeposit?.deposit_id || ""} onClose={() => setSelectedDeposit(null)}>
        <div className="da-detail-grid" style={{ marginBottom: 16 }}>
          <div className="da-detail-box"><strong>Nominal Setoran</strong><p style={{ fontSize: 22, fontWeight: 900 }}>{formatRupiah(selectedDeposit?.deposit_amount || 0)}</p></div>
          <div className="da-detail-box"><strong>Status</strong><p><Badge tone={badgeTone(selectedDeposit?.status)}>{safeText(selectedDeposit?.status)}</Badge></p></div>
          <div className="da-detail-box"><strong>Dompet Tujuan</strong><p>{safeText(selectedDeposit?.destination_wallet_name)}</p></div>
          <div className="da-detail-box"><strong>Mutasi Dompet</strong><p>{safeText(selectedDeposit?.wallet_mutation_id, "Belum ada / menunggu approval")}</p></div>
        </div>
        <div className="da-form-warning" style={{ marginBottom: 14 }}>
          Rantai: Laporan Harian → Setoran Cabang → Approve Owner → Mutasi Dompet IN → bahan 4 Amplop.
        </div>
        <DataTable columns={SOURCE_COLUMNS} rows={selectedDeposit?.items || []} getRowKey={(row, index) => `${row.module}-${row.id}-${index}`} />
        {String(selectedDeposit?.status || "").toUpperCase().includes("PENDING") ? (
          <div className="da-form-actions">
            <Button variant="ghost" onClick={() => handleApproval("reject")} disabled={saving}>{saving ? "Memproses..." : "Tolak/Revisi"}</Button>
            <Button variant="primary" onClick={() => handleApproval("approve")} disabled={saving}>{saving ? "Memproses..." : "Approve & Catat Mutasi IN"}</Button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
