import { useEffect, useMemo, useState } from "react";
import { getMoneyInBootstrap, recordCustomerReceivablePayment } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { allowedPaymentMethods, suggestedPaymentMethod } from "../../lib/finance/walletPolicy.js";
import OtherIncomePanel from "./OtherIncomePanel";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";
import FinanceSnapshot from "./FinanceSnapshot";

function asArray(value) { return Array.isArray(value) ? value : []; }
function numberValue(value) { const parsed = Number(String(value ?? "0").replace(/[^0-9.-]/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function safeText(value, fallback = "-") { const text = String(value || "").trim(); return text || fallback; }
function formatDisplayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || message.includes("AUTH_REQUIRED") || (message.includes("SESSION") && message.includes("TIDAK AKTIF"));
}
function getStatusTone(status) {
  const value = String(status || "").toUpperCase();
  if (value.includes("LUNAS") || value.includes("PAID") || value.includes("POSTED") || value.includes("SETTLED")) return "success";
  if (value.includes("VOID") || value.includes("BATAL") || value.includes("CANCEL")) return "danger";
  return "warning";
}
function normalizePayment(row) {
  return {
    ...row,
    payment_id: row.payment_id || row.pay_id || row.id || row.transaction_id || "",
    payment_date: row.payment_date || row.date || row.created_at || row.paid_at || "",
    source_id: row.invoice_id || row.order_id || row.source_id || row.ref_id || "",
    order_id: row.order_id || "",
    invoice_id: row.invoice_id || row.source_id || "",
    customer_name: row.customer_name || row.name || row.customer || "UMUM",
    wallet_name: row.wallet_name || row.wallet_code || row.wallet_id || row.method || "-",
    amount: numberValue(row.amount || row.payment_amount || row.paid_amount || row.nominal || 0),
    status: row.status || row.payment_status || "Tercatat",
  };
}
function normalizeReceivable(row) {
  const original = numberValue(row.original_amount || row.amount || row.total_amount || row.invoice_amount || 0);
  const paid = numberValue(row.paid_amount || row.amount_paid || row.total_paid || 0);
  const remaining = numberValue(row.remaining_amount || row.outstanding_amount || row.sisa_tagihan || row.balance || original - paid);
  return {
    ...row,
    receivable_id: row.receivable_id || row.piutang_id || row.id || "",
    receivable_date: row.receivable_date || row.invoice_date || row.order_date || row.date || row.created_at || "",
    invoice_id: row.invoice_id || row.source_invoice_id || "",
    order_id: row.order_id || row.source_order_id || "",
    customer_name: row.customer_name || row.name || row.customer || "UMUM",
    original_amount: original,
    paid_amount: paid,
    remaining_amount: Math.max(remaining, 0),
    due_date: row.due_date || row.jatuh_tempo || "",
    status: row.status || row.receivable_status || row.payment_status || (remaining > 0 ? "Open" : "Lunas"),
  };
}
function normalizeWalletMutation(row) {
  return {
    ...row,
    mutation_id: row.mutation_id || row.wallet_mutation_id || row.id || "",
    date: row.mutation_date || row.date || row.created_at || "",
    wallet_name: row.wallet_name || row.wallet_code || row.wallet_id || "Dompet",
    source_id: row.source_id || row.ref_id || row.payment_id || row.order_id || "",
    direction: String(row.direction || row.mutation_type || "IN").toUpperCase(),
    amount: Math.abs(numberValue(row.amount || row.nominal || row.debit || row.credit || 0)),
    status: row.status || "Tercatat",
  };
}
function normalizeWallet(row) {
  return {
    ...row,
    wallet_id: row.wallet_id || row.id || row.code || row.wallet_code || "",
    wallet_name: row.wallet_name || row.name || row.account_name || row.nama_dompet || row.wallet_code || "Dompet",
    wallet_code: row.wallet_code || row.code || "",
    status: row.status || "Active",
  };
}
function normalizeOtherIncome(row) {
  return {
    ...row,
    income_id: row.income_id || row.id || "",
    income_date: row.income_date || row.created_at || "",
    category: row.income_category || row.category || "OTHER_INCOME",
    source_name: row.source_name || row.payer_name || "-",
    wallet_name: row.wallet_name || row.wallet_code || row.wallet_id || "Dompet",
    amount: numberValue(row.amount || 0),
    status: row.status || "POSTED",
  };
}
function buildSummary(data) {
  const summary = data?.summary || {};
  return {
    uang_masuk_actual: numberValue(summary.uang_masuk_actual),
    payment_count: numberValue(summary.payment_count),
    piutang_open: numberValue(summary.piutang_open),
    receivable_count: numberValue(summary.receivable_count),
    wallet_in_count: numberValue(summary.wallet_in_count),
    today_uang_masuk: numberValue(summary.today_uang_masuk),
    other_income_count: numberValue(summary.other_income_count),
  };
}
function buildRequestId() { return `PAYIN-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`; }
function localDateValue() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

const defaultForm = {
  receivable_id: "",
  payment_date: localDateValue(),
  wallet_id: "",
  amount: "",
  payment_method: "Transfer",
  notes: "Pembayaran piutang customer.",
};

export default function UangMasukPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [activeTab, setActiveTab] = useState("payments");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedReceivable, setSelectedReceivable] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [otherIncomeOpen, setOtherIncomeOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const summary = useMemo(() => buildSummary(bootstrap), [bootstrap]);
  const payments = useMemo(() => asArray(bootstrap?.payments).map(normalizePayment), [bootstrap]);
  const receivables = useMemo(() => asArray(bootstrap?.receivables).map(normalizeReceivable), [bootstrap]);
  const openReceivables = useMemo(() => receivables.filter((row) => row.remaining_amount > 0), [receivables]);
  const wallets = useMemo(() => asArray(bootstrap?.wallets).map(normalizeWallet).filter((row) => row.wallet_id), [bootstrap]);
  const walletMutations = useMemo(() => asArray(bootstrap?.wallet_mutations).map(normalizeWalletMutation), [bootstrap]);
  const otherIncome = useMemo(() => asArray(bootstrap?.other_income).map(normalizeOtherIncome), [bootstrap]);
  const selectedFormReceivable = useMemo(() => receivables.find((row) => String(row.receivable_id) === String(form.receivable_id)) || null, [receivables, form.receivable_id]);
  const selectedWallet = useMemo(() => wallets.find((row) => String(row.wallet_id) === String(form.wallet_id)) || null, [wallets, form.wallet_id]);
  const paymentMethods = useMemo(() => selectedWallet ? allowedPaymentMethods(selectedWallet) : ["Transfer", "Cash", "QRIS"], [selectedWallet]);
  const paymentAmount = numberValue(form.amount);
  const remainingAfterPayment = selectedFormReceivable ? Math.max(numberValue(selectedFormReceivable.remaining_amount) - paymentAmount, 0) : 0;

  const loadData = async () => {
    setLoading(true);
    setError("");
    const result = await getMoneyInBootstrap(session?.sessionToken, { source: "finance_workspace_v12" });
    if (!result?.success) {
      if (isAuthRequired(result)) { onSessionExpired?.(); return; }
      setError(result?.message || "Gagal membaca data uang masuk.");
      setBootstrap(null);
      setLoading(false);
      return;
    }
    setBootstrap(result.data || {});
    setLoading(false);
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [session?.sessionToken]);
  useEffect(() => {
    if (!form.receivable_id && openReceivables.length > 0) setForm((current) => ({ ...current, receivable_id: openReceivables[0].receivable_id }));
  }, [openReceivables, form.receivable_id]);
  useEffect(() => {
    if (!form.wallet_id && wallets.length > 0) {
      const wallet = wallets[0];
      setForm((current) => ({ ...current, wallet_id: wallet.wallet_id, payment_method: suggestedPaymentMethod(wallet) }));
    }
  }, [wallets, form.wallet_id]);

  const updateForm = (field, value) => {
    setSuccessMessage(""); setError("");
    if (field === "wallet_id") {
      const wallet = wallets.find((row) => String(row.wallet_id) === String(value));
      setForm((current) => ({ ...current, wallet_id: value, payment_method: suggestedPaymentMethod(wallet || {}) }));
      return;
    }
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validatePayment = () => {
    if (!selectedFormReceivable) return "Pilih piutang yang mau dibayar.";
    if (!selectedWallet) return "Pilih dompet tujuan uang masuk.";
    if (paymentAmount <= 0) return "Nominal pembayaran harus lebih dari Rp0.";
    if (paymentAmount > numberValue(selectedFormReceivable.remaining_amount)) return `Nominal melebihi sisa piutang ${formatRupiah(selectedFormReceivable.remaining_amount)}.`;
    return "";
  };
  const openConfirm = () => { const message = validatePayment(); if (message) { setError(message); return; } setConfirmOpen(true); };
  const submitPayment = async () => {
    const message = validatePayment();
    if (message) { setError(message); setConfirmOpen(false); return; }
    setSaving(true); setError(""); setSuccessMessage("");
    const op = buildRequestId();
    const result = await recordCustomerReceivablePayment(session?.sessionToken, {
      request_id: op, operation_id: op,
      receivable_id: selectedFormReceivable.receivable_id,
      invoice_id: selectedFormReceivable.invoice_id,
      order_id: selectedFormReceivable.order_id,
      wallet_id: selectedWallet.wallet_id,
      payment_date: form.payment_date,
      payment_method: form.payment_method,
      amount: paymentAmount,
      notes: form.notes,
      source: "finance_workspace_v12",
    });
    if (!result?.success) {
      if (isAuthRequired(result)) { onSessionExpired?.(); return; }
      setError(result?.message || "Gagal menyimpan pembayaran piutang.");
      setSaving(false); setConfirmOpen(false); return;
    }
    setSuccessMessage(result.message || "Pembayaran piutang berhasil dicatat.");
    setConfirmOpen(false); setPaymentOpen(false); setSaving(false);
    setForm({ ...defaultForm, payment_date: localDateValue() });
    setActiveTab("payments");
    await loadData();
  };
  const fillPaymentFromReceivable = (receivable) => {
    setForm((current) => ({ ...current, receivable_id: receivable.receivable_id, amount: String(receivable.remaining_amount || ""), notes: `Pembayaran piutang ${receivable.receivable_id}` }));
    setSelectedReceivable(null); setPaymentOpen(true);
  };

  const paymentColumns = [
    { key: "payment_date", label: "Tanggal", render: (row) => formatDisplayDate(row.payment_date) },
    { key: "payment_id", label: "Payment ID", render: (row) => <strong>{safeText(row.payment_id)}</strong> },
    { key: "customer_name", label: "Customer", render: (row) => safeText(row.customer_name) },
    { key: "amount", label: "Uang Masuk", render: (row) => formatRupiah(row.amount) },
    { key: "wallet_name", label: "Dompet", render: (row) => safeText(row.wallet_name) },
    { key: "status", label: "Status", render: (row) => <Badge tone={getStatusTone(row.status)}>{safeText(row.status)}</Badge> },
  ];
  const receivableColumns = [
    { key: "receivable_date", label: "Tanggal", render: (row) => formatDisplayDate(row.receivable_date) },
    { key: "receivable_id", label: "Piutang ID", render: (row) => <strong>{safeText(row.receivable_id)}</strong> },
    { key: "customer_name", label: "Customer", render: (row) => safeText(row.customer_name) },
    { key: "original_amount", label: "Tagihan", render: (row) => formatRupiah(row.original_amount) },
    { key: "paid_amount", label: "Dibayar", render: (row) => formatRupiah(row.paid_amount) },
    { key: "remaining_amount", label: "Sisa", render: (row) => <strong>{formatRupiah(row.remaining_amount)}</strong> },
    { key: "status", label: "Status", render: (row) => <Badge tone={getStatusTone(row.status)}>{safeText(row.status)}</Badge> },
  ];
  const otherIncomeColumns = [
    { key: "income_date", label: "Tanggal", render: (row) => formatDisplayDate(row.income_date) },
    { key: "income_id", label: "ID", render: (row) => <strong>{safeText(row.income_id)}</strong> },
    { key: "category", label: "Kategori", render: (row) => safeText(row.category).replaceAll("_", " ") },
    { key: "source_name", label: "Sumber", render: (row) => safeText(row.source_name) },
    { key: "wallet_name", label: "Dompet", render: (row) => safeText(row.wallet_name) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
  ];
  const walletColumns = [
    { key: "date", label: "Tanggal", render: (row) => formatDisplayDate(row.date) },
    { key: "mutation_id", label: "Mutasi ID", render: (row) => <strong>{safeText(row.mutation_id)}</strong> },
    { key: "wallet_name", label: "Dompet", render: (row) => safeText(row.wallet_name) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
    { key: "source_id", label: "Sumber", render: (row) => safeText(row.source_id) },
  ];

  return (
    <div className="da-finance-page">
      <PageHeader
        eyebrow="Uang & Kewajiban"
        title="Uang Masuk"
        description="Pantau penerimaan aktual, pembayaran customer, dan piutang dalam satu ruang kerja. Transfer antar-dompet tidak dihitung sebagai uang masuk usaha."
        actions={(
          <div className="da-actions">
            <Button variant="ghost" onClick={loadData} disabled={loading}>{loading ? "Memuat..." : "Perbarui"}</Button>
            <Button variant="secondary" onClick={() => setOtherIncomeOpen(true)}>+ Penerimaan Lain</Button>
            <Button onClick={() => setPaymentOpen(true)} disabled={!openReceivables.length}>+ Bayar Piutang</Button>
          </div>
        )}
      />

      {error ? <div className="da-alert da-alert-danger">{error}</div> : null}
      {successMessage ? <div className="da-alert da-alert-success">{successMessage}</div> : null}

      <FinanceSnapshot
        eyebrow="Penerimaan Usaha"
        value={loading ? "..." : formatRupiah(summary.uang_masuk_actual)}
        caption="Total penerimaan yang benar-benar masuk ke kas atau bank usaha."
        metrics={[
          { label: "Masuk Hari Ini", value: loading ? "..." : formatRupiah(summary.today_uang_masuk), helper: "Penerimaan hari ini", tone: "success" },
          { label: "Piutang Terbuka", value: loading ? "..." : formatRupiah(summary.piutang_open), helper: `${summary.receivable_count} piutang aktif`, tone: "warning" },
          { label: "Transaksi Masuk", value: loading ? "..." : String(summary.wallet_in_count), helper: `${summary.payment_count} pembayaran · ${summary.other_income_count} lainnya` },
        ]}
      />

      <div className="da-finance-workspace da-finance-workspace-main">
        <Card className="da-finance-main-card">
          <div className="da-section-heading">
            <div>
              <div className="da-mini-title">PENERIMAAN & PIUTANG</div>
              <div className="da-big-text">Aktivitas Keuangan Masuk</div>
              <p className="da-muted">Klik baris untuk melihat rincian. Pembayaran baru dilakukan lewat tombol di atas.</p>
            </div>
          </div>
          <div className="da-tabs da-finance-tabs">
            <button type="button" className={activeTab === "payments" ? "da-tab active" : "da-tab"} onClick={() => setActiveTab("payments")}>Pembayaran</button>
            <button type="button" className={activeTab === "receivables" ? "da-tab active" : "da-tab"} onClick={() => setActiveTab("receivables")}>Piutang</button>
            <button type="button" className={activeTab === "other" ? "da-tab active" : "da-tab"} onClick={() => setActiveTab("other")}>Penerimaan Lain</button>
            <button type="button" className={activeTab === "wallets" ? "da-tab active" : "da-tab"} onClick={() => setActiveTab("wallets")}>Mutasi Dompet</button>
          </div>
          {activeTab === "payments" ? <DataTable columns={paymentColumns} rows={loading ? [] : payments} getRowKey={(row, index) => row.payment_id || index} onRowClick={setSelectedPayment} /> : null}
          {activeTab === "receivables" ? <DataTable columns={receivableColumns} rows={loading ? [] : receivables} getRowKey={(row, index) => row.receivable_id || index} onRowClick={setSelectedReceivable} /> : null}
          {activeTab === "other" ? <DataTable columns={otherIncomeColumns} rows={loading ? [] : otherIncome} getRowKey={(row, index) => row.income_id || index} /> : null}
          {activeTab === "wallets" ? <DataTable columns={walletColumns} rows={loading ? [] : walletMutations.filter((row) => row.direction === "IN")} getRowKey={(row, index) => row.mutation_id || index} /> : null}
        </Card>

        <Card className="da-finance-side-card">
          <div className="da-mini-title">POSISI PENERIMAAN</div>
          <div className="da-finance-hero-number da-finance-hero-number-dark"><span>Masuk Hari Ini</span><strong>{formatRupiah(summary.today_uang_masuk)}</strong><small>Penerimaan yang tercatat hari ini</small></div>
          <div className="da-finance-metric-list">
            <div><span>Pembayaran tercatat</span><strong>{summary.payment_count}</strong></div>
            <div><span>Piutang aktif</span><strong>{summary.receivable_count}</strong></div>
            <div><span>Penerimaan lain</span><strong>{summary.other_income_count}</strong></div>
            <div><span>Dompet tujuan</span><strong>{wallets.length}</strong></div>
          </div>
          <div className="da-finance-note">4 Amplop hanya menggunakan penerimaan yang sudah masuk, memiliki referensi transaksi, dan belum pernah dialokasikan.</div>
        </Card>
      </div>

      <Modal open={paymentOpen} title="Catat Pembayaran Piutang" subtitle={selectedFormReceivable?.customer_name || "Pilih piutang customer"} onClose={() => setPaymentOpen(false)}>
        <div className="da-finance-modal-form">
          <label className="da-field-label">Piutang Customer
            <select className="da-input" value={form.receivable_id} onChange={(e) => updateForm("receivable_id", e.target.value)}>
              <option value="">Pilih piutang</option>
              {openReceivables.map((row) => <option key={row.receivable_id} value={row.receivable_id}>{row.customer_name} · {formatRupiah(row.remaining_amount)}</option>)}
            </select>
          </label>
          <label className="da-field-label">Tanggal Bayar<input className="da-input" type="date" value={form.payment_date} onChange={(e) => updateForm("payment_date", e.target.value)} /></label>
          <label className="da-field-label">Dompet Tujuan
            <select className="da-input" value={form.wallet_id} onChange={(e) => updateForm("wallet_id", e.target.value)}>
              <option value="">Pilih dompet</option>
              {wallets.map((wallet) => <option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name}</option>)}
            </select>
          </label>
          <label className="da-field-label">Nominal Bayar<input className="da-input" value={form.amount} onChange={(e) => updateForm("amount", e.target.value)} placeholder="Rp 0" /></label>
          <label className="da-field-label">Metode
            <select className="da-input" value={form.payment_method} onChange={(e) => updateForm("payment_method", e.target.value)}>{paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select>
          </label>
          <label className="da-field-label da-finance-span-2">Catatan<input className="da-input" value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} /></label>
        </div>
        <div className="da-finance-preview-row">
          <div><span>Sisa sebelum</span><strong>{formatRupiah(selectedFormReceivable?.remaining_amount || 0)}</strong></div>
          <div><span>Dibayar</span><strong>{formatRupiah(paymentAmount)}</strong></div>
          <div><span>Sisa setelah</span><strong>{formatRupiah(remainingAfterPayment)}</strong></div>
        </div>
        {error ? <div className="da-alert da-alert-danger">{error}</div> : null}
        <div className="da-form-actions"><Button variant="ghost" onClick={() => setPaymentOpen(false)}>Batal</Button><Button onClick={openConfirm} disabled={saving}>Tinjau Pembayaran</Button></div>
      </Modal>

      <Modal open={otherIncomeOpen} title="Penerimaan Lain" subtitle="Modal, reimbursement, refund vendor, atau penerimaan non-penjualan" onClose={() => setOtherIncomeOpen(false)}>
        <div className="da-finance-embedded"><OtherIncomePanel session={session} wallets={wallets} onSaved={async () => { await loadData(); setOtherIncomeOpen(false); }} onSessionExpired={onSessionExpired} /></div>
      </Modal>

      <Modal open={confirmOpen} title="Konfirmasi Pembayaran Piutang" subtitle={selectedFormReceivable?.receivable_id || ""} onClose={() => setConfirmOpen(false)}>
        <div className="da-modal-summary"><div><div className="da-mini-title">Uang Masuk</div><div className="da-big-text">{formatRupiah(paymentAmount)}</div><p className="da-muted">{selectedWallet?.wallet_name || "-"}</p></div><Badge tone="success">Masuk Dompet</Badge></div>
        <div className="da-detail-grid">
          <div className="da-detail-box"><p><strong>Customer:</strong> {safeText(selectedFormReceivable?.customer_name)}</p><p><strong>Piutang:</strong> {safeText(selectedFormReceivable?.receivable_id)}</p></div>
          <div className="da-detail-box"><p><strong>Sisa sebelum:</strong> {formatRupiah(selectedFormReceivable?.remaining_amount || 0)}</p><p><strong>Sisa setelah:</strong> {formatRupiah(remainingAfterPayment)}</p></div>
        </div>
        <div className="da-form-actions"><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Kembali</Button><Button onClick={submitPayment} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Pembayaran"}</Button></div>
      </Modal>

      <Modal open={Boolean(selectedPayment)} title="Detail Pembayaran" subtitle={selectedPayment?.payment_id || ""} onClose={() => setSelectedPayment(null)}>
        {selectedPayment ? <div className="da-detail-grid"><div className="da-detail-box"><p><strong>Customer:</strong> {safeText(selectedPayment.customer_name)}</p><p><strong>Tanggal:</strong> {formatDisplayDate(selectedPayment.payment_date)}</p><p><strong>Dompet:</strong> {safeText(selectedPayment.wallet_name)}</p></div><div className="da-detail-box"><div className="da-mini-title">Nominal</div><div className="da-big-text">{formatRupiah(selectedPayment.amount)}</div><p><strong>Sumber:</strong> {safeText(selectedPayment.source_id)}</p></div></div> : null}
      </Modal>

      <Modal open={Boolean(selectedReceivable)} title="Detail Piutang" subtitle={selectedReceivable?.receivable_id || ""} onClose={() => setSelectedReceivable(null)}>
        {selectedReceivable ? <><div className="da-detail-grid"><div className="da-detail-box"><p><strong>Customer:</strong> {safeText(selectedReceivable.customer_name)}</p><p><strong>Tagihan:</strong> {formatRupiah(selectedReceivable.original_amount)}</p><p><strong>Dibayar:</strong> {formatRupiah(selectedReceivable.paid_amount)}</p></div><div className="da-detail-box"><div className="da-mini-title">Sisa Piutang</div><div className="da-big-text">{formatRupiah(selectedReceivable.remaining_amount)}</div><Badge tone={getStatusTone(selectedReceivable.status)}>{safeText(selectedReceivable.status)}</Badge></div></div>{selectedReceivable.remaining_amount > 0 ? <div className="da-form-actions"><Button onClick={() => fillPaymentFromReceivable(selectedReceivable)}>Bayar Piutang</Button></div> : null}</> : null}
      </Modal>
    </div>
  );
}
