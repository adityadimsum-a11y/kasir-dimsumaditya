import { useEffect, useMemo, useState } from "react";
import {
  getMoneyInBootstrap,
  recordCustomerReceivablePayment,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { allowedPaymentMethods, suggestedPaymentMethod } from "../../lib/finance/walletPolicy.js";
import OtherIncomePanel from "./OtherIncomePanel";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";

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

function formatInputDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
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

function getStatusTone(status) {
  const value = String(status || "").toUpperCase();
  if (value.includes("LUNAS") || value.includes("PAID") || value.includes("POSTED") || value.includes("SETTLED")) return "success";
  if (value.includes("VOID") || value.includes("BATAL") || value.includes("CANCEL")) return "danger";
  if (value.includes("BELUM") || value.includes("PIUTANG") || value.includes("OPEN") || value.includes("PARTIAL") || value.includes("DP")) return "warning";
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
    method: row.payment_method || row.method || row.wallet_name || row.wallet_code || "-",
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
    direction: row.direction || row.mutation_type || "IN",
    amount: numberValue(row.amount || row.nominal || row.debit || row.credit || 0),
    status: row.status || "Tercatat",
  };
}

function normalizeWallet(row) {
  return {
    ...row,
    wallet_id: row.wallet_id || row.id || row.code || row.wallet_code || "",
    wallet_name: row.wallet_name || row.name || row.account_name || row.nama_dompet || row.wallet_code || "Dompet",
    wallet_code: row.wallet_code || row.code || "",
    location_id: row.location_id || "",
    status: row.status || "Active",
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
  };
}

