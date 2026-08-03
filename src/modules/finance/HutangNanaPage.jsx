import { useEffect, useMemo, useState } from "react";
import {
  getHutangNanaBootstrap,
  recordHutangNanaPayment,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { allowedPaymentMethods, suggestedPaymentMethod } from "../../lib/finance/walletPolicy";
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

function looksLikeFallbackId(value) {
  return /^Tab[A-Za-z0-9_]+-ROW-\d+$/i.test(String(value || "").trim());
}

function isRealPayable(row) {
  const id = String(row?.payable_id || row?.payable_no || "").trim();
  const amount = numberValue(row?.original_amount || row?.remaining_amount || row?.paid_amount || 0);
  return Boolean(id) && !looksLikeFallbackId(id) && amount > 0;
}

function isRealPayment(row) {
  const id = String(row?.payable_payment_id || row?.payable_payment_no || "").trim();
  const amount = numberValue(row?.amount || 0);
  return Boolean(id) && !looksLikeFallbackId(id) && amount > 0;
}

function isRealWalletMutation(row) {
  const id = String(row?.mutation_id || "").trim();
  const amount = numberValue(row?.amount || 0);
  return Boolean(id) && !looksLikeFallbackId(id) && amount > 0;
}

function hasPaymentMutation(payment) {
  return Boolean(String(payment?.wallet_mutation_id || payment?.mutation_id || "").trim());
}

function createOperationId() {
  return `HUTNANA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function normalizePayable(row) {
  const originalAmount = numberValue(row.original_amount || row.amount || row.total_amount || 0);
  const paidAmount = numberValue(row.paid_amount || row.total_paid || 0);
  const remainingAmount = numberValue(
    row.remaining_amount ?? row.sisa_hutang ?? Math.max(originalAmount - paidAmount, 0)
  );

  return {
    ...row,
    payable_id: row.payable_id || row.id || row.payable_no || "",
    payable_no: row.payable_no || row.payable_id || row.id || "",
    payable_date: row.payable_date || row.date || row.created_at || "",
    due_date: row.due_date || "",
    payable_type: row.payable_type || row.type || "Hutang Usaha",
    vendor_name: row.vendor_name || row.supplier_name || row.payee || "Supplier",
    source_module: row.source_module || row.source_type || "-",
    source_id: row.source_id || row.ref_id || "",
    original_amount: originalAmount,
    paid_amount: paidAmount,
    remaining_amount: remainingAmount,
    payment_status:
      row.payment_status || row.status || (remainingAmount <= 0 ? "Lunas" : paidAmount > 0 ? "Partial" : "Belum Bayar"),
    payment_count: numberValue(row.payment_count || 0),
    notes: row.notes || "",
  };
}

function normalizePayment(row) {
  return {
    ...row,
    payable_payment_id: row.payable_payment_id || row.payment_id || row.id || "",
    payable_payment_no: row.payable_payment_no || row.payable_payment_id || row.payment_id || row.id || "",
    payable_id: row.payable_id || "",
    wallet_id: row.wallet_id || "",
    wallet_name: row.wallet_name || "Dompet",
    payment_date: row.payment_date || row.date || row.created_at || "",
    amount: numberValue(row.amount || row.nominal || 0),
    payment_method: row.payment_method || row.method || "Transfer",
    notes: row.notes || "",
    status: row.status || "Active",
    wallet_mutation_id: row.wallet_mutation_id || row.mutation_id || "",
  };
}

function normalizeWallet(row) {
  return {
    ...row,
    wallet_id: row.wallet_id || row.id || row.code || "",
    wallet_name: row.wallet_name || row.name || row.account_name || row.nama_dompet || "Dompet",
    wallet_code: row.wallet_code || row.code || row.bank_name || row.type || "",
    location_id: row.location_id || "",
    balance: numberValue(row.balance || row.current_balance || row.saldo || row.calculated_balance || 0),
  };
}

function normalizeMutation(row) {
  return {
    ...row,
    mutation_id: row.mutation_id || row.wallet_mutation_id || row.id || "",
    wallet_id: row.wallet_id || "",
    wallet_name: row.wallet_name || "Dompet",
    mutation_date: row.mutation_date || row.date || row.created_at || "",
    direction: row.direction || row.mutation_type || "OUT",
    amount: numberValue(row.amount || row.nominal || 0),
    source_module: row.source_module || row.source_type || "",
    source_id: row.source_id || row.ref_id || "",
    notes: row.notes || row.description || "",
    status: row.status || "Active",
  };
}

function buildSummary(payables, payments) {
  const openPayables = payables.filter((row) => numberValue(row.remaining_amount) > 0);
  const totalOriginal = payables.reduce((total, row) => total + numberValue(row.original_amount), 0);
  const totalPaid = payables.reduce((total, row) => total + numberValue(row.paid_amount), 0);
  const totalRemaining = payables.reduce((total, row) => total + numberValue(row.remaining_amount), 0);
  const totalPayments = payments.reduce((total, row) => total + numberValue(row.amount), 0);

  return {
    total_original: totalOriginal,
    total_paid: totalPaid || totalPayments,
    total_remaining: totalRemaining,
    open_count: openPayables.length,
    payable_count: payables.length,
    payment_count: payments.length,
  };
}

function statusTone(status, remainingAmount) {
  const normalized = String(status || "").toLowerCase();
  if (remainingAmount <= 0 || normalized.includes("lunas")) return "success";
  if (normalized.includes("partial")) return "warning";
  return "danger";
}

export default function HutangNanaPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState(null);
  const [activeFilter, setActiveFilter] = useState("open");
  const [form, setForm] = useState({
    payable_id: "",
    wallet_id: "",
    payment_date: todayInputValue(),
    amount: "",
    payment_method: "Transfer",
    notes: "",
  });

  const payables = useMemo(() => asArray(bootstrap?.payables).map(normalizePayable).filter(isRealPayable), [bootstrap]);
  const payments = useMemo(() => asArray(bootstrap?.payments || bootstrap?.payable_payments).map(normalizePayment).filter(isRealPayment), [bootstrap]);
  const wallets = useMemo(() => asArray(bootstrap?.wallets).map(normalizeWallet).filter((wallet) => Boolean(wallet.wallet_id)), [bootstrap]);
  const walletMutations = useMemo(() => asArray(bootstrap?.wallet_mutations).map(normalizeMutation).filter(isRealWalletMutation), [bootstrap]);
  const summary = useMemo(() => {
    const fromBackend = bootstrap?.summary || {};
    const computed = buildSummary(payables, payments);
    return {
      ...computed,
      ...fromBackend,
      total_original: numberValue(fromBackend.total_original ?? computed.total_original),
      total_paid: numberValue(fromBackend.total_paid ?? computed.total_paid),
      total_remaining: numberValue(fromBackend.total_remaining ?? computed.total_remaining),
      open_count: numberValue(fromBackend.open_count ?? computed.open_count),
      payment_count: numberValue(fromBackend.payment_count ?? computed.payment_count),
      payable_count: numberValue(fromBackend.payable_count ?? computed.payable_count),
      hidden_rows: numberValue(fromBackend.hidden_rows || fromBackend.hiddenRows || 0),
      needs_mutation_count: payments.filter((payment) => !hasPaymentMutation(payment)).length,
    };
  }, [bootstrap, payables, payments]);

  const openPayables = useMemo(() => payables.filter((row) => numberValue(row.remaining_amount) > 0), [payables]);
  const visiblePayables = useMemo(() => {
    if (activeFilter === "paid") return payables.filter((row) => numberValue(row.remaining_amount) <= 0);
    if (activeFilter === "partial") return payables.filter((row) => numberValue(row.paid_amount) > 0 && numberValue(row.remaining_amount) > 0);
    if (activeFilter === "needs_mutation") {
      return payables.filter((row) => payments.some((payment) => payment.payable_id === row.payable_id && !hasPaymentMutation(payment)));
    }
    return openPayables;
  }, [activeFilter, payables, payments, openPayables]);

  const chosenPayable = useMemo(() => {
    return payables.find((row) => row.payable_id === form.payable_id) || null;
  }, [payables, form.payable_id]);

  const chosenWallet = useMemo(() => {
    return wallets.find((row) => row.wallet_id === form.wallet_id) || null;
  }, [wallets, form.wallet_id]);

  const paymentMethods = useMemo(() => chosenWallet ? allowedPaymentMethods(chosenWallet) : ["Transfer", "Cash"], [chosenWallet]);

  const chosenPayablePayments = useMemo(() => {
    if (!selectedPayable?.payable_id) return [];
    return payments.filter((row) => row.payable_id === selectedPayable.payable_id);
  }, [payments, selectedPayable]);

  const chosenPayableMutations = useMemo(() => {
    if (!selectedPayable?.payable_id) return [];
    const paymentIds = new Set(chosenPayablePayments.map((row) => row.payable_payment_id));
    return walletMutations.filter((mutation) => paymentIds.has(mutation.source_id));
  }, [chosenPayablePayments, walletMutations]);

  const amount = numberValue(form.amount);
  const canSubmit = Boolean(form.payable_id) && Boolean(form.wallet_id) && amount > 0 && !saving;
  const amountTooBig = chosenPayable && amount > numberValue(chosenPayable.remaining_amount);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getHutangNanaBootstrap(session?.sessionToken, {
      source: "frontend_part_4e_hutang_nana",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal membaca data Hutang Nana.");
      setBootstrap(null);
      setLoading(false);
      return;
    }

    const data = result.data || {};
    setBootstrap(data);
    setNeedsRefresh(false);
    setLoading(false);

    const nextPayables = asArray(data.payables).map(normalizePayable).filter((row) => numberValue(row.remaining_amount) > 0);
    const nextWallets = asArray(data.wallets).map(normalizeWallet);

    setForm((current) => ({
      ...current,
      payable_id: current.payable_id || nextPayables[0]?.payable_id || "",
      wallet_id: current.wallet_id || nextWallets[0]?.wallet_id || "",
      payment_method: current.wallet_id ? current.payment_method : suggestedPaymentMethod(nextWallets[0] || {}),
    }));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionToken]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!chosenPayable) {
      setError("Pilih hutang yang mau dibayar dulu.");
      return;
    }

    if (!chosenWallet) {
      setError("Pilih dompet pembayaran dulu.");
      return;
    }

    if (amount <= 0) {
      setError("Nominal pembayaran harus lebih dari 0.");
      return;
    }

    if (amount > numberValue(chosenPayable.remaining_amount)) {
      setError(`Nominal melebihi sisa hutang: ${formatRupiah(chosenPayable.remaining_amount)}.`);
      return;
    }

    setSaving(true);
    const result = await recordHutangNanaPayment(session?.sessionToken, {
      payable_id: chosenPayable.payable_id,
      wallet_id: chosenWallet.wallet_id,
      wallet_name: chosenWallet.wallet_name,
      payment_date: form.payment_date,
      amount,
      payment_method: form.payment_method,
      notes: form.notes || `Bayar Hutang Nana ${chosenPayable.payable_no}`,
      vendor_name: chosenPayable.vendor_name,
      operation_id: createOperationId(),
    });
    setSaving(false);

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal mencatat pembayaran Hutang Nana.");
      return;
    }

    setSuccess(result.message || "Pembayaran Hutang Nana berhasil dicatat.");
    setForm((current) => ({
      ...current,
      amount: "",
      notes: "",
    }));
    setNeedsRefresh(true);
  };

  return (
    <div>
      <PageHeader
        title="Hutang Nana"
        description="Pantau sisa hutang ayam, nota berjalan, dan pembayaran supplier. Pembayaran di sini langsung membuat mutasi dompet keluar."
        badge="Live Payment"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Supplier Ayam</div>
          <div className="da-dashboard-banner-title">Nota Ayam → Hutang Nana → Bayar dari Dompet</div>
          <div className="da-dashboard-banner-desc">
            DROP ayam yang belum dibayar masuk ke hutang. Saat dibayar, dompet berkurang dan ID pembayaran bisa ditelusuri.
          </div>
        </div>
        <div className="da-dashboard-banner-actions">
          <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Cek" : "Terhubung"}</Badge>
          <Button variant="ghost" onClick={loadData} disabled={loading || saving}>
            Refresh Data
          </Button>
        </div>
      </div>

      {error ? <div className="da-form-warning">{error}</div> : null}
      {success ? (
        <div className="da-form-success">
          {success}
          {needsRefresh ? (
            <div style={{ marginTop: 6, fontWeight: 700 }}>
              Data sudah tersimpan cepat. Klik Refresh Data kalau mau tarik ulang hutang, payment, dan mutasi dompet terbaru.
            </div>
          ) : null}
        </div>
      ) : null}
      {summary.hidden_rows > 0 ? (
        <div className="da-form-warning">
          {summary.hidden_rows} baris kosong/formatting disembunyikan supaya Hutang Nana tidak menampilkan angka yatim.
        </div>
      ) : null}

      <div className="da-grid da-grid-3" style={{ marginBottom: 16 }}>
        <StatCard
          label="Sisa Hutang Nana"
          value={loading ? "..." : formatRupiah(summary.total_remaining)}
          description="Total hutang ayam yang belum dibayar."
          tone="danger"
        />
        <StatCard
          label="Sudah Dibayar"
          value={loading ? "..." : formatRupiah(summary.total_paid)}
          description="Total pembayaran yang tercatat."
          tone="primary"
        />
        <StatCard
          label="Pembayaran Perlu Mutasi"
          value={loading ? "..." : summary.needs_mutation_count}
          description="Bayar hutang nyata yang belum punya mutasi dompet."
          tone={summary.needs_mutation_count > 0 ? "warning" : "success"}
        />
      </div>

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-page-kicker">Bayar Supplier</div>
            <h2 style={{ margin: "4px 0 6px" }}>Catat Pembayaran Hutang Nana</h2>
            <p className="da-muted" style={{ margin: 0 }}>
              Pilih nota terbuka, pilih Cash/BCA/BRI, lalu simpan pembayaran. Sistem akan membuat pembayaran hutang dan mutasi uang keluar.
            </p>
          </div>
          <Badge tone="warning">Potong Dompet</Badge>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="da-form-grid">
            <label className="da-field">
              Nota / Hutang
              <select
                value={form.payable_id}
                onChange={(event) => setForm((current) => ({ ...current, payable_id: event.target.value }))}
                disabled={saving}
              >
                <option value="">Pilih hutang</option>
                {openPayables.map((payable) => (
                  <option key={payable.payable_id} value={payable.payable_id}>
                    {payable.payable_no} · {formatRupiah(payable.remaining_amount)} · {safeText(payable.vendor_name)}
                  </option>
                ))}
              </select>
            </label>

            <label className="da-field">
              Dompet Pembayaran
              <select
                value={form.wallet_id}
                onChange={(event) => {
                  const wallet = wallets.find((row) => row.wallet_id === event.target.value);
                  setForm((current) => ({ ...current, wallet_id: event.target.value, payment_method: suggestedPaymentMethod(wallet || {}) }));
                }}
                disabled={saving}
              >
                <option value="">Pilih dompet</option>
                {wallets.map((wallet) => (
                  <option key={wallet.wallet_id} value={wallet.wallet_id}>
                    {wallet.wallet_name} · {formatRupiah(wallet.balance)}
                  </option>
                ))}
              </select>
            </label>

            <label className="da-field">
              Tanggal Bayar
              <input
                type="date"
                value={form.payment_date}
                onChange={(event) => setForm((current) => ({ ...current, payment_date: event.target.value }))}
                disabled={saving}
              />
            </label>

            <label className="da-field">
              Nominal Bayar
              <input
                type="number"
                min="0"
                value={form.amount}
                placeholder={chosenPayable ? String(chosenPayable.remaining_amount) : "0"}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                disabled={saving}
              />
            </label>

            <label className="da-field">
              Metode
              <select
                value={form.payment_method}
                onChange={(event) => setForm((current) => ({ ...current, payment_method: event.target.value }))}
                disabled={saving}
              >
                {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
              </select>
            </label>

            <label className="da-field">
              Catatan
              <input
                value={form.notes}
                placeholder="Contoh: bayar nota ayam hari ini"
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                disabled={saving}
              />
            </label>
          </div>

          <div className={amountTooBig ? "da-form-warning" : "da-drop-preview-panel"}>
            <div>
              <div className="da-stat-label">Sisa Hutang Dipilih</div>
              <strong>{chosenPayable ? formatRupiah(chosenPayable.remaining_amount) : "-"}</strong>
            </div>
            <div>
              <div className="da-stat-label">Bayar Sekarang</div>
              <strong>{formatRupiah(amount)}</strong>
            </div>
            <div>
              <div className="da-stat-label">Sisa Setelah Bayar</div>
              <strong>{chosenPayable ? formatRupiah(Math.max(numberValue(chosenPayable.remaining_amount) - amount, 0)) : "-"}</strong>
            </div>
          </div>

          <div className="da-form-actions">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setForm((current) => ({ ...current, amount: chosenPayable?.remaining_amount || "" }))}
              disabled={!chosenPayable || saving}
            >
              Isi Sisa Hutang
            </Button>
            <Button type="submit" disabled={!canSubmit || amountTooBig}>
              {saving ? "Menyimpan..." : "Simpan Pembayaran"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-page-kicker">Buku Hutang</div>
            <h2 style={{ margin: "4px 0 6px" }}>Nota Hutang Nana</h2>
            <p className="da-muted" style={{ margin: 0 }}>
              Klik baris untuk melihat pembayaran, source DROP ayam, dan mutasi dompet terkait.
            </p>
          </div>
          <div className="da-filter-row" style={{ marginBottom: 0 }}>
            {[
              ["open", "Belum Lunas"],
              ["partial", "Partial"],
              ["paid", "Lunas"],
              ["needs_mutation", "Perlu Mutasi"],
            ].map(([key, label]) => (
              <Button
                key={key}
                variant={activeFilter === key ? "primary" : "ghost"}
                onClick={() => setActiveFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <DataTable
          rows={visiblePayables}
          getRowKey={(row) => row.payable_id}
          onRowClick={(row) => setSelectedPayable(row)}
          columns={[
            {
              key: "payable_date",
              label: "Tanggal",
              render: (row) => formatDisplayDate(row.payable_date),
            },
            {
              key: "payable_no",
              label: "Hutang ID",
              render: (row) => <strong>{row.payable_no}</strong>,
            },
            {
              key: "vendor_name",
              label: "Supplier",
              render: (row) => safeText(row.vendor_name),
            },
            {
              key: "original_amount",
              label: "Nota",
              render: (row) => formatRupiah(row.original_amount),
            },
            {
              key: "paid_amount",
              label: "Dibayar",
              render: (row) => formatRupiah(row.paid_amount),
            },
            {
              key: "remaining_amount",
              label: "Sisa",
              render: (row) => <strong>{formatRupiah(row.remaining_amount)}</strong>,
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <Badge tone={statusTone(row.payment_status, row.remaining_amount)}>{row.payment_status}</Badge>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={Boolean(selectedPayable)}
        title="Detail Hutang Nana"
        subtitle={selectedPayable?.payable_no}
        onClose={() => setSelectedPayable(null)}
      >
        {selectedPayable ? (
          <div className="da-grid">
            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-stat-label">Nota Hutang</div>
                <h2 style={{ margin: "8px 0" }}>{formatRupiah(selectedPayable.original_amount)}</h2>
                <p>Supplier: <strong>{selectedPayable.vendor_name}</strong></p>
                <p>Tanggal: <strong>{formatDisplayDate(selectedPayable.payable_date)}</strong></p>
                <p>Tipe: <strong>{selectedPayable.payable_type}</strong></p>
              </div>
              <div className="da-detail-box">
                <div className="da-stat-label">Status Bayar</div>
                <h2 style={{ margin: "8px 0" }}>{formatRupiah(selectedPayable.remaining_amount)}</h2>
                <p>Dibayar: <strong>{formatRupiah(selectedPayable.paid_amount)}</strong></p>
                <p>Status: <Badge tone={statusTone(selectedPayable.payment_status, selectedPayable.remaining_amount)}>{selectedPayable.payment_status}</Badge></p>
                <p>Source: <strong>{safeText(selectedPayable.source_module)} · {safeText(selectedPayable.source_id)}</strong></p>
              </div>
            </div>

            <div className="da-form-warning" style={{ marginTop: 0 }}>
              Rantai ini harus bisa ditelusuri: DROP Ayam / Nota → Hutang Nana → Pembayaran → Mutasi Dompet → 4 Amplop nanti.
            </div>

            <div>
              <div className="da-section-heading">
                <div>
                  <div className="da-page-kicker">Riwayat Bayar</div>
                  <h3 style={{ margin: "4px 0" }}>Pembayaran Hutang Ini</h3>
                </div>
              </div>
              <DataTable
                rows={chosenPayablePayments}
                getRowKey={(row) => row.payable_payment_id}
                columns={[
                  { key: "payment_date", label: "Tanggal", render: (row) => formatDisplayDate(row.payment_date) },
                  { key: "payable_payment_no", label: "Payment ID", render: (row) => <strong>{row.payable_payment_no}</strong> },
                  { key: "wallet_name", label: "Dompet", render: (row) => safeText(row.wallet_name || row.wallet_id) },
                  { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
                  { key: "payment_method", label: "Metode", render: (row) => row.payment_method },
                  { key: "status", label: "Status", render: (row) => <Badge tone={hasPaymentMutation(row) ? "success" : "warning"}>{hasPaymentMutation(row) ? row.status : "Perlu Mutasi"}</Badge> },
                ]}
              />
            </div>

            <div>
              <div className="da-section-heading">
                <div>
                  <div className="da-page-kicker">Mutasi Dompet</div>
                  <h3 style={{ margin: "4px 0" }}>Uang Keluar Terkait</h3>
                </div>
              </div>
              <DataTable
                rows={chosenPayableMutations}
                getRowKey={(row) => row.mutation_id}
                columns={[
                  { key: "mutation_date", label: "Tanggal", render: (row) => formatDisplayDate(row.mutation_date) },
                  { key: "mutation_id", label: "Mutasi ID", render: (row) => <strong>{row.mutation_id}</strong> },
                  { key: "wallet_name", label: "Dompet", render: (row) => safeText(row.wallet_name || row.wallet_id) },
                  { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
                  { key: "source_id", label: "Sumber", render: (row) => safeText(row.source_id) },
                  { key: "status", label: "Status", render: (row) => <Badge tone="warning">{row.status}</Badge> },
                ]}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
