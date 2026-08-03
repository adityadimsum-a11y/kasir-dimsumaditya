import { useEffect, useMemo, useState } from "react";
import { createKasKeluar, getKasKeluarBootstrap } from "../../lib/api/actions";
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
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  if (raw.includes("Rp") || raw.includes(".") || raw.includes(",")) {
    return Number(raw.replace(/[^0-9-]/g, "") || 0);
  }
  const parsed = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function todayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeOperationId() {
  const rand = Math.random().toString(16).slice(2, 10).toUpperCase();
  return `KASOUT-OP-${Date.now()}-${rand}`;
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
  return code.includes("AUTH_REQUIRED") || message.includes("AUTH_REQUIRED") || (message.includes("SESSION") && message.includes("TIDAK AKTIF"));
}

function isGhostId(value) {
  const text = String(value || "").trim().toUpperCase();
  return !text || text === "-" || text.includes("ROW-") || text === "0";
}

function normalizeWallet(row) {
  const walletId = row.wallet_id || row.id || row.code || row.wallet_code || "";
  return {
    ...row,
    wallet_id: walletId,
    wallet_name: row.wallet_name || row.name || row.account_name || row.nama_dompet || row.wallet_code || "Dompet",
    wallet_code: row.wallet_code || row.code || row.bank_name || row.type || "",
    location_id: row.location_id || "",
    balance: numberValue(row.balance || row.current_balance || row.saldo || row.calculated_balance || 0),
    uang_masuk: numberValue(row.uang_masuk || row.total_in || row.in_amount || 0),
    uang_keluar: numberValue(row.uang_keluar || row.total_out || row.out_amount || 0),
  };
}

function normalizeMasterExpense(row) {
  const itemName = row.item_name || row.expense_name || row.name || row.nama_item || "";
  return {
    ...row,
    expense_master_id: row.expense_master_id || row.master_expense_id || row.id || row.code || "",
    item_name: itemName,
    category: row.category || row.expense_category || "Belanja Harian",
    unit: row.unit || row.satuan || "pcs",
    unit_price: numberValue(row.unit_price || row.price || row.harga_satuan || 0),
    default_wallet_id: row.default_wallet_id || row.wallet_id || "",
    default_wallet_name: row.default_wallet_name || row.wallet_name || "",
    status: row.status || "Active",
  };
}

function normalizeWalletMutation(row) {
  return {
    ...row,
    mutation_id: row.mutation_id || row.wallet_mutation_id || row.id || "",
    mutation_date: row.mutation_date || row.date || row.created_at || "",
    wallet_id: row.wallet_id || "",
    wallet_name: row.wallet_name || row.dompet || "Dompet",
    direction: row.direction || row.mutation_type || row.arah || "",
    amount: numberValue(row.amount || row.nominal || 0),
    source_module: row.source_module || row.source_type || row.module || "",
    source_id: row.source_id || row.ref_id || row.reference_id || "",
    description: row.description || row.notes || "",
    status: row.status || "Active",
  };
}

