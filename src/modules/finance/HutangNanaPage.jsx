import { useEffect, useMemo, useState } from "react";
import {
  getHutangNanaBootstrap,
  recordHutangNanaPayment,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { allowedPaymentMethods, suggestedPaymentMethod } from "../../lib/finance/walletPolicy.js";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import FinanceSnapshot from "./FinanceSnapshot";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";

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

function normalizeBucket(value) {
  const bucket = String(value || "CURRENT_NOTE").trim().toUpperCase();
  return bucket === "OLD_DEBT" ? "OLD_DEBT" : "CURRENT_NOTE";
}

function isOldDebtPayable(row) {
  return normalizeBucket(row?.payable_bucket || row?.allocation_type) === "OLD_DEBT";
}

function sameSupplierAndLocation(left, right) {
  if (!left || !right) return false;

  const leftLocation = String(left.location_id || "").trim();
  const rightLocation = String(right.location_id || "").trim();
  if (leftLocation && rightLocation && leftLocation !== rightLocation) return false;

  const leftSupplier = String(left.supplier_id || "").trim();
  const rightSupplier = String(right.supplier_id || "").trim();
  if (leftSupplier && rightSupplier) return leftSupplier === rightSupplier;

  return String(left.vendor_name || "").trim().toLowerCase()
    === String(right.vendor_name || "").trim().toLowerCase();
}

function payableDateValue(row) {
  const value = new Date(row?.payable_date || row?.created_at || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function buildPaymentPlan(chosenPayable, totalAmount, oldDebtRows) {
  const requestedTotal = Math.max(numberValue(totalAmount), 0);
  const oldDebtRemainingBefore = asArray(oldDebtRows).reduce(
    (sum, row) => sum + numberValue(row.remaining_amount),
    0
  );

  if (!chosenPayable || requestedTotal <= 0) {
    return {
      allocations: [],
      requestedTotal,
      allocatedTotal: 0,
      unallocatedAmount: requestedTotal,
      selectedAmount: 0,
      oldDebtAmount: 0,
      selectedRemainingAfter: numberValue(chosenPayable?.remaining_amount),
      oldDebtRemainingBefore,
      oldDebtRemainingAfter: oldDebtRemainingBefore,
    };
  }

  let amountLeft = requestedTotal;
  const allocations = [];
  const selectedRemaining = numberValue(chosenPayable.remaining_amount);
  const selectedAmount = Math.min(selectedRemaining, amountLeft);

  if (selectedAmount > 0) {
    allocations.push({
      payable_id: chosenPayable.payable_id,
      allocation_type: normalizeBucket(chosenPayable.payable_bucket),
      amount: selectedAmount,
    });
    amountLeft = Math.max(amountLeft - selectedAmount, 0);
  }

  let oldDebtAmount = isOldDebtPayable(chosenPayable) ? selectedAmount : 0;
  const eligibleOldDebts = isOldDebtPayable(chosenPayable)
    ? []
    : asArray(oldDebtRows)
      .filter((row) => row.payable_id !== chosenPayable.payable_id)
      .sort((left, right) => payableDateValue(left) - payableDateValue(right));

  for (const debt of eligibleOldDebts) {
    if (amountLeft <= 0) break;

    const allocationAmount = Math.min(numberValue(debt.remaining_amount), amountLeft);
    if (allocationAmount <= 0) continue;

    allocations.push({
      payable_id: debt.payable_id,
      allocation_type: "OLD_DEBT",
      amount: allocationAmount,
    });
    oldDebtAmount += allocationAmount;
    amountLeft = Math.max(amountLeft - allocationAmount, 0);
  }

  return {
    allocations,
    requestedTotal,
    allocatedTotal: requestedTotal - amountLeft,
    unallocatedAmount: amountLeft,
    selectedAmount,
    oldDebtAmount,
    selectedRemainingAfter: Math.max(selectedRemaining - selectedAmount, 0),
    oldDebtRemainingBefore,
    oldDebtRemainingAfter: Math.max(
      oldDebtRemainingBefore - (isOldDebtPayable(chosenPayable) ? 0 : oldDebtAmount),
      0
    ),
  };
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
    payable_bucket: normalizeBucket(row.payable_bucket || row.bucket || row.allocation_type),
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

function normalizeBootstrapData(data) {
  const source = data || {};
  const canonicalPayables = [
    ...asArray(source.current_notes),
    ...asArray(source.old_debts),
  ];

  const payables = asArray(source.payables).length
    ? asArray(source.payables)
    : canonicalPayables;

  const payments = asArray(source.payments).length
    ? asArray(source.payments)
    : asArray(source.payable_payments);

  return {
    ...source,
    payables,
    payments,
    payable_payments: payments,
    wallet_mutations: asArray(source.wallet_mutations),
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
  const [paymentOpen, setPaymentOpen] = useState(false);
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
  const currentNotePayables = useMemo(() => openPayables.filter((row) => !isOldDebtPayable(row)), [openPayables]);
  const oldDebtPayables = useMemo(() => openPayables.filter(isOldDebtPayable), [openPayables]);
  const currentNoteRemaining = useMemo(() => currentNotePayables.reduce((sum, row) => sum + numberValue(row.remaining_amount), 0), [currentNotePayables]);
  const oldDebtRemaining = useMemo(() => oldDebtPayables.reduce((sum, row) => sum + numberValue(row.remaining_amount), 0), [oldDebtPayables]);
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

  const matchedOldDebts = useMemo(
    () => chosenPayable
      ? oldDebtPayables.filter((row) => sameSupplierAndLocation(row, chosenPayable))
      : [],
    [chosenPayable, oldDebtPayables]
  );

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

    const paymentIds = new Set(
      chosenPayablePayments.map((row) => String(row.payable_payment_id || "").trim()).filter(Boolean)
    );
    const mutationIds = new Set(
      chosenPayablePayments.map((row) => String(row.wallet_mutation_id || "").trim()).filter(Boolean)
    );

    return walletMutations.filter((mutation) => {
      const mutationId = String(mutation.mutation_id || "").trim();
      const sourceId = String(mutation.source_id || "").trim();
      return mutationIds.has(mutationId) || paymentIds.has(sourceId);
    });
  }, [chosenPayablePayments, walletMutations]);

  const amount = numberValue(form.amount);
  const paymentPlan = useMemo(
    () => buildPaymentPlan(chosenPayable, amount, matchedOldDebts),
    [chosenPayable, amount, matchedOldDebts]
  );
  const amountTooBig = paymentPlan.unallocatedAmount > 0;
  const canSubmit = Boolean(form.payable_id)
    && Boolean(form.wallet_id)
    && amount > 0
    && paymentPlan.allocations.length > 0
    && !amountTooBig
    && !saving;

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getHutangNanaBootstrap(session?.sessionToken, {
      source: "finance_workspace_v12_supplier_debt",
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

    const data = normalizeBootstrapData(result.data || {});
    setBootstrap(data);
    setNeedsRefresh(false);
    setLoading(false);

    const nextPayables = asArray(data.payables).map(normalizePayable).filter((row) => numberValue(row.remaining_amount) > 0);
    const nextWallets = asArray(data.wallets).map(normalizeWallet);

    setForm((current) => ({
      ...current,
      payable_id: current.payable_id
        || nextPayables.find((row) => !isOldDebtPayable(row))?.payable_id
        || nextPayables[0]?.payable_id
        || "",
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

    if (paymentPlan.unallocatedAmount > 0) {
      setError(
        `Nominal melebihi total hutang yang dapat dialokasikan. Kelebihan ${formatRupiah(paymentPlan.unallocatedAmount)} tidak dapat diposting.`
      );
      return;
    }

    setSaving(true);
    const operationId = createOperationId();
    const result = await recordHutangNanaPayment(session?.sessionToken, {
      operation_id: operationId,
      request_id: operationId,
      idempotency_key: operationId,
      location_id: chosenPayable.location_id || session?.user?.location_id || "",
      supplier_id: chosenPayable.supplier_id || "",
      wallet_id: chosenWallet.wallet_id,
      payment_date: form.payment_date,
      payment_method: form.payment_method,
      notes: form.notes || (
        paymentPlan.oldDebtAmount > 0 && !isOldDebtPayable(chosenPayable)
          ? `Bayar nota ${chosenPayable.payable_no} + selipan hutang lama`
          : `Bayar Hutang Nana ${chosenPayable.payable_no}`
      ),
      allocations: paymentPlan.allocations,
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
    setForm((current) => ({ ...current, amount: "", notes: "" }));
    setPaymentOpen(false);
    await loadData();
  };

  return (
    <div className="da-finance-page">
      <PageHeader
        eyebrow="Uang & Kewajiban"
        title="Hutang Nana"
        description="Pantau nota ayam berjalan, saldo hutang lama, dan pembayaran supplier dari dompet usaha."
        actions={(
          <div className="da-actions">
            <Button variant="ghost" onClick={loadData} disabled={loading || saving}>{loading ? "Memuat..." : "Perbarui"}</Button>
            <Button onClick={() => setPaymentOpen(true)} disabled={!openPayables.length}>+ Bayar Supplier</Button>
          </div>
        )}
      />

      {error ? <div className="da-alert da-alert-danger">{error}</div> : null}
      {success ? <div className="da-form-success">{success}</div> : null}

      <FinanceSnapshot
        eyebrow="Hutang Supplier Ayam"
        value={loading ? "..." : formatRupiah(summary.total_remaining)}
        caption={`${summary.open_count || 0} catatan masih perlu diselesaikan.`}
        metrics={[
          { label: "Nota Berjalan", value: loading ? "..." : formatRupiah(currentNoteRemaining), helper: `${currentNotePayables.length} nota pembelian`, tone: "warning" },
          { label: "Saldo Lama", value: loading ? "..." : formatRupiah(oldDebtRemaining), helper: "Saldo awal kewajiban yang masih berjalan" },
          { label: "Sudah Dibayar", value: loading ? "..." : formatRupiah(summary.total_paid), helper: `${summary.payment_count || 0} pembayaran`, tone: "success" },
        ]}
      />

      <div className="da-finance-workspace">
        <Card className="da-finance-main-card">
          <div className="da-section-heading">
            <div><div className="da-page-kicker">Buku Hutang Supplier</div><h2 style={{ margin: "4px 0 6px" }}>Nota dan Saldo Hutang</h2><p className="da-muted" style={{ margin: 0 }}>Klik baris untuk melihat riwayat pembayaran dan jejak mutasi dompet.</p></div>
            <Button variant="ghost" onClick={() => setPaymentOpen(true)} disabled={!openPayables.length}>+ Pembayaran</Button>
          </div>
          <div className="da-finance-tabs">
            {[ ["open", "Belum Lunas"], ["partial", "Sebagian Dibayar"], ["paid", "Lunas"], ["needs_mutation", "Perlu Ditelusuri"] ].map(([key, label]) => <button key={key} className={activeFilter === key ? "active" : ""} onClick={() => setActiveFilter(key)}>{label}</button>)}
          </div>
          <DataTable
            rows={visiblePayables}
            getRowKey={(row) => row.payable_id}
            onRowClick={setSelectedPayable}
            columns={[
              { key: "payable_date", label: "Tanggal", render: (row) => formatDisplayDate(row.payable_date) },
              { key: "payable_no", label: "Hutang ID", render: (row) => <strong>{row.payable_no}</strong> },
              { key: "vendor_name", label: "Supplier", render: (row) => safeText(row.vendor_name) },
              { key: "bucket", label: "Jenis", render: (row) => isOldDebtPayable(row) ? <Badge tone="warning">Saldo Lama</Badge> : <Badge tone="neutral">Nota Berjalan</Badge> },
              { key: "original_amount", label: "Nilai", render: (row) => formatRupiah(row.original_amount) },
              { key: "paid_amount", label: "Dibayar", render: (row) => formatRupiah(row.paid_amount) },
              { key: "remaining_amount", label: "Sisa", render: (row) => <strong>{formatRupiah(row.remaining_amount)}</strong> },
              { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.payment_status, row.remaining_amount)}>{row.payment_status}</Badge> },
            ]}
          />
          {!loading && visiblePayables.length === 0 ? <div className="da-finance-empty">Belum ada hutang pada pilihan ini.</div> : null}
        </Card>

        <Card className="da-finance-side-card">
          <div className="da-page-kicker">Posisi Supplier</div>
          <h2 style={{ margin: "6px 0 6px" }}>Kontrol Hutang Ayam</h2>
          <p className="da-muted">Pisahkan nota berjalan dari saldo lama agar pembayaran dan jejak supplier mudah dibaca.</p>
          <div className="da-finance-hero-number da-finance-hero-number-dark"><span>Total outstanding</span><strong>{formatRupiah(summary.total_remaining)}</strong><small>{summary.open_count || 0} catatan terbuka</small></div>
          <div className="da-finance-metric-list">
            <div><span>Nota berjalan</span><strong>{formatRupiah(currentNoteRemaining)}</strong></div>
            <div><span>Hutang lama</span><strong>{formatRupiah(oldDebtRemaining)}</strong></div>
            <div><span>Total dibayar</span><strong>{formatRupiah(summary.total_paid)}</strong></div>
            <div><span>Perlu ditelusuri</span><strong>{summary.needs_mutation_count || 0}</strong></div>
          </div>
          <Button onClick={() => setPaymentOpen(true)} disabled={!openPayables.length}>Bayar Supplier</Button>
        </Card>
      </div>

      <Modal open={paymentOpen} size="lg" title="Bayar Hutang Supplier" subtitle="Pilih nota, dompet, dan nominal pembayaran" onClose={() => !saving && setPaymentOpen(false)}>
        <form onSubmit={handleSubmit} className="da-finance-modal-panel">
          <div className="da-finance-modal-form">
            <label className="da-field da-finance-span-2"><span>Nota / Hutang</span><select value={form.payable_id} onChange={(event) => setForm((current) => ({ ...current, payable_id: event.target.value, amount: "" }))} disabled={saving}><option value="">Pilih hutang</option>{currentNotePayables.length ? <optgroup label="Nota Berjalan">{currentNotePayables.map((row) => <option key={row.payable_id} value={row.payable_id}>{row.payable_no} · {formatRupiah(row.remaining_amount)} · {row.vendor_name}</option>)}</optgroup> : null}{oldDebtPayables.length ? <optgroup label="Hutang Lama / Saldo Awal">{oldDebtPayables.map((row) => <option key={row.payable_id} value={row.payable_id}>{row.payable_no} · {formatRupiah(row.remaining_amount)} · {row.vendor_name}</option>)}</optgroup> : null}</select></label>
            <label className="da-field"><span>Dompet Pembayaran</span><select value={form.wallet_id} onChange={(event) => { const wallet = wallets.find((row) => row.wallet_id === event.target.value); setForm((current) => ({ ...current, wallet_id: event.target.value, payment_method: suggestedPaymentMethod(wallet || {}) })); }} disabled={saving}><option value="">Pilih dompet</option>{wallets.map((wallet) => <option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name} · {formatRupiah(wallet.balance)}</option>)}</select></label>
            <label className="da-field"><span>Tanggal Bayar</span><input type="date" value={form.payment_date} onChange={(event) => setForm((current) => ({ ...current, payment_date: event.target.value }))} disabled={saving} /></label>
            <label className="da-field"><span>Nominal Bayar</span><input inputMode="numeric" value={form.amount} placeholder={chosenPayable ? String(chosenPayable.remaining_amount) : "0"} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} disabled={saving} /></label>
            <label className="da-field"><span>Metode</span><select value={form.payment_method} onChange={(event) => setForm((current) => ({ ...current, payment_method: event.target.value }))} disabled={saving}>{paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
            <label className="da-field da-finance-span-2"><span>Catatan</span><input value={form.notes} placeholder="Catatan pembayaran" onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} disabled={saving} /></label>
          </div>
          {!isOldDebtPayable(chosenPayable) && matchedOldDebts.length > 0 ? <div className="da-finance-note">Saldo Lama adalah kewajiban supplier yang sudah ada sebelum pencatatan periode berjalan. Jika pembayaran nota berjalan lebih besar dari sisa nota, selisih otomatis mengurangi saldo lama supplier yang sama.</div> : null}
          <div className={amountTooBig ? "da-alert da-alert-danger" : "da-finance-preview-row"}>
            <div><span>Sisa nota dipilih</span><strong>{chosenPayable ? formatRupiah(chosenPayable.remaining_amount) : "-"}</strong></div>
            <div><span>Untuk nota</span><strong>{formatRupiah(paymentPlan.selectedAmount)}</strong></div>
            <div><span>Ke hutang lama</span><strong>{formatRupiah(isOldDebtPayable(chosenPayable) ? 0 : paymentPlan.oldDebtAmount)}</strong></div>
          </div>
          {amountTooBig ? <div className="da-alert da-alert-danger">Nominal melebihi total hutang yang dapat dialokasikan sebesar {formatRupiah(paymentPlan.unallocatedAmount)}.</div> : null}
          <div className="da-form-actions"><Button variant="ghost" type="button" onClick={() => setForm((current) => ({ ...current, amount: chosenPayable?.remaining_amount || "" }))} disabled={!chosenPayable || saving}>Isi Sisa Nota</Button><Button type="submit" disabled={!canSubmit || amountTooBig}>{saving ? "Menyimpan..." : "Simpan Pembayaran"}</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(selectedPayable)} title="Detail Hutang Supplier" subtitle={selectedPayable?.payable_no} onClose={() => setSelectedPayable(null)}>
        {selectedPayable ? <div className="da-finance-modal-panel">
          <div className="da-modal-summary"><div><div className="da-mini-title">{isOldDebtPayable(selectedPayable) ? "Saldo Hutang Lama" : "Nota Berjalan"}</div><div className="da-big-text">{formatRupiah(selectedPayable.remaining_amount)}</div><p className="da-muted">{selectedPayable.vendor_name}</p></div><Badge tone={statusTone(selectedPayable.payment_status, selectedPayable.remaining_amount)}>{selectedPayable.payment_status}</Badge></div>
          <div className="da-detail-grid"><div className="da-detail-box"><p><strong>Nilai awal:</strong> {formatRupiah(selectedPayable.original_amount)}</p><p><strong>Sudah dibayar:</strong> {formatRupiah(selectedPayable.paid_amount)}</p><p><strong>Tanggal:</strong> {formatDisplayDate(selectedPayable.payable_date)}</p></div><div className="da-detail-box"><p><strong>Sumber:</strong> {safeText(selectedPayable.source_module)}</p><p><strong>ID referensi:</strong> {safeText(selectedPayable.source_id)}</p><p><strong>Supplier:</strong> {safeText(selectedPayable.vendor_name)}</p></div></div>
          <div className="da-finance-detail-section"><h3>Riwayat Pembayaran</h3><DataTable rows={chosenPayablePayments} getRowKey={(row) => row.payable_payment_id} columns={[{ key: "payment_date", label: "Tanggal", render: (row) => formatDisplayDate(row.payment_date) }, { key: "payable_payment_no", label: "Payment ID", render: (row) => <strong>{row.payable_payment_no}</strong> }, { key: "wallet_name", label: "Dompet", render: (row) => safeText(row.wallet_name || row.wallet_id) }, { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) }, { key: "status", label: "Status", render: (row) => <Badge tone={hasPaymentMutation(row) ? "success" : "warning"}>{hasPaymentMutation(row) ? row.status : "Perlu Ditelusuri"}</Badge> }]} /></div>
          <div className="da-finance-detail-section"><h3>Mutasi Dompet</h3><DataTable rows={chosenPayableMutations} getRowKey={(row) => row.mutation_id} columns={[{ key: "mutation_date", label: "Tanggal", render: (row) => formatDisplayDate(row.mutation_date) }, { key: "mutation_id", label: "Mutasi ID", render: (row) => <strong>{row.mutation_id}</strong> }, { key: "wallet_name", label: "Dompet", render: (row) => safeText(row.wallet_name || row.wallet_id) }, { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) }, { key: "source_id", label: "Sumber", render: (row) => safeText(row.source_id) }]} /></div>
        </div> : null}
      </Modal>
    </div>
  );
}