function buildRequestId() {
  return `PAYIN-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

const defaultForm = {
  receivable_id: "",
  payment_date: new Date().toISOString().slice(0, 10),
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
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [activeTab, setActiveTab] = useState("payments");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedReceivable, setSelectedReceivable] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const summary = useMemo(() => buildSummary(bootstrap), [bootstrap]);

  const payments = useMemo(() => {
    return asArray(bootstrap?.payments).map(normalizePayment);
  }, [bootstrap]);

  const receivables = useMemo(() => {
    return asArray(bootstrap?.receivables).map(normalizeReceivable);
  }, [bootstrap]);

  const wallets = useMemo(() => {
    return asArray(bootstrap?.wallets).map(normalizeWallet).filter((row) => row.wallet_id);
  }, [bootstrap]);

  const walletMutations = useMemo(() => {
    return asArray(bootstrap?.wallet_mutations).map(normalizeWalletMutation);
  }, [bootstrap]);

  const selectedFormReceivable = useMemo(() => {
    return receivables.find((row) => String(row.receivable_id) === String(form.receivable_id)) || null;
  }, [receivables, form.receivable_id]);

  const selectedWallet = useMemo(() => {
    return wallets.find((row) => String(row.wallet_id) === String(form.wallet_id)) || null;
  }, [wallets, form.wallet_id]);

  const paymentMethods = useMemo(() => {
    return selectedWallet ? allowedPaymentMethods(selectedWallet) : ["Transfer", "Cash", "QRIS"];
  }, [selectedWallet]);

  const paymentAmount = numberValue(form.amount);
  const remainingAfterPayment = selectedFormReceivable
    ? Math.max(numberValue(selectedFormReceivable.remaining_amount) - paymentAmount, 0)
    : 0;

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getMoneyInBootstrap(session?.sessionToken, {
      source: "frontend_part_4q_uang_masuk_bayar_piutang_live",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal membaca data Uang Masuk.");
      setBootstrap(null);
      setLoading(false);
      return;
    }

    setBootstrap(result.data || {});
    setNeedsRefresh(false);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionToken]);

  useEffect(() => {
    if (!form.receivable_id && receivables.length > 0) {
      setForm((current) => ({ ...current, receivable_id: receivables[0].receivable_id }));
    }
  }, [receivables, form.receivable_id]);

  useEffect(() => {
    if (!form.wallet_id && wallets.length > 0) {
      const wallet = wallets[0];
      setForm((current) => ({
        ...current,
        wallet_id: wallet.wallet_id,
        payment_method: suggestedPaymentMethod(wallet),
      }));
    }
  }, [wallets, form.wallet_id]);

  const updateForm = (field, value) => {
    setSuccessMessage("");
    setError("");
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validatePayment = () => {
    if (!selectedFormReceivable) return "Pilih piutang yang mau dibayar.";
    if (!selectedWallet) return "Pilih dompet tujuan uang masuk.";
    if (paymentAmount <= 0) return "Nominal pembayaran harus lebih dari Rp0.";
    if (paymentAmount > numberValue(selectedFormReceivable.remaining_amount)) {
      return `Nominal melebihi sisa piutang ${formatRupiah(selectedFormReceivable.remaining_amount)}.`;
    }
    return "";
  };

  const openConfirm = () => {
    const validationMessage = validatePayment();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    setConfirmOpen(true);
  };

  const submitPayment = async () => {
    const validationMessage = validatePayment();
    if (validationMessage) {
      setError(validationMessage);
      setConfirmOpen(false);
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    const result = await recordCustomerReceivablePayment(session?.sessionToken, {
      request_id: buildRequestId(),
      operation_id: buildRequestId(),
      receivable_id: selectedFormReceivable.receivable_id,
      invoice_id: selectedFormReceivable.invoice_id,
      order_id: selectedFormReceivable.order_id,
      wallet_id: selectedWallet.wallet_id,
      payment_date: form.payment_date,
      payment_method: form.payment_method,
      amount: paymentAmount,
      notes: form.notes,
      source: "frontend_part_4q_uang_masuk_bayar_piutang_live",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal menyimpan pembayaran piutang.");
      setSaving(false);
      setConfirmOpen(false);
      return;
    }

    setSuccessMessage(result.message || "Pembayaran piutang berhasil dicatat.");
    setConfirmOpen(false);
    setSaving(false);
    setForm({ ...defaultForm, payment_date: new Date().toISOString().slice(0, 10) });
    setActiveTab("payments");
    setNeedsRefresh(true);
  };

  const fillPaymentFromReceivable = (receivable) => {
    setForm((current) => ({
      ...current,
      receivable_id: receivable.receivable_id,
      amount: String(receivable.remaining_amount || ""),
      notes: `Pembayaran piutang ${receivable.receivable_id}`,
    }));
    setSelectedReceivable(null);
    setActiveTab("receivables");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const paymentColumns = [
    { key: "payment_date", label: "Tanggal", render: (row) => formatDisplayDate(row.payment_date) },
    { key: "payment_id", label: "Payment ID", render: (row) => <strong>{safeText(row.payment_id)}</strong> },
    { key: "customer_name", label: "Customer", render: (row) => safeText(row.customer_name) },
    { key: "amount", label: "Uang Masuk", render: (row) => formatRupiah(row.amount) },
    { key: "wallet_name", label: "Dompet", render: (row) => safeText(row.wallet_name || row.method) },
    { key: "source_id", label: "Sumber", render: (row) => safeText(row.source_id) },
    { key: "status", label: "Status", render: (row) => <Badge tone={getStatusTone(row.status)}>{safeText(row.status)}</Badge> },
  ];

  const receivableColumns = [
    { key: "receivable_date", label: "Tanggal", render: (row) => formatDisplayDate(row.receivable_date) },
    { key: "receivable_id", label: "Piutang ID", render: (row) => <strong>{safeText(row.receivable_id)}</strong> },
    { key: "customer_name", label: "Customer", render: (row) => safeText(row.customer_name) },
    { key: "original_amount", label: "Tagihan", render: (row) => formatRupiah(row.original_amount) },
    { key: "paid_amount", label: "Sudah Dibayar", render: (row) => formatRupiah(row.paid_amount) },
    { key: "remaining_amount", label: "Sisa", render: (row) => <strong>{formatRupiah(row.remaining_amount)}</strong> },
    { key: "status", label: "Status", render: (row) => <Badge tone={getStatusTone(row.status)}>{safeText(row.status)}</Badge> },
  ];

  const walletColumns = [
    { key: "date", label: "Tanggal", render: (row) => formatDisplayDate(row.date) },
    { key: "mutation_id", label: "Mutasi ID", render: (row) => <strong>{safeText(row.mutation_id)}</strong> },
    { key: "wallet_name", label: "Dompet", render: (row) => safeText(row.wallet_name) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
    { key: "source_id", label: "Sumber", render: (row) => safeText(row.source_id) },
    { key: "status", label: "Status", render: (row) => <Badge tone={getStatusTone(row.status)}>{safeText(row.status)}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Uang Masuk"
        description="Catat pembayaran aktual customer dan pantau piutang. 4 Amplop hanya boleh ambil dari uang yang benar-benar masuk."
        badge="Pembayaran Aktif"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Uang aktual</div>
          <div className="da-dashboard-banner-title">Piutang → Payment → Dompet → 4 Amplop</div>
          <div className="da-dashboard-banner-desc">
            Payment di sini mengurangi sisa piutang, membuat catatan uang masuk, dan membuat mutasi dompet IN. PO dan stok tetap tidak dihitung sebagai uang masuk.
          </div>
        </div>

        <div className="da-dashboard-banner-actions">
          <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Dicek" : "Terhubung"}</Badge>
          <Button variant="ghost" onClick={loadData} disabled={loading || saving}>
            {loading ? "Membaca..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      {successMessage ? (
        <div className="da-form-success" style={{ marginBottom: 16 }}>
          {successMessage}
          {needsRefresh ? (
            <div style={{ marginTop: 6, fontWeight: 700 }}>
              Data sudah tersimpan cepat. Klik Refresh Data kalau mau tarik ulang payment, piutang, dan mutasi dompet terbaru.
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="da-login-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      <div className="da-grid da-grid-3">
        <StatCard tone="primary" label="Uang Masuk Aktual" value={loading ? "..." : formatRupiah(summary.uang_masuk_actual)} description="Total pembayaran yang benar-benar masuk." />
        <StatCard label="Uang Masuk Hari Ini" value={loading ? "..." : formatRupiah(summary.today_uang_masuk)} description="Pembayaran aktual tanggal hari ini." />
        <StatCard tone="warning" label="Sisa Piutang" value={loading ? "..." : formatRupiah(summary.piutang_open)} description="Tagihan customer yang belum lunas." />
      </div>

      <div style={{ height: 16 }} />

      <div className="da-grid da-grid-3">
        <StatCard label="Jumlah Payment" value={loading ? "..." : summary.payment_count} description="Jumlah pembayaran yang terbaca." />
        <StatCard label="Piutang Aktif" value={loading ? "..." : summary.receivable_count} description="Jumlah catatan piutang aktif." />
        <StatCard label="Mutasi Dompet Masuk" value={loading ? "..." : summary.wallet_in_count} description="Mutasi dompet masuk yang terkait pembayaran." />
      </div>

      <div style={{ height: 18 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Input Live</div>
            <div className="da-big-text">Catat Pembayaran Piutang</div>
            <p className="da-muted">Pilih piutang, pilih dompet tujuan, lalu simpan. Sistem akan mencatat payment dan mutasi dompet masuk.</p>
          </div>
          <Badge tone="warning">Masuk Dompet</Badge>
        </div>

        <div className="da-form-grid" style={{ gridTemplateColumns: "1.5fr 1fr 1fr" }}>
          <label className="da-field-label">
            Piutang Customer
            <select
              className="da-input"
              value={form.receivable_id}
              onChange={(event) => updateForm("receivable_id", event.target.value)}
              disabled={saving || receivables.length === 0}
            >
              {receivables.length === 0 ? <option value="">Belum ada piutang aktif</option> : null}
              {receivables.map((row) => (
                <option key={row.receivable_id} value={row.receivable_id}>
                  {row.customer_name} · {row.receivable_id} · sisa {formatRupiah(row.remaining_amount)}
                </option>
              ))}
            </select>
          </label>

          <label className="da-field-label">
            Tanggal Bayar
            <input
              type="date"
              className="da-input"
              value={formatInputDate(form.payment_date)}
              onChange={(event) => updateForm("payment_date", event.target.value)}
              disabled={saving}
            />
          </label>

          <label className="da-field-label">
            Dompet Tujuan
            <select
              className="da-input"
              value={form.wallet_id}
              onChange={(event) => {
                const wallet = wallets.find((row) => String(row.wallet_id) === String(event.target.value));
                setSuccessMessage("");
                setError("");
                setForm((current) => ({
                  ...current,
                  wallet_id: event.target.value,
                  payment_method: suggestedPaymentMethod(wallet || {}),
                }));
              }}
              disabled={saving || wallets.length === 0}
            >
              {wallets.length === 0 ? <option value="">Belum ada dompet</option> : null}
              {wallets.map((wallet) => (
                <option key={wallet.wallet_id} value={wallet.wallet_id}>
                  {wallet.wallet_name} {wallet.wallet_code ? `· ${wallet.wallet_code}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="da-field-label">
            Nominal Dibayar
            <input
              type="number"
              min="0"
              className="da-input"
              value={form.amount}
              onChange={(event) => updateForm("amount", event.target.value)}
              placeholder="Contoh: 500000"
              disabled={saving}
            />
          </label>

          <label className="da-field-label">
            Metode
            <select
              className="da-input"
              value={form.payment_method}
              onChange={(event) => updateForm("payment_method", event.target.value)}
              disabled={saving}
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </label>

          <label className="da-field-label">
            Catatan
            <input
              className="da-input"
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              placeholder="Catatan pembayaran"
              disabled={saving}
            />
          </label>
        </div>

        <div className="da-form-preview" style={{ marginTop: 14 }}>
          <strong>Preview:</strong>{" "}
          {selectedFormReceivable ? (
            <span>
              {selectedFormReceivable.customer_name} · sisa awal {formatRupiah(selectedFormReceivable.remaining_amount)} · dibayar {formatRupiah(paymentAmount)} · sisa akhir {formatRupiah(remainingAfterPayment)} · dompet {safeText(selectedWallet?.wallet_name)}
            </span>
          ) : (
            <span>Pilih piutang untuk melihat preview.</span>
          )}
        </div>

        <div className="da-form-actions" style={{ marginTop: 16 }}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setForm({ ...defaultForm, payment_date: new Date().toISOString().slice(0, 10) })}
            disabled={saving}
          >
            Reset
          </Button>
          <Button type="button" onClick={openConfirm} disabled={saving || loading || receivables.length === 0 || wallets.length === 0}>
            Preview & Simpan Payment
          </Button>
        </div>
      </Card>

      <OtherIncomePanel
        session={session}
        wallets={wallets}
        onSaved={loadData}
        onSessionExpired={onSessionExpired}
      />

      <div style={{ height: 18 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Pantau Uang</div>
            <div className="da-big-text">Pembayaran & Piutang</div>
            <p className="da-muted">Klik baris untuk melihat rantai order, invoice, payment, dompet, dan status piutang.</p>
          </div>
          <Badge tone="success">Data Aktual</Badge>
        </div>

        <div className="da-tabs">
          <button type="button" className={activeTab === "payments" ? "da-tab active" : "da-tab"} onClick={() => setActiveTab("payments")}>Uang Masuk</button>
          <button type="button" className={activeTab === "receivables" ? "da-tab active" : "da-tab"} onClick={() => setActiveTab("receivables")}>Piutang</button>
          <button type="button" className={activeTab === "wallets" ? "da-tab active" : "da-tab"} onClick={() => setActiveTab("wallets")}>Mutasi Dompet</button>
        </div>

        {activeTab === "payments" ? <DataTable columns={paymentColumns} rows={loading ? [] : payments} getRowKey={(row, index) => row.payment_id || index} onRowClick={setSelectedPayment} /> : null}
        {activeTab === "receivables" ? <DataTable columns={receivableColumns} rows={loading ? [] : receivables} getRowKey={(row, index) => row.receivable_id || index} onRowClick={setSelectedReceivable} /> : null}
        {activeTab === "wallets" ? <DataTable columns={walletColumns} rows={loading ? [] : walletMutations} getRowKey={(row, index) => row.mutation_id || index} /> : null}
      </Card>

      <Modal open={confirmOpen} title="Konfirmasi Pembayaran Piutang" subtitle={selectedFormReceivable?.receivable_id || ""} onClose={() => setConfirmOpen(false)}>
        <div>
          <div className="da-modal-summary">
            <div>
              <div className="da-mini-title">Nominal Masuk Dompet</div>
              <div className="da-big-text">{formatRupiah(paymentAmount)}</div>
              <p className="da-muted">Customer: <strong>{safeText(selectedFormReceivable?.customer_name)}</strong></p>
            </div>
            <Badge tone="success">Payment IN</Badge>
          </div>
          <div className="da-detail-grid">
            <div className="da-detail-box">
              <div className="da-mini-title">Piutang</div>
              <p><strong>Piutang ID:</strong> {safeText(selectedFormReceivable?.receivable_id)}</p>
              <p><strong>Invoice:</strong> {safeText(selectedFormReceivable?.invoice_id)}</p>
              <p><strong>Sisa awal:</strong> {formatRupiah(selectedFormReceivable?.remaining_amount || 0)}</p>
              <p><strong>Sisa akhir:</strong> {formatRupiah(remainingAfterPayment)}</p>
            </div>
            <div className="da-detail-box">
              <div className="da-mini-title">Uang Masuk</div>
              <p><strong>Tanggal:</strong> {formatDisplayDate(form.payment_date)}</p>
              <p><strong>Dompet:</strong> {safeText(selectedWallet?.wallet_name)}</p>
              <p><strong>Metode:</strong> {safeText(form.payment_method)}</p>
              <p><strong>Catatan:</strong> {safeText(form.notes)}</p>
            </div>
          </div>
          <div className="da-form-actions" style={{ marginTop: 16 }}>
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>Batal</Button>
            <Button type="button" onClick={submitPayment} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Pembayaran"}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(selectedPayment)} title="Detail Uang Masuk" subtitle={selectedPayment?.payment_id || ""} onClose={() => setSelectedPayment(null)}>
        {selectedPayment ? (
          <div>
            <div className="da-modal-summary">
              <div>
                <div className="da-mini-title">Uang Masuk Aktual</div>
                <div className="da-big-text">{formatRupiah(selectedPayment.amount)}</div>
                <p className="da-muted">Customer: <strong>{safeText(selectedPayment.customer_name)}</strong></p>
              </div>
              <Badge tone={getStatusTone(selectedPayment.status)}>{safeText(selectedPayment.status)}</Badge>
            </div>
            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-mini-title">Pembayaran</div>
                <p><strong>ID:</strong> {safeText(selectedPayment.payment_id)}</p>
                <p><strong>Tanggal:</strong> {formatDisplayDate(selectedPayment.payment_date)}</p>
                <p><strong>Metode:</strong> {safeText(selectedPayment.method)}</p>
                <p><strong>Dompet:</strong> {safeText(selectedPayment.wallet_name)}</p>
              </div>
              <div className="da-detail-box">
                <div className="da-mini-title">Rantai Transaksi</div>
                <p><strong>Order:</strong> {safeText(selectedPayment.order_id)}</p>
                <p><strong>Invoice:</strong> {safeText(selectedPayment.invoice_id)}</p>
                <p><strong>Sumber:</strong> {safeText(selectedPayment.source_id)}</p>
                <p><strong>Catatan:</strong> Uang ini bisa menjadi sumber 4 Amplop.</p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(selectedReceivable)} title="Detail Piutang" subtitle={selectedReceivable?.receivable_id || ""} onClose={() => setSelectedReceivable(null)}>
        {selectedReceivable ? (
          <div>
            <div className="da-modal-summary">
              <div>
                <div className="da-mini-title">Sisa Tagihan</div>
                <div className="da-big-text">{formatRupiah(selectedReceivable.remaining_amount)}</div>
                <p className="da-muted">Customer: <strong>{safeText(selectedReceivable.customer_name)}</strong></p>
              </div>
              <Badge tone={getStatusTone(selectedReceivable.status)}>{safeText(selectedReceivable.status)}</Badge>
            </div>
            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-mini-title">Piutang</div>
                <p><strong>ID:</strong> {safeText(selectedReceivable.receivable_id)}</p>
                <p><strong>Tanggal:</strong> {formatDisplayDate(selectedReceivable.receivable_date)}</p>
                <p><strong>Tagihan awal:</strong> {formatRupiah(selectedReceivable.original_amount)}</p>
                <p><strong>Sudah dibayar:</strong> {formatRupiah(selectedReceivable.paid_amount)}</p>
              </div>
              <div className="da-detail-box">
                <div className="da-mini-title">Rantai Transaksi</div>
                <p><strong>Order:</strong> {safeText(selectedReceivable.order_id)}</p>
                <p><strong>Invoice:</strong> {safeText(selectedReceivable.invoice_id)}</p>
                <p><strong>Jatuh tempo:</strong> {formatDisplayDate(selectedReceivable.due_date)}</p>
                <p><strong>Catatan:</strong> Belum masuk 4 Amplop sampai dibayar.</p>
              </div>
            </div>
            <div className="da-form-actions" style={{ marginTop: 16 }}>
              <Button type="button" variant="ghost" onClick={() => setSelectedReceivable(null)}>Tutup</Button>
              <Button type="button" onClick={() => fillPaymentFromReceivable(selectedReceivable)} disabled={selectedReceivable.remaining_amount <= 0}>
                Bayar Piutang Ini
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