function normalizeCashExpense(row) {
  const rawItems = asArray(row.items || row.detail_items || row.expense_items);
  const items = rawItems.map((item, index) => {
    const qty = numberValue(item.qty || item.quantity || 1);
    const unitPrice = numberValue(item.unit_price || item.price || item.harga_satuan || 0);
    return {
      ...item,
      expense_item_id: item.expense_item_id || item.item_id || `${row.expense_id || row.cash_expense_id || "EXP"}-${index}`,
      item_name: item.item_name || item.name || item.nama_item || "Item belanja",
      category: item.category || row.category || "Belanja Harian",
      qty,
      unit: item.unit || item.satuan || "pcs",
      unit_price: unitPrice,
      line_total: numberValue(item.line_total || item.total || qty * unitPrice),
      notes: item.notes || "",
    };
  });

  const expenseId = row.expense_id || row.cash_expense_id || row.kasout_id || row.id || "";
  const amount = numberValue(row.amount || row.total_amount || row.nominal || 0);
  const description = row.description || row.expense_name || row.items_summary || row.keterangan || "Belanja / Kas Keluar";

  return {
    ...row,
    expense_id: expenseId,
    expense_no: row.expense_no || row.cash_expense_no || expenseId,
    location_id: row.location_id || "",
    location_code: row.location_code || "",
    wallet_id: row.wallet_id || "",
    wallet_name: row.wallet_name || row.dompet || "Dompet",
    expense_date: row.expense_date || row.cash_expense_date || row.mutation_date || row.created_at || "",
    category: row.category || "Belanja Harian",
    description,
    vendor_name: row.vendor_name || row.payee || row.store_name || row.penerima || "",
    pic_name: row.pic_name || row.pic || "",
    amount,
    payment_method: row.payment_method || row.method || "Cash",
    money_given: numberValue(row.money_given || row.uang_diberikan || 0),
    change_amount: numberValue(row.change_amount || row.kembalian || 0),
    item_count: numberValue(row.item_count || items.length || 0),
    items_summary: row.items_summary || items.map((item) => `${item.item_name} ${item.qty} ${item.unit}`).join(", "),
    status: row.status || "Active",
    wallet_mutation_id: row.wallet_mutation_id || row.mutation_id || row.wallet_out_id || "",
    source_id: row.source_id || expenseId,
    operation_id: row.operation_id || row.request_id || "",
    items,
  };
}

function isRealCashExpense(row) {
  if (!row) return false;
  const expenseId = row.expense_id || row.cash_expense_id || row.kasout_id || row.id || "";
  const amount = numberValue(row.amount || row.total_amount || row.nominal || 0);
  const desc = String(row.description || row.expense_name || row.items_summary || row.keterangan || "").trim();
  const hasItems = asArray(row.items || row.detail_items || row.expense_items).length > 0;
  return !isGhostId(expenseId) || amount > 0 || hasItems || Boolean(desc && desc !== "Belanja / Kas Keluar");
}

function blankItem() {
  return {
    expense_master_id: "",
    item_name: "",
    category: "Belanja Harian",
    qty: 1,
    unit: "pcs",
    unit_price: 0,
    notes: "",
  };
}

function buildSummary(expenses, wallets, masters, walletMutations, hiddenRowsCount = 0) {
  const activeExpenses = expenses.filter((row) => String(row.status || "").toLowerCase() !== "void");
  const totalOut = activeExpenses.reduce((total, row) => total + numberValue(row.amount), 0);
  const itemCount = activeExpenses.reduce((total, row) => total + numberValue(row.item_count || row.items?.length || 0), 0);
  const mutationOutCount = walletMutations.filter((row) => String(row.direction || "").toUpperCase().includes("OUT") || String(row.direction || "").toUpperCase().includes("KELUAR")).length;
  const perluSourceCount = activeExpenses.filter((row) => isGhostId(row.wallet_mutation_id)).length;

  return {
    total_out: totalOut,
    expense_count: activeExpenses.length,
    item_count: itemCount,
    master_count: masters.length,
    wallet_count: wallets.length,
    mutation_out_count: mutationOutCount,
    perlu_source_count: perluSourceCount,
    hidden_rows_count: hiddenRowsCount,
  };
}

function preparePayload(form, items, selectedWallet, operationId) {
  const cleanItems = items
    .map((item) => {
      const qty = numberValue(item.qty);
      const unitPrice = numberValue(item.unit_price);
      return {
        expense_master_id: item.expense_master_id || "",
        item_name: safeText(item.item_name, ""),
        category: safeText(item.category, "Belanja Harian"),
        qty,
        quantity: qty,
        unit: safeText(item.unit, "pcs"),
        unit_price: unitPrice,
        price: unitPrice,
        line_total: qty * unitPrice,
        notes: item.notes || "",
      };
    })
    .filter((item) => item.item_name && item.qty > 0 && item.unit_price >= 0);

  const totalAmount = cleanItems.reduce((total, item) => total + item.line_total, 0);
  const moneyGiven = numberValue(form.money_given);

  return {
    operation_id: operationId,
    request_id: operationId,
    idempotency_key: operationId,
    expense_date: form.expense_date,
    wallet_id: form.wallet_id,
    wallet_name: selectedWallet?.wallet_name || form.wallet_name || "",
    payment_method: form.payment_method,
    category: cleanItems[0]?.category || form.category || "Belanja Harian",
    description: form.description || cleanItems.map((item) => item.item_name).join(", "),
    payee: form.vendor_name,
    vendor_name: form.vendor_name,
    store_name: form.vendor_name,
    pic_name: form.pic_name,
    amount: totalAmount,
    total_amount: totalAmount,
    money_given: moneyGiven,
    change_amount: moneyGiven > 0 ? Math.max(moneyGiven - totalAmount, 0) : 0,
    notes: form.notes,
    items: cleanItems,
  };
}

