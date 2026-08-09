import { useEffect, useMemo, useState } from "react";
import {
  createOwnerObligation,
  getOwnerObligationBootstrap,
  getOwnerObligationDetail,
  payOwnerObligation,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import { allowedPaymentMethods, suggestedPaymentMethod } from "../../lib/finance/walletPolicy.js";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import FinanceSnapshot from "./FinanceSnapshot";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";

function isAuthRequired(result) {
  const code = String(result?.code || result?.error?.code || "").toUpperCase();
  return code === "UNAUTHORIZED" || code === "SESSION_EXPIRED" || code === "AUTH_REQUIRED";
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function ym() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toNumber(value) {
  const clean = String(value ?? "0").replace(/[^0-9.-]/g, "");
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value, fallback = "-") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function makeOperationId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const emptyObligationForm = {
  obligation_name: "",
  obligation_type: "Cicilan Usaha",
  due_day: "1",
  due_date: today(),
  monthly_amount: "0",
  original_amount: "0",
  total_tenor: "0",
  paid_tenor: "0",
  wallet_id: "",
  notes: "Kewajiban aktif.",
};

const emptyPaymentForm = {
  obligation_id: "",
  payment_date: today(),
  amount: "0",
  wallet_id: "",
  method: "Transfer",
  notes: "Pembayaran kewajiban owner.",
};

export default function KewajibanOwnerPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState({});
  const [obligationForm, setObligationForm] = useState(emptyObligationForm);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("obligations");

  const sessionToken = session?.sessionToken || session?.session_token || "";
  const summary = data.summary || {};
  const obligations = data.obligations || [];
  const payments = data.payments || [];
  const wallets = data.wallets || [];
  const hiddenRows = Number(data.hidden_rows || summary.hidden_rows || 0);

  const activeObligations = useMemo(() => {
    return obligations.filter((item) => {
      const status = String(item.status || "Active").toUpperCase();
      return status !== "LUNAS" && status !== "CLOSED" && status !== "VOID";
    });
  }, [obligations]);

  const selectedObligation = useMemo(() => {
    return obligations.find((item) => item.obligation_id === paymentForm.obligation_id);
  }, [obligations, paymentForm.obligation_id]);

  const selectedRemaining = toNumber(selectedObligation?.remaining_balance || selectedObligation?.remaining_amount || 0);
  const selectedPeriodDue = toNumber(selectedObligation?.period_due_amount ?? selectedObligation?.monthly_amount ?? selectedRemaining);
  const selectedIsRecurring = Number(selectedObligation?.is_recurring || 0) === 1;
  const selectedPayableNow = selectedIsRecurring ? selectedPeriodDue : selectedRemaining;
  const paymentAmount = toNumber(paymentForm.amount);
  const paymentAfter = selectedIsRecurring ? Math.max(0, selectedPayableNow - paymentAmount) : Math.max(0, selectedRemaining - paymentAmount);
  const selectedPaymentWallet = useMemo(() => wallets.find((wallet) => String(wallet.wallet_id) === String(paymentForm.wallet_id)) || null, [wallets, paymentForm.wallet_id]);
  const paymentMethods = useMemo(() => selectedPaymentWallet ? allowedPaymentMethods(selectedPaymentWallet) : ["Transfer", "Cash"], [selectedPaymentWallet]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const result = await getOwnerObligationBootstrap(sessionToken, {
        location_id: session?.user?.location_id || "TGR",
        period: ym(),
      });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal membaca Kewajiban Owner.");
        setData({});
        return;
      }
      const nextData = result.data || {};
      setData(nextData);
      const firstWallet = (nextData.wallets || [])[0]?.wallet_id || "";
      const firstObligation = (nextData.obligations || []).find((item) => String(item.status || "Active").toUpperCase() !== "LUNAS")?.obligation_id || "";
      setObligationForm((old) => ({ ...old, wallet_id: old.wallet_id || firstWallet }));
      setPaymentForm((old) => {
        const wallet = (nextData.wallets || []).find((item) => item.wallet_id === (old.wallet_id || firstWallet));
        return {
          ...old,
          wallet_id: old.wallet_id || firstWallet,
          obligation_id: old.obligation_id || firstObligation,
          method: old.wallet_id ? old.method : suggestedPaymentMethod(wallet || {}),
        };
      });
    } catch (err) {
      setError(err?.message || "Gagal koneksi ke backend.");
      setData({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionToken) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  function updateObligationField(field, value) {
    setObligationForm((old) => ({ ...old, [field]: value }));
  }

  function updatePaymentField(field, value) {
    setPaymentForm((old) => ({ ...old, [field]: value }));
  }

  async function handleCreateObligation(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await createOwnerObligation(sessionToken, {
        obligation: obligationForm,
        operation_id: makeOperationId("OBL-CREATE"),
      });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal menyimpan kewajiban.");
        return;
      }
      setMessage(result.message || "Kewajiban berhasil disimpan.");
      setObligationForm(emptyObligationForm);
      setCreateOpen(false);
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal menyimpan kewajiban.");
    } finally {
      setSaving(false);
    }
  }


  async function openObligationDetail(row) {
    setDetail(row);
    setDetailError("");
    if (!row?.obligation_id) return;
    setDetailLoading(true);
    try {
      const result = await getOwnerObligationDetail(sessionToken, { obligation_id: row.obligation_id });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setDetailError(result?.message || "Gagal membaca detail kewajiban.");
        return;
      }
      setDetail({ ...row, ...(result.data || {}), obligation: result.data?.obligation || row });
    } catch (err) {
      setDetailError(err?.message || "Gagal membaca detail kewajiban.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handlePayObligation(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await payOwnerObligation(sessionToken, {
        payment: paymentForm,
        operation_id: makeOperationId("OBL-PAY"),
      });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal membayar kewajiban.");
        return;
      }
      setMessage(result.message || "Pembayaran kewajiban berhasil dicatat.");
      setPaymentForm((old) => ({ ...emptyPaymentForm, wallet_id: old.wallet_id }));
      setPayOpen(false);
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal membayar kewajiban.");
    } finally {
      setSaving(false);
    }
  }

  const obligationColumns = [
    { key: "name", label: "Kewajiban", render: (row) => <strong>{text(row.obligation_name)}</strong> },
    { key: "type", label: "Jenis", render: (row) => text(row.obligation_type) },
    { key: "due", label: "Jatuh Tempo", render: (row) => row.due_day ? `Tgl ${row.due_day}` : formatDate(row.due_date) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.monthly_amount || row.amount) },
    { key: "remaining", label: "Sisa", render: (row) => <strong>{formatRupiah(row.remaining_balance)}</strong> },
    { key: "status", label: "Status", render: (row) => <Badge tone={String(row.status).toUpperCase() === "LUNAS" ? "success" : "warning"}>{text(row.status, "Active")}</Badge> },
  ];

  const paymentColumns = [
    { key: "date", label: "Tanggal", render: (row) => formatDate(row.payment_date || row.date) },
    { key: "id", label: "Payment ID", render: (row) => <strong>{text(row.payment_id)}</strong> },
    { key: "obligation", label: "Kewajiban", render: (row) => text(row.obligation_name) },
    { key: "wallet", label: "Dompet", render: (row) => text(row.wallet_name || row.wallet_id) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
    { key: "status", label: "Status", render: (row) => <Badge tone="success">{text(row.status, "Paid")}</Badge> },
  ];


  const cashExpenseColumns = [
    { key: "date", label: "Tanggal", render: (row) => formatDate(row.date || row.transaction_date) },
    { key: "id", label: "KASOUT ID", render: (row) => <strong>{text(row.cash_expense_id)}</strong> },
    { key: "desc", label: "Keterangan", render: (row) => text(row.description || row.recipient) },
    { key: "wallet", label: "Dompet", render: (row) => text(row.wallet_id) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
    { key: "status", label: "Status", render: (row) => <Badge tone="success">{text(row.status, "POSTED")}</Badge> },
  ];

  const mutationColumns = [
    { key: "date", label: "Tanggal", render: (row) => formatDate(row.date || row.transaction_date) },
    { key: "id", label: "Mutasi ID", render: (row) => <strong>{text(row.mutation_id || row.wallet_mutation_id)}</strong> },
    { key: "wallet", label: "Dompet", render: (row) => text(row.wallet_name || row.wallet_id) },
    { key: "direction", label: "Arah", render: () => <Badge tone="danger">OUT</Badge> },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
    { key: "source", label: "Sumber", render: (row) => text(row.source_id || row.source_ref) },
  ];

  const traceColumns = [
    { key: "step", label: "Step", render: (row) => row.step },
    { key: "label", label: "Rantai", render: (row) => <strong>{text(row.label)}</strong> },
    { key: "id", label: "ID", render: (row) => text(row.id) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
    { key: "status", label: "Status", render: (row) => <Badge tone={String(row.status).toUpperCase().includes("BELUM") ? "warning" : "success"}>{text(row.status)}</Badge> },
  ];

  return (
    <div className="da-finance-page">
      <PageHeader
        eyebrow="Uang & Kewajiban"
        title="Kewajiban Owner"
        description="Pantau cicilan usaha dan tagihan rutin, jatuh tempo, serta pembayaran yang keluar dari dompet usaha."
        actions={(
          <div className="da-actions">
            <Button variant="ghost" onClick={loadData} disabled={loading}>{loading ? "Memuat..." : "Perbarui"}</Button>
            <Button variant="ghost" onClick={() => setCreateOpen(true)}>+ Tambah Kewajiban</Button>
            <Button onClick={() => setPayOpen(true)} disabled={!activeObligations.length}>+ Bayar Kewajiban</Button>
          </div>
        )}
      />

      {error ? <div className="da-alert da-alert-danger">{error}</div> : null}
      {message ? <div className="da-form-success">{message}</div> : null}

      <FinanceSnapshot
        eyebrow="Kewajiban Usaha"
        value={loading ? "..." : formatRupiah(summary.total_remaining || 0)}
        caption={`${summary.active_count || 0} kewajiban aktif · ${summary.due_count || 0} perlu dibayar periode ini.`}
        metrics={[
          { label: "Jatuh Tempo Periode Ini", value: loading ? "..." : formatRupiah(summary.due_this_month || 0), helper: `Dibayar ${formatRupiah(summary.paid_this_month || 0)}`, tone: "warning" },
          { label: "Lewat Jatuh Tempo", value: loading ? "..." : String(summary.overdue_count || 0), helper: Number(summary.overdue_count || 0) > 0 ? formatRupiah(summary.overdue_amount || 0) : "Tidak ada keterlambatan", tone: Number(summary.overdue_count || 0) > 0 ? "danger" : "success" },
          { label: "Kewajiban Aktif", value: loading ? "..." : String(summary.active_count || 0), helper: "Cicilan dan tagihan yang dipantau" },
        ]}
      />

      <div className="da-finance-workspace">
        <Card className="da-finance-main-card">
          <div className="da-section-heading">
            <div><div className="da-page-kicker">Daftar Kewajiban</div><h2 style={{ margin: "4px 0 6px" }}>Kewajiban yang Dipantau</h2><p className="da-muted" style={{ margin: 0 }}>Klik baris untuk melihat pembayaran, kas keluar, dan mutasi dompet terkait.</p></div>
            <Button variant="ghost" onClick={() => setCreateOpen(true)}>+ Tambah</Button>
          </div>
          <div className="da-finance-tabs">
            <button className={activeTab === "obligations" ? "active" : ""} onClick={() => setActiveTab("obligations")}>Kewajiban</button>
            <button className={activeTab === "payments" ? "active" : ""} onClick={() => setActiveTab("payments")}>Riwayat Pembayaran</button>
          </div>
          {activeTab === "obligations" ? (
            <DataTable
              columns={[
                ...obligationColumns.slice(0, 3),
                { key: "due_period", label: "Tagihan Periode", render: (row) => <strong>{formatRupiah(row.period_due_amount ?? row.monthly_amount ?? 0)}</strong> },
                { key: "remaining", label: "Sisa Tetap", render: (row) => Number(row.is_recurring || 0) === 1 ? <span className="da-muted">Rutin</span> : <strong>{formatRupiah(row.remaining_balance)}</strong> },
                { key: "status_period", label: "Status", render: (row) => row.is_overdue ? <Badge tone="danger">Terlambat</Badge> : Number(row.period_due_amount || 0) <= 0 ? <Badge tone="success">Periode Lunas</Badge> : <Badge tone="warning">Menunggu Bayar</Badge> },
              ]}
              rows={obligations}
              getRowKey={(row) => row.obligation_id}
              onRowClick={openObligationDetail}
            />
          ) : <DataTable columns={paymentColumns} rows={payments} getRowKey={(row) => row.payment_id} />}
          {!loading && (activeTab === "obligations" ? obligations.length === 0 : payments.length === 0) ? <div className="da-finance-empty">Belum ada data pada bagian ini.</div> : null}
        </Card>

        <Card className="da-finance-side-card">
          <div className="da-page-kicker">Posisi Periode</div>
          <h2 style={{ margin: "6px 0 6px" }}>Jadwal Pembayaran</h2>
          <p className="da-muted">Ringkasan kewajiban bulan berjalan setelah pembayaran yang sudah tercatat.</p>
          <div className="da-finance-hero-number da-finance-hero-number-dark"><span>Sisa yang perlu dibayar</span><strong>{formatRupiah(summary.due_this_month || 0)}</strong><small>{summary.due_count || 0} kewajiban</small></div>
          <div className="da-finance-metric-list">
            <div><span>Sudah dibayar</span><strong>{formatRupiah(summary.paid_this_month || 0)}</strong></div>
            <div><span>Terlambat</span><strong>{formatRupiah(summary.overdue_amount || 0)}</strong></div>
            <div><span>Riwayat bayar</span><strong>{summary.payment_count || 0}</strong></div>
            <div><span>Mutasi keluar</span><strong>{summary.wallet_mutation_count || 0}</strong></div>
          </div>
          <Button onClick={() => setPayOpen(true)} disabled={!activeObligations.length}>Bayar Kewajiban</Button>
          <div className="da-finance-note">Tagihan rutin dihitung per periode. Cicilan dengan total pokok tetap tetap menampilkan saldo sisa sampai lunas.</div>
        </Card>
      </div>

      <Modal open={createOpen} size="lg" title="Tambah Kewajiban" subtitle="Cicilan usaha atau tagihan rutin" onClose={() => !saving && setCreateOpen(false)}>
        <form onSubmit={handleCreateObligation} className="da-finance-modal-panel">
          <div className="da-finance-modal-form">
            <label className="da-field"><span>Nama Kewajiban</span><input value={obligationForm.obligation_name} onChange={(e) => updateObligationField("obligation_name", e.target.value)} placeholder="Contoh: Angsuran Mobil" /></label>
            <label className="da-field"><span>Jenis</span><select value={obligationForm.obligation_type} onChange={(e) => updateObligationField("obligation_type", e.target.value)}><option>Cicilan Usaha</option><option>Tagihan Rutin</option><option>Kontrakan</option><option>BPJS</option><option>Wifi</option><option>Listrik</option><option>Parkir</option><option>Lainnya</option></select></label>
            <label className="da-field"><span>Jatuh Tempo Tanggal</span><input type="number" min="1" max="31" value={obligationForm.due_day} onChange={(e) => updateObligationField("due_day", e.target.value)} /></label>
            <label className="da-field"><span>Nominal Bulanan</span><input inputMode="numeric" value={obligationForm.monthly_amount} onChange={(e) => updateObligationField("monthly_amount", e.target.value)} /></label>
            <label className="da-field"><span>Total Pokok / Saldo Awal</span><input inputMode="numeric" value={obligationForm.original_amount} onChange={(e) => updateObligationField("original_amount", e.target.value)} placeholder="0 untuk tagihan rutin" /></label>
            <label className="da-field"><span>Total Tenor</span><input type="number" min="0" value={obligationForm.total_tenor} onChange={(e) => updateObligationField("total_tenor", e.target.value)} /></label>
            <label className="da-field"><span>Tenor Sudah Dibayar</span><input type="number" min="0" value={obligationForm.paid_tenor} onChange={(e) => updateObligationField("paid_tenor", e.target.value)} /></label>
            <label className="da-field"><span>Dompet Default</span><select value={obligationForm.wallet_id} onChange={(e) => updateObligationField("wallet_id", e.target.value)}><option value="">Pilih dompet</option>{wallets.map((wallet) => <option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name || wallet.wallet_id}</option>)}</select></label>
            <label className="da-field da-finance-span-2"><span>Catatan</span><input value={obligationForm.notes} onChange={(e) => updateObligationField("notes", e.target.value)} /></label>
          </div>
          <div className="da-finance-preview-row"><div><span>Nama</span><strong>{text(obligationForm.obligation_name, "Kewajiban baru")}</strong></div><div><span>Per bulan</span><strong>{formatRupiah(obligationForm.monthly_amount)}</strong></div><div><span>Total pokok</span><strong>{formatRupiah(obligationForm.original_amount)}</strong></div></div>
          <div className="da-form-actions"><Button variant="ghost" type="button" onClick={() => setCreateOpen(false)} disabled={saving}>Batal</Button><Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Kewajiban"}</Button></div>
        </form>
      </Modal>

      <Modal open={payOpen} size="lg" title="Bayar Kewajiban" subtitle="Pembayaran akan mengurangi dompet usaha" onClose={() => !saving && setPayOpen(false)}>
        <form onSubmit={handlePayObligation} className="da-finance-modal-panel">
          <div className="da-finance-modal-form">
            <label className="da-field da-finance-span-2"><span>Kewajiban</span><select value={paymentForm.obligation_id} onChange={(e) => updatePaymentField("obligation_id", e.target.value)}><option value="">Pilih kewajiban</option>{activeObligations.map((item) => <option key={item.obligation_id} value={item.obligation_id}>{item.obligation_name} · perlu dibayar {formatRupiah(item.period_due_amount ?? item.remaining_balance ?? item.monthly_amount)}</option>)}</select></label>
            <label className="da-field"><span>Tanggal Bayar</span><input type="date" value={paymentForm.payment_date} onChange={(e) => updatePaymentField("payment_date", e.target.value)} /></label>
            <label className="da-field"><span>Nominal Bayar</span><input inputMode="numeric" value={paymentForm.amount} onChange={(e) => updatePaymentField("amount", e.target.value)} /></label>
            <label className="da-field"><span>Dompet Pembayaran</span><select value={paymentForm.wallet_id} onChange={(e) => { const wallet = wallets.find((item) => String(item.wallet_id) === String(e.target.value)); setPaymentForm((old) => ({ ...old, wallet_id: e.target.value, method: suggestedPaymentMethod(wallet || {}) })); }}><option value="">Pilih dompet</option>{wallets.map((wallet) => <option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name || wallet.wallet_id}</option>)}</select></label>
            <label className="da-field"><span>Metode</span><select value={paymentForm.method} onChange={(e) => updatePaymentField("method", e.target.value)}>{paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
            <label className="da-field da-finance-span-2"><span>Catatan</span><input value={paymentForm.notes} onChange={(e) => updatePaymentField("notes", e.target.value)} /></label>
          </div>
          <div className="da-finance-preview-row"><div><span>Tagihan sekarang</span><strong>{formatRupiah(selectedPayableNow)}</strong></div><div><span>Dibayar</span><strong>{formatRupiah(paymentAmount)}</strong></div><div><span>Sisa periode</span><strong>{formatRupiah(paymentAfter)}</strong></div></div>
          <div className="da-form-actions"><Button variant="ghost" type="button" onClick={() => setPayOpen(false)} disabled={saving}>Batal</Button><Button type="submit" disabled={saving || !paymentForm.obligation_id || paymentAmount <= 0}>{saving ? "Menyimpan..." : "Simpan Pembayaran"}</Button></div>
        </form>
      </Modal>

      {detail ? <Modal open title="Detail Kewajiban" subtitle={detail?.obligation?.obligation_name || detail?.obligation_name || ""} onClose={() => { setDetail(null); setDetailError(""); }}>
        {detailLoading ? <div className="da-alert da-alert-warning">Membaca detail...</div> : null}
        {detailError ? <div className="da-alert da-alert-danger">{detailError}</div> : null}
        {(() => { const activeDetail = detail.obligation || detail; const detailPayments = detail.payments || payments.filter((row) => row.obligation_id === activeDetail.obligation_id); const detailCash = detail.cash_expenses || []; const detailMutations = detail.wallet_mutations || []; const detailSummary = detail.summary || {}; return (
          <div className="da-finance-modal-panel">
            <div className="da-modal-summary"><div><div className="da-mini-title">{text(activeDetail.obligation_type)}</div><div className="da-big-text">{text(activeDetail.obligation_name)}</div><p className="da-muted">Jatuh tempo tanggal {activeDetail.due_day || "-"}</p></div><Badge tone={activeDetail.is_overdue ? "danger" : String(activeDetail.status).toUpperCase() === "LUNAS" ? "success" : "warning"}>{activeDetail.is_overdue ? "Terlambat" : text(activeDetail.status, "Aktif")}</Badge></div>
            <div className="da-detail-grid"><div className="da-detail-box"><p><strong>Nominal bulanan:</strong> {formatRupiah(activeDetail.monthly_amount)}</p><p><strong>Tagihan periode:</strong> {formatRupiah(activeDetail.period_due_amount ?? activeDetail.monthly_amount)}</p><p><strong>Dibayar periode:</strong> {formatRupiah(activeDetail.period_paid_amount || 0)}</p></div><div className="da-detail-box"><p><strong>Sisa tetap:</strong> {Number(activeDetail.is_recurring || 0) === 1 ? "Tagihan rutin" : formatRupiah(activeDetail.remaining_balance)}</p><p><strong>Total dibayar:</strong> {formatRupiah(detailSummary.paid_total || 0)}</p><p><strong>Mutasi terkait:</strong> {detailSummary.mutation_count || detailMutations.length}</p></div></div>
            <div className="da-finance-detail-section"><h3>Pembayaran</h3><DataTable columns={paymentColumns} rows={detailPayments} getRowKey={(row) => row.payment_id} /></div>
            <div className="da-finance-detail-section"><h3>Kas Keluar Terkait</h3><DataTable columns={cashExpenseColumns} rows={detailCash} getRowKey={(row) => row.cash_expense_id} /></div>
            <div className="da-finance-detail-section"><h3>Mutasi Dompet</h3><DataTable columns={mutationColumns} rows={detailMutations} getRowKey={(row) => row.mutation_id || row.wallet_mutation_id} /></div>
          </div>
        ); })()}
      </Modal> : null}
    </div>
  );
}