export default function BelanjaKasKeluarPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [operationId, setOperationId] = useState(() => makeOperationId());

  const [form, setForm] = useState({
    expense_date: todayInputValue(),
    wallet_id: "",
    wallet_name: "",
    payment_method: "Cash",
    category: "Belanja Harian",
    vendor_name: "",
    pic_name: "",
    money_given: "",
    description: "",
    notes: "",
  });
  const [items, setItems] = useState([blankItem()]);

  const wallets = useMemo(() => asArray(bootstrap?.wallets).map(normalizeWallet).filter((wallet) => wallet.wallet_id), [bootstrap]);
  const masterItems = useMemo(() => asArray(bootstrap?.master_expenses || bootstrap?.master_items).map(normalizeMasterExpense).filter((row) => row.item_name || row.expense_master_id), [bootstrap]);
  const rawExpenseRows = useMemo(() => asArray(bootstrap?.cash_expenses || bootstrap?.expenses), [bootstrap]);
  const expenses = useMemo(() => rawExpenseRows.filter(isRealCashExpense).map(normalizeCashExpense).filter((row) => !isGhostId(row.expense_id) || row.amount > 0), [rawExpenseRows]);
  const walletMutations = useMemo(() => asArray(bootstrap?.wallet_mutations).map(normalizeWalletMutation).filter((row) => !isGhostId(row.mutation_id) || row.amount > 0), [bootstrap]);
  const hiddenRowsCount = numberValue(bootstrap?.summary?.hidden_rows_count || bootstrap?.hidden_rows_count || Math.max(rawExpenseRows.length - expenses.length, 0));
  const summary = useMemo(() => buildSummary(expenses, wallets, masterItems, walletMutations, hiddenRowsCount), [expenses, wallets, masterItems, walletMutations, hiddenRowsCount]);

  const selectedWallet = useMemo(() => wallets.find((wallet) => wallet.wallet_id === form.wallet_id) || null, [wallets, form.wallet_id]);
  const paymentMethods = useMemo(() => selectedWallet ? allowedPaymentMethods(selectedWallet) : ["Cash", "Transfer"], [selectedWallet]);
  const payloadPreview = useMemo(() => preparePayload(form, items, selectedWallet, operationId), [form, items, selectedWallet, operationId]);
  const totalAmount = numberValue(payloadPreview.total_amount || payloadPreview.amount);
  const moneyGiven = numberValue(form.money_given);
  const changeAmount = moneyGiven > 0 ? Math.max(moneyGiven - totalAmount, 0) : 0;
  const canSubmit = Boolean(form.wallet_id) && payloadPreview.items.length > 0 && totalAmount > 0 && !saving;

  const filteredExpenses = useMemo(() => {
    if (activeTab === "perlu-sumber") return expenses.filter((row) => isGhostId(row.wallet_mutation_id));
    if (activeTab === "hari-ini") return expenses.filter((row) => String(row.expense_date || "").slice(0, 10) === todayInputValue());
    return expenses;
  }, [activeTab, expenses]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    const result = await getKasKeluarBootstrap(session?.sessionToken, {
      source: "frontend_part_4s_belanja_kas_keluar_trace",
      clean_rows: true,
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setError(result.message || "Gagal membaca data Belanja & Kas Keluar.");
      setBootstrap(null);
      setLoading(false);
      return;
    }

    const data = result.data || {};
    setBootstrap(data);
    setNeedsRefresh(false);
    setLoading(false);

    const firstWallet = asArray(data.wallets).map(normalizeWallet).find((wallet) => wallet.wallet_id);
    if (firstWallet && !form.wallet_id) {
      setForm((current) => ({ ...current, wallet_id: firstWallet.wallet_id, wallet_name: firstWallet.wallet_name, payment_method: suggestedPaymentMethod(firstWallet) }));
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionToken]);

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateItem = (index, key, value) => setItems((current) => current.map((item, rowIndex) => (rowIndex === index ? { ...item, [key]: value } : item)));

  const chooseMasterItem = (index, masterId) => {
    const master = masterItems.find((row) => row.expense_master_id === masterId);
    if (!master) {
      updateItem(index, "expense_master_id", "");
      return;
    }

    setItems((current) => current.map((item, rowIndex) => (rowIndex === index ? {
      ...item,
      expense_master_id: master.expense_master_id,
      item_name: master.item_name,
      category: master.category,
      unit: master.unit,
      unit_price: master.unit_price,
    } : item)));

    if (master.default_wallet_id && !form.wallet_id) {
      const wallet = wallets.find((row) => row.wallet_id === master.default_wallet_id);
      setForm((current) => ({ ...current, wallet_id: master.default_wallet_id, wallet_name: wallet?.wallet_name || "", payment_method: suggestedPaymentMethod(wallet || {}) }));
    }
  };

  const addItemRow = () => setItems((current) => [...current, blankItem()]);
  const removeItemRow = (index) => setItems((current) => (current.length <= 1 ? current : current.filter((_, rowIndex) => rowIndex !== index)));

  const resetForm = () => {
    setForm({
      expense_date: todayInputValue(),
      wallet_id: wallets[0]?.wallet_id || "",
      wallet_name: wallets[0]?.wallet_name || "",
      payment_method: suggestedPaymentMethod(wallets[0] || {}),
      category: "Belanja Harian",
      vendor_name: "",
      pic_name: "",
      money_given: "",
      description: "",
      notes: "",
    });
    setItems([blankItem()]);
    setOperationId(makeOperationId());
    setShowConfirm(false);
  };

  const submitExpense = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    const result = await createKasKeluar(session?.sessionToken, payloadPreview);

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setError(result.message || "Gagal membuat kas keluar.");
      setSaving(false);
      setShowConfirm(false);
      return;
    }

    const expenseId = result.data?.expense_id || result.data?.expense_no || result.data?.cash_expense_id || "";
    setSuccess(`Kas keluar berhasil dicatat${expenseId ? `: ${expenseId}` : ""}.`);
    setSaving(false);
    resetForm();
    setNeedsRefresh(true);
  };

  const expenseColumns = [
    { key: "expense_date", label: "Tanggal", render: (row) => formatDisplayDate(row.expense_date) },
    { key: "expense_id", label: "Kas Keluar ID", render: (row) => <strong>{safeText(row.expense_id)}</strong> },
    {
      key: "description",
      label: "Keterangan",
      render: (row) => (
        <div>
          <strong>{safeText(row.description)}</strong>
          <div className="da-muted">{safeText(row.items_summary, "Belum ada rincian item")}</div>
        </div>
      ),
    },
    { key: "wallet_name", label: "Dompet", render: (row) => safeText(row.wallet_name) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
    {
      key: "trace",
      label: "Sumber",
      render: (row) => (isGhostId(row.wallet_mutation_id) ? <Badge tone="warning">Perlu Mutasi</Badge> : <Badge tone="success">Tertelusur</Badge>),
    },
    { key: "status", label: "Status", render: (row) => <Badge tone={String(row.status).toLowerCase() === "active" ? "success" : "warning"}>{safeText(row.status)}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Belanja & Kas Keluar"
        description="Input belanja harian, biaya operasional, dan uang keluar dari dompet. Setiap kas keluar harus punya ID, item, dompet, mutasi, dan sumber arsip."
        badge="Live Trace"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Uang keluar usaha</div>
          <div className="da-dashboard-banner-title">Belanja → KASOUT → Mutasi Dompet → Arsip</div>
          <div className="da-dashboard-banner-desc">Belanja jangan dicatat ulang di Laporan Harian. Laporan Harian cukup menarik transaksi dari sini supaya tidak dobel input.</div>
        </div>
        <div className="da-dashboard-banner-actions">
          <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Dicek" : "Terhubung"}</Badge>
          <Button variant="ghost" onClick={loadData} disabled={loading || saving}>{loading ? "Membaca..." : "Refresh Data"}</Button>
        </div>
      </div>

      {hiddenRowsCount > 0 ? <div className="da-login-error" style={{ marginBottom: 16 }}>{hiddenRowsCount} baris kosong/formatting disembunyikan supaya Kas Keluar tidak menampilkan angka yatim.</div> : null}
      {error ? <div className="da-login-error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {success ? (
        <div className="da-form-success" style={{ marginBottom: 16 }}>
          {success}
          {needsRefresh ? (
            <div style={{ marginTop: 6, fontWeight: 700 }}>
              Data sudah tersimpan cepat. Klik Refresh Data kalau mau tarik ulang kas keluar dan mutasi dompet terbaru.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="da-grid da-grid-3">
        <StatCard tone="warning" label="Total Kas Keluar" value={loading ? "..." : formatRupiah(summary.total_out)} description="Total kas keluar tercatat." />
        <StatCard label="Nota / KASOUT" value={loading ? "..." : summary.expense_count} description="Jumlah kas keluar bersih." />
        <StatCard label="Item Belanja" value={loading ? "..." : summary.item_count} description="Rincian item yang tercatat." />
        <StatCard label="Master Belanja" value={loading ? "..." : summary.master_count} description="Item belanja berulang yang terbaca." />
        <StatCard label="Mutasi OUT" value={loading ? "..." : summary.mutation_out_count} description="Uang keluar yang punya gerak dompet." />
        <StatCard tone={summary.perlu_source_count ? "warning" : "default"} label="Perlu Dicek" value={loading ? "..." : summary.perlu_source_count} description="KASOUT yang belum punya mutasi ID." />
      </div>

      <div style={{ height: 18 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Input Live</div>
            <div className="da-big-text">Tambah Belanja / Kas Keluar</div>
            <p className="da-muted">Pilih dompet pembayaran, isi item belanja, lalu cek preview sebelum simpan.</p>
          </div>
          <Badge tone="warning">Potong Dompet</Badge>
        </div>

        <div className="da-form-grid">
          <label className="da-field"><span>Tanggal</span><input type="date" value={form.expense_date} onChange={(event) => updateForm("expense_date", event.target.value)} /></label>
          <label className="da-field">
            <span>Dompet Pembayaran</span>
            <select value={form.wallet_id} onChange={(event) => {
              const wallet = wallets.find((row) => row.wallet_id === event.target.value);
              setForm((current) => ({ ...current, wallet_id: event.target.value, wallet_name: wallet?.wallet_name || "", payment_method: suggestedPaymentMethod(wallet || {}) }));
            }}>
              <option value="">Pilih dompet</option>
              {wallets.map((wallet) => <option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name} {wallet.balance ? `· ${formatRupiah(wallet.balance)}` : ""}</option>)}
            </select>
          </label>
          <label className="da-field"><span>Metode</span><select value={form.payment_method} onChange={(event) => updateForm("payment_method", event.target.value)}>{paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
          <label className="da-field"><span>Toko / Penerima</span><input value={form.vendor_name} onChange={(event) => updateForm("vendor_name", event.target.value)} placeholder="Contoh: Pasar, Haji Muslih" /></label>
          <label className="da-field"><span>PIC</span><input value={form.pic_name} onChange={(event) => updateForm("pic_name", event.target.value)} placeholder="Nama yang belanja" /></label>
          <label className="da-field"><span>Uang Diberikan</span><input inputMode="numeric" value={form.money_given} onChange={(event) => updateForm("money_given", event.target.value)} placeholder="Opsional" /></label>
        </div>

        <div style={{ height: 18 }} />
        <div className="da-section-heading">
          <div><div className="da-mini-title">Rincian Item</div><div className="da-muted">Pilih dari Master Belanja atau ketik manual jika belum ada master.</div></div>
          <Button variant="ghost" onClick={addItemRow}>+ Tambah Item</Button>
        </div>

        <div className="da-table-card">
          <table className="da-table">
            <thead><tr><th>Master</th><th>Nama Item</th><th>Kategori</th><th>Qty</th><th>Satuan</th><th>Harga</th><th>Total</th><th>Aksi</th></tr></thead>
            <tbody>
              {items.map((item, index) => {
                const lineTotal = numberValue(item.qty) * numberValue(item.unit_price);
                return (
                  <tr key={`${index}-${item.expense_master_id || "manual"}`}>
                    <td><select value={item.expense_master_id} onChange={(event) => chooseMasterItem(index, event.target.value)}><option value="">Manual</option>{masterItems.map((master) => <option key={master.expense_master_id} value={master.expense_master_id}>{master.item_name}</option>)}</select></td>
                    <td><input value={item.item_name} onChange={(event) => updateItem(index, "item_name", event.target.value)} placeholder="Nama belanja" /></td>
                    <td><input value={item.category} onChange={(event) => updateItem(index, "category", event.target.value)} /></td>
                    <td><input inputMode="numeric" value={item.qty} onChange={(event) => updateItem(index, "qty", event.target.value)} /></td>
                    <td><input value={item.unit} onChange={(event) => updateItem(index, "unit", event.target.value)} /></td>
                    <td><input inputMode="numeric" value={item.unit_price} onChange={(event) => updateItem(index, "unit_price", event.target.value)} /></td>
                    <td><strong>{formatRupiah(lineTotal)}</strong></td>
                    <td><Button variant="ghost" onClick={() => removeItemRow(index)} disabled={items.length <= 1}>Hapus</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ height: 18 }} />
        <div className="da-form-grid">
          <label className="da-field"><span>Keterangan Singkat</span><input value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="Otomatis dari item jika kosong" /></label>
          <label className="da-field"><span>Catatan</span><input value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Catatan tambahan / bukti nanti" /></label>
        </div>
        <div className="da-modal-note" style={{ marginTop: 16 }}><strong>Total kas keluar:</strong> {formatRupiah(totalAmount)} · <strong>Kembalian:</strong> {formatRupiah(changeAmount)} · <strong>Dompet:</strong> {safeText(selectedWallet?.wallet_name)}</div>
        <div className="da-form-actions" style={{ marginTop: 18 }}><Button variant="ghost" onClick={resetForm} disabled={saving}>Reset</Button><Button onClick={() => setShowConfirm(true)} disabled={!canSubmit}>{saving ? "Menyimpan..." : "Preview & Simpan"}</Button></div>
      </Card>

      <div style={{ height: 18 }} />

      <Card>
        <div className="da-section-heading">
          <div><div className="da-mini-title">Riwayat Kas Keluar</div><div className="da-big-text">Belanja yang Sudah Tercatat</div><p className="da-muted">Klik baris untuk melihat detail item, mutasi dompet, dan sumber arsip.</p></div>
          <Badge tone="success">Live Data</Badge>
        </div>
        <div className="da-tabs" style={{ marginBottom: 12 }}>
          <button className={activeTab === "all" ? "active" : ""} onClick={() => setActiveTab("all")}>Semua</button>
          <button className={activeTab === "hari-ini" ? "active" : ""} onClick={() => setActiveTab("hari-ini")}>Hari Ini</button>
          <button className={activeTab === "perlu-sumber" ? "active" : ""} onClick={() => setActiveTab("perlu-sumber")}>Perlu Mutasi</button>
        </div>
        <DataTable columns={expenseColumns} rows={loading ? [] : filteredExpenses} getRowKey={(row, index) => row.expense_id || index} onRowClick={setSelectedExpense} />
      </Card>

      <Modal open={showConfirm} title="Konfirmasi Kas Keluar" subtitle="Cek sebelum potong dompet" onClose={() => setShowConfirm(false)}>
        <div>
          <div className="da-modal-summary"><div><div className="da-mini-title">Total yang Akan Keluar</div><div className="da-big-text">{formatRupiah(totalAmount)}</div><p className="da-muted">Dompet: <strong>{safeText(selectedWallet?.wallet_name)}</strong></p></div><Badge tone="warning">Uang Keluar</Badge></div>
          <div className="da-detail-grid">
            <div className="da-detail-box"><div className="da-mini-title">Header</div><p><strong>Tanggal:</strong> {safeText(form.expense_date)}</p><p><strong>Metode:</strong> {safeText(form.payment_method)}</p><p><strong>Toko/Penerima:</strong> {safeText(form.vendor_name)}</p><p><strong>Keterangan:</strong> {safeText(payloadPreview.description)}</p></div>
            <div className="da-detail-box"><div className="da-mini-title">Uang</div><p><strong>Total:</strong> {formatRupiah(totalAmount)}</p><p><strong>Uang Diberikan:</strong> {formatRupiah(moneyGiven)}</p><p><strong>Kembalian:</strong> {formatRupiah(changeAmount)}</p><p><strong>Operation ID:</strong> {operationId}</p></div>
          </div>
          <div className="da-modal-note" style={{ marginTop: 14 }}>Setelah disimpan, sistem membuat KASOUT dan mutasi dompet OUT. Data ini muncul di Kas & Dompet, Laporan Harian, dan Arsip Digital.</div>
          <div className="da-form-actions" style={{ marginTop: 16 }}><Button variant="ghost" onClick={() => setShowConfirm(false)} disabled={saving}>Batal</Button><Button onClick={submitExpense} disabled={saving}>{saving ? "Menyimpan..." : "Ya, Simpan Kas Keluar"}</Button></div>
        </div>
      </Modal>

      <Modal open={Boolean(selectedExpense)} title="Detail Kas Keluar" subtitle={selectedExpense?.expense_id || ""} onClose={() => setSelectedExpense(null)}>
        {selectedExpense ? (
          <div>
            <div className="da-modal-summary"><div><div className="da-mini-title">Nominal Kas Keluar</div><div className="da-big-text">{formatRupiah(selectedExpense.amount)}</div><p className="da-muted">Dompet: <strong>{safeText(selectedExpense.wallet_name)}</strong></p></div><Badge tone={isGhostId(selectedExpense.wallet_mutation_id) ? "warning" : "success"}>{isGhostId(selectedExpense.wallet_mutation_id) ? "Perlu Mutasi" : "Tertelusur"}</Badge></div>
            <div className="da-detail-grid">
              <div className="da-detail-box"><div className="da-mini-title">Transaksi</div><p><strong>KASOUT ID:</strong> {safeText(selectedExpense.expense_id)}</p><p><strong>Tanggal:</strong> {formatDisplayDate(selectedExpense.expense_date)}</p><p><strong>Toko/Penerima:</strong> {safeText(selectedExpense.vendor_name)}</p><p><strong>PIC:</strong> {safeText(selectedExpense.pic_name)}</p><p><strong>Metode:</strong> {safeText(selectedExpense.payment_method)}</p></div>
              <div className="da-detail-box"><div className="da-mini-title">Jejak Uang</div><p><strong>Wallet ID:</strong> {safeText(selectedExpense.wallet_id)}</p><p><strong>Mutasi ID:</strong> {safeText(selectedExpense.wallet_mutation_id)}</p><p><strong>Uang Diberikan:</strong> {formatRupiah(selectedExpense.money_given)}</p><p><strong>Kembalian:</strong> {formatRupiah(selectedExpense.change_amount)}</p><p><strong>Operation ID:</strong> {safeText(selectedExpense.operation_id)}</p></div>
            </div>
            <div className="da-modal-note" style={{ marginTop: 14 }}>Rantai ini harus bisa ditelusuri: Belanja/KASOUT → Mutasi Dompet OUT → Kas & Dompet → Laporan Harian → Arsip Digital.</div>
            <div style={{ height: 14 }} />
            <DataTable columns={[{ key: "item_name", label: "Item" }, { key: "category", label: "Kategori" }, { key: "qty", label: "Qty", render: (row) => `${row.qty} ${row.unit}` }, { key: "unit_price", label: "Harga", render: (row) => formatRupiah(row.unit_price) }, { key: "line_total", label: "Total", render: (row) => formatRupiah(row.line_total) }]} rows={selectedExpense.items || []} getRowKey={(row, index) => row.expense_item_id || index} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
