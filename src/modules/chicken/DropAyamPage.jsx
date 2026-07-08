import { useEffect, useMemo, useState } from "react";
import { createDropAyam, getDropAyamBootstrap } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";

const initialForm = {
  drop_date: new Date().toISOString().slice(0, 10),
  supplier_id: "",
  invoice_no: "",
  qty_kg: "",
  unit_cost: "",
  amount_paid: "0",
  payment_wallet_id: "",
  note: "",
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  const parsed = Number(String(value ?? "0").replace(/[^0-9,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function pick(row, fields, fallback = "") {
  for (const field of fields) {
    const value = row?.[field];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
}

function formatDisplayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function makeOperationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hasAnyText(row, fields) {
  return fields.some((field) => String(row?.[field] ?? "").trim() !== "");
}

function hasAnyMoney(row, fields) {
  return fields.some((field) => numberValue(row?.[field]) > 0);
}

function isRealPurchase(row) {
  const id = String(pick(row, ["purchase_id", "purchase_no", "drop_id", "drop_no"])).trim();
  if (id) return true;
  return hasAnyText(row, ["supplier_name", "supplier", "invoice_no", "nota", "item_name"]) &&
    (hasAnyMoney(row, ["qty_kg", "kg", "qty", "total_amount", "amount"]));
}

function isRealLot(row) {
  const id = String(pick(row, ["chicken_lot_id", "lot_id", "lot_no"])).trim();
  if (id) return true;
  return hasAnyText(row, ["supplier_name", "invoice_no", "purchase_id"]) &&
    hasAnyMoney(row, ["qty_kg", "qty_kg_in", "qty_kg_remaining", "remaining_kg", "total_cost"]);
}

function isRealPayable(row) {
  const id = String(pick(row, ["payable_id", "payable_no", "hutang_id"])).trim();
  if (id) return true;
  return hasAnyText(row, ["supplier_name", "vendor_name", "source_id"]) &&
    hasAnyMoney(row, ["remaining_amount", "outstanding_amount", "original_amount", "amount"]);
}

function isActiveStatus(row) {
  const status = String(row?.status || row?.payment_status || row?.payable_status || "").toUpperCase();
  return !status || !["VOID", "CANCEL", "CANCELLED", "DELETED", "INACTIVE"].some((word) => status.includes(word));
}

function cleanRows(rows, predicate) {
  return asArray(rows).filter((row) => row && predicate(row) && isActiveStatus(row));
}

function dedupeBy(rows, getKey) {
  const seen = new Set();
  return rows.filter((row, index) => {
    const key = String(getKey(row) || index).trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSupplier(row) {
  return {
    id: String(pick(row, ["supplier_id", "id", "code", "supplier_code", "nama_supplier", "name"])).trim(),
    name: String(pick(row, ["supplier_name", "name", "nama_supplier", "vendor_name", "supplier"], "")).trim(),
  };
}

function normalizeWallet(row) {
  return {
    id: String(pick(row, ["wallet_id", "id", "code", "wallet_code"])).trim(),
    name: String(pick(row, ["wallet_name", "name", "nama_dompet", "account_name"], "")).trim(),
  };
}

function sumRows(rows, fields) {
  return asArray(rows).reduce((total, row) => {
    for (const field of fields) {
      if (row?.[field] !== undefined && row?.[field] !== "") return total + numberValue(row[field]);
    }
    return total;
  }, 0);
}

function getStatusTone(status) {
  const value = String(status || "").toUpperCase();
  if (value.includes("LUNAS") || value.includes("PAID")) return "success";
  if (value.includes("PARTIAL") || value.includes("SEBAGIAN")) return "warning";
  if (value.includes("OPEN") || value.includes("BELUM")) return "danger";
  if (value.includes("POSTED") || value.includes("ACTIVE")) return "success";
  return "warning";
}

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || message.includes("AUTH_REQUIRED") || (message.includes("SESSION") && message.includes("TIDAK AKTIF"));
}

function getMoneyValue(row) {
  return pick(row, ["remaining_amount", "outstanding_amount", "total_amount", "amount", "original_amount"], 0);
}

function getPurchaseId(row) {
  return pick(row, ["purchase_id", "purchase_no", "drop_id", "drop_no"], "");
}

function getLotId(row) {
  return pick(row, ["chicken_lot_id", "lot_id", "lot_no"], "");
}

function getPayableId(row) {
  return pick(row, ["payable_id", "payable_no", "hutang_id"], "");
}

function buildSummary({ purchases, lots, payables }) {
  const totalKgMasuk = sumRows(purchases, ["qty_kg", "kg", "qty"]);
  const totalModalAyam = sumRows(purchases, ["total_amount", "amount"]);
  const totalDibayar = sumRows(purchases, ["amount_paid", "paid_amount"]);
  const totalSisaHutang = sumRows(payables, ["remaining_amount", "outstanding_amount", "original_amount", "amount"]);
  const totalKgSisa = sumRows(lots, ["qty_kg_remaining", "remaining_kg", "qty_remaining"]);

  return {
    totalDrop: purchases.length,
    totalLot: lots.length,
    totalHutang: payables.length,
    totalKgMasuk,
    totalKgSisa,
    totalModalAyam,
    totalDibayar,
    totalSisaHutang,
  };
}

function buildDropPreview(form, suppliers, wallets) {
  const qtyKg = numberValue(form.qty_kg);
  const unitCost = numberValue(form.unit_cost);
  const amountPaid = numberValue(form.amount_paid);
  const totalAmount = qtyKg * unitCost;
  const remainingAmount = Math.max(totalAmount - amountPaid, 0);
  const supplier = suppliers.find((item) => item.id === form.supplier_id);
  const wallet = wallets.find((item) => item.id === form.payment_wallet_id);

  let paymentStatus = "BELUM DIBAYAR";
  if (totalAmount > 0 && amountPaid >= totalAmount) paymentStatus = "LUNAS";
  if (amountPaid > 0 && amountPaid < totalAmount) paymentStatus = "BAYAR SEBAGIAN";

  return {
    drop_date: form.drop_date,
    supplier_id: form.supplier_id,
    supplier_name: supplier?.name || form.supplier_id,
    invoice_no: form.invoice_no,
    qty_kg: qtyKg,
    unit_cost: unitCost,
    total_amount: totalAmount,
    amount_paid: amountPaid,
    remaining_amount: remainingAmount,
    payment_status: paymentStatus,
    payment_wallet_id: form.payment_wallet_id,
    payment_wallet_name: wallet?.name || "",
    note: form.note,
  };
}

function validateDropForm(form, preview) {
  const errors = [];
  if (!form.drop_date) errors.push("Tanggal DROP wajib diisi.");
  if (!form.supplier_id) errors.push("Supplier wajib dipilih.");
  if (preview.qty_kg <= 0) errors.push("Kg ayam harus lebih dari 0.");
  if (preview.unit_cost <= 0) errors.push("Harga/kg aktual harus lebih dari 0.");
  if (preview.amount_paid < 0) errors.push("Bayar saat DROP tidak boleh minus.");
  if (preview.amount_paid > preview.total_amount) errors.push("Bayar saat DROP tidak boleh lebih besar dari total modal ayam.");
  if (preview.amount_paid > 0 && !form.payment_wallet_id) errors.push("Kalau ada pembayaran, dompet pembayaran wajib dipilih.");
  return errors;
}

function buildLivePayload({ preview, session }) {
  const operationId = makeOperationId();
  return {
    operation_id: operationId,
    request_id: operationId,
    idempotency_key: operationId,
    purchase: {
      operation_id: operationId,
      location_id: session?.user?.location_id || "",
      purchase_date: preview.drop_date,
      drop_date: preview.drop_date,
      supplier_id: preview.supplier_id,
      supplier_name: preview.supplier_name,
      invoice_no: preview.invoice_no,
      qty_kg: preview.qty_kg,
      unit: "kg",
      unit_cost: preview.unit_cost,
      amount_paid: preview.amount_paid,
      wallet_id: preview.payment_wallet_id,
      notes: preview.note,
    },
  };
}

function findLinkedLot(drop, lots) {
  const purchaseId = String(getPurchaseId(drop));
  const purchaseLotId = String(pick(drop, ["chicken_lot_id", "lot_id"]));
  return lots.find((lot) => {
    const lotId = String(getLotId(lot));
    const sourceId = String(pick(lot, ["source_id", "purchase_id", "ref_id"]));
    return (lotId && purchaseLotId && lotId === purchaseLotId) || (sourceId && purchaseId && sourceId === purchaseId);
  });
}

function findLinkedPayable(drop, payables) {
  const purchaseId = String(getPurchaseId(drop));
  const dropPayableId = String(pick(drop, ["payable_id", "hutang_id"]));
  return payables.find((payable) => {
    const payableId = String(getPayableId(payable));
    const sourceId = String(pick(payable, ["source_id", "purchase_id", "ref_id"]));
    return (payableId && dropPayableId && payableId === dropPayableId) || (sourceId && purchaseId && sourceId === purchaseId);
  });
}

function TraceItem({ label, value, tone = "warning" }) {
  const hasValue = value && value !== "-";
  return (
    <div className="da-trace-item">
      <div>
        <div className="da-trace-label">{label}</div>
        <div className="da-trace-value">{safeText(value, "Belum terbaca")}</div>
      </div>
      <Badge tone={hasValue ? tone : "warning"}>{hasValue ? "Ada" : "N/A"}</Badge>
    </div>
  );
}

export default function DropAyamPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const rawPurchases = asArray(bootstrap?.purchases);
  const rawLots = asArray(bootstrap?.chicken_lots);
  const rawPayables = asArray(bootstrap?.payables);

  const purchases = useMemo(() => dedupeBy(cleanRows(rawPurchases, isRealPurchase), getPurchaseId), [rawPurchases]);
  const lots = useMemo(() => dedupeBy(cleanRows(rawLots, isRealLot), getLotId), [rawLots]);
  const payables = useMemo(() => dedupeBy(cleanRows(rawPayables, isRealPayable), getPayableId), [rawPayables]);

  const hiddenRows = useMemo(() => {
    const backendHidden = numberValue(bootstrap?.hidden_rows || bootstrap?.summary?.hidden_rows || 0);
    const localHidden = Math.max(rawPurchases.length - purchases.length, 0) + Math.max(rawLots.length - lots.length, 0) + Math.max(rawPayables.length - payables.length, 0);
    return Math.max(backendHidden, localHidden);
  }, [bootstrap, rawPurchases.length, purchases.length, rawLots.length, lots.length, rawPayables.length, payables.length]);

  const suppliers = useMemo(() => {
    const fromMaster = asArray(bootstrap?.suppliers).map(normalizeSupplier).filter((item) => item.id || item.name);
    const fromPurchases = purchases.map((row) => ({
      id: String(pick(row, ["supplier_id", "supplier_name", "supplier"], "")).trim(),
      name: String(pick(row, ["supplier_name", "supplier", "vendor_name"], "")).trim(),
    })).filter((item) => item.id || item.name);
    return dedupeBy([...fromMaster, ...fromPurchases], (item) => item.id || item.name);
  }, [bootstrap, purchases]);

  const wallets = useMemo(() => {
    return asArray(bootstrap?.wallets).map(normalizeWallet).filter((item) => item.id || item.name);
  }, [bootstrap]);

  const summary = useMemo(() => buildSummary({ purchases, lots, payables }), [purchases, lots, payables]);
  const preview = useMemo(() => buildDropPreview(form, suppliers, wallets), [form, suppliers, wallets]);
  const validationErrors = useMemo(() => validateDropForm(form, preview), [form, preview]);
  const canOpenConfirmation = validationErrors.length === 0;
  const livePayload = useMemo(() => buildLivePayload({ preview, session }), [preview, session]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    const result = await getDropAyamBootstrap(session?.sessionToken, { source: "part_4z_drop_clean_trace" });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setError(result.message || "Gagal membaca data DROP Ayam.");
      setBootstrap(null);
      setLoading(false);
      return;
    }

    setBootstrap(result.data || {});
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionToken]);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handlePreviewSubmit = (event) => {
    event.preventDefault();
    setShowValidationErrors(true);
    if (canOpenConfirmation) setConfirmOpen(true);
  };

  const handleResetForm = () => {
    setForm(initialForm);
    setConfirmOpen(false);
    setSubmitResult(null);
    setShowValidationErrors(false);
  };

  const handleLiveSubmit = async () => {
    if (submitting || validationErrors.length > 0) return;
    setSubmitting(true);
    setSubmitResult(null);

    const result = await createDropAyam(session?.sessionToken, livePayload);
    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setSubmitResult({ success: false, message: result.message || "Gagal menyimpan DROP Ayam.", data: result.data || null });
      setSubmitting(false);
      return;
    }

    setSubmitResult({ success: true, message: result.message || "DROP Ayam berhasil disimpan.", data: result.data || null });
    setConfirmOpen(false);
    setSubmitting(false);
    setForm(initialForm);
    setShowValidationErrors(false);
    await loadData();
  };

  const columns = [
    { key: "purchase_date", label: "Tanggal", render: (row) => formatDisplayDate(pick(row, ["purchase_date", "drop_date", "date"])) },
    { key: "purchase_id", label: "DROP ID", render: (row) => <strong>{safeText(getPurchaseId(row))}</strong> },
    { key: "supplier_name", label: "Supplier", render: (row) => safeText(pick(row, ["supplier_name", "supplier", "vendor_name"], "NANA / BANG ITEM AYAM")) },
    { key: "qty_kg", label: "Kg", render: (row) => `${numberValue(pick(row, ["qty_kg", "kg", "qty"])).toLocaleString("id-ID")} kg` },
    { key: "unit_cost", label: "Harga / Kg", render: (row) => formatRupiah(pick(row, ["unit_cost", "price_per_kg", "harga_kg"])) },
    { key: "total_amount", label: "Total Modal", render: (row) => formatRupiah(pick(row, ["total_amount", "amount"])) },
    { key: "payment_status", label: "Status", render: (row) => <Badge tone={getStatusTone(row.payment_status || row.status)}>{safeText(row.payment_status || row.status)}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="DROP Ayam"
        description="Catatan ayam masuk dari supplier. Harga ayam dikunci per nota/drop agar transaksi lama tidak berubah saat harga baru berubah."
        badge="Live Trace"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Nyawa produksi</div>
          <div className="da-dashboard-banner-title">DROP Ayam → Lot Harga Aktual → Hutang Nana</div>
          <div className="da-dashboard-banner-desc">Satu nota ayam harus membuat rantai ID: DROP, lot, gerak stok, hutang, dan arsip.</div>
        </div>
        <div className="da-dashboard-banner-actions">
          <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Dicek" : "Terhubung"}</Badge>
          <Button variant="ghost" onClick={loadData} disabled={loading || submitting}>{loading ? "Membaca..." : "Refresh Data"}</Button>
        </div>
      </div>

      {error ? <div className="da-login-error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {hiddenRows > 0 ? <div className="da-form-warning" style={{ marginBottom: 16 }}>{hiddenRows} baris kosong/formatting disembunyikan supaya DROP Ayam tidak menampilkan angka yatim.</div> : null}
      {submitResult ? <div className={submitResult.success ? "da-form-success" : "da-form-warning"} style={{ marginBottom: 16 }}>{submitResult.message}</div> : null}

      <div className="da-grid da-grid-3">
        <StatCard tone="primary" label="Total Modal Ayam" value={loading ? "..." : formatRupiah(summary.totalModalAyam)} description="Total nilai DROP Ayam bersih yang terbaca." />
        <StatCard label="Kg Ayam Masuk" value={loading ? "..." : `${summary.totalKgMasuk.toLocaleString("id-ID")} kg`} description="Total kg ayam dari nota/drop bersih." />
        <StatCard tone="warning" label="Sisa Hutang Nana" value={loading ? "..." : formatRupiah(summary.totalSisaHutang)} description="Sisa hutang supplier ayam yang terbaca." />
      </div>

      <div style={{ height: 16 }} />

      <div className="da-grid da-grid-3">
        <StatCard label="Jumlah DROP" value={loading ? "..." : summary.totalDrop} description="Jumlah nota/drop ayam bersih." />
        <StatCard label="Lot Ayam Aktif" value={loading ? "..." : summary.totalLot} description="Lot harga aktual ayam yang siap dipakai produksi." />
        <StatCard label="Sisa Kg Ayam" value={loading ? "..." : `${summary.totalKgSisa.toLocaleString("id-ID")} kg`} description="Sisa kg ayam dari lot aktif." />
      </div>

      <div style={{ height: 16 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Form DROP Ayam</div>
            <div className="da-big-text">Input DROP Ayam</div>
            <p className="da-muted">Harga/kg akan dikunci sebagai modal ayam aktual. Simpan hanya setelah nota benar.</p>
          </div>
          <Badge tone="danger">Live Transaction</Badge>
        </div>

        <form onSubmit={handlePreviewSubmit}>
          <div className="da-drop-form-preview">
            <div className="da-drop-field"><label>Tanggal DROP</label><input type="date" className="da-input" value={form.drop_date} onChange={(event) => updateForm("drop_date", event.target.value)} disabled={submitting} /></div>
            <div className="da-drop-field"><label>Supplier</label><select className="da-select" value={form.supplier_id} onChange={(event) => updateForm("supplier_id", event.target.value)} disabled={submitting}><option value="">Pilih supplier</option>{suppliers.map((supplier) => <option key={supplier.id || supplier.name} value={supplier.id || supplier.name}>{supplier.name || supplier.id}</option>)}</select></div>
            <div className="da-drop-field"><label>No Nota Supplier</label><input className="da-input" value={form.invoice_no} placeholder="Contoh: NANA-2026-001" onChange={(event) => updateForm("invoice_no", event.target.value)} disabled={submitting} /></div>
            <div className="da-drop-field"><label>Kg Ayam</label><input className="da-input" inputMode="decimal" value={form.qty_kg} placeholder="Contoh: 1020" onChange={(event) => updateForm("qty_kg", event.target.value)} disabled={submitting} /></div>
            <div className="da-drop-field"><label>Harga / Kg Aktual</label><input className="da-input" inputMode="numeric" value={form.unit_cost} placeholder="Contoh: 36500" onChange={(event) => updateForm("unit_cost", event.target.value)} disabled={submitting} /></div>
            <div className="da-drop-field"><label>Bayar Saat DROP</label><input className="da-input" inputMode="numeric" value={form.amount_paid} placeholder="0 kalau belum bayar" onChange={(event) => updateForm("amount_paid", event.target.value)} disabled={submitting} /></div>
            <div className="da-drop-field"><label>Dompet Pembayaran</label><select className="da-select" value={form.payment_wallet_id} onChange={(event) => updateForm("payment_wallet_id", event.target.value)} disabled={submitting}><option value="">Pilih kalau ada pembayaran</option>{wallets.map((wallet) => <option key={wallet.id || wallet.name} value={wallet.id || wallet.name}>{wallet.name || wallet.id}</option>)}</select></div>
            <div className="da-drop-field da-drop-field-wide"><label>Catatan</label><input className="da-input" value={form.note} placeholder="Contoh: turun ayam pagi / titip travel / nota berjalan" onChange={(event) => updateForm("note", event.target.value)} disabled={submitting} /></div>
          </div>

          <div className="da-drop-preview-panel">
            <div><div className="da-mini-title">Preview Modal Ayam</div><div className="da-big-text">{formatRupiah(preview.total_amount)}</div><p className="da-muted">{preview.qty_kg.toLocaleString("id-ID")} kg × {formatRupiah(preview.unit_cost)} / kg</p></div>
            <div><div className="da-mini-title">Bayar Saat DROP</div><div className="da-big-text">{formatRupiah(preview.amount_paid)}</div><p className="da-muted">Sisa hutang: <strong>{formatRupiah(preview.remaining_amount)}</strong></p></div>
            <div><div className="da-mini-title">Status Bayar</div><div className="da-big-text">{preview.payment_status}</div><p className="da-muted">Status ini dikirim saat simpan.</p></div>
          </div>

          {showValidationErrors && validationErrors.length > 0 ? <div className="da-form-warning">{validationErrors.map((item) => <div key={item}>• {item}</div>)}</div> : null}
          <div className="da-form-actions"><Button type="button" variant="ghost" onClick={handleResetForm} disabled={submitting}>Reset Form</Button><Button type="submit" disabled={!canOpenConfirmation || submitting}>Preview & Konfirmasi</Button></div>
        </form>
      </Card>

      <div style={{ height: 16 }} />

      <Card>
        <div className="da-section-heading">
          <div><div className="da-mini-title">Daftar DROP Ayam</div><div className="da-big-text">Nota Ayam yang Terbaca</div><p className="da-muted">Klik baris untuk lihat detail popup tengah: DROP, lot, hutang, stok, modal, dan ID terkait.</p></div>
          <Badge tone="warning">Live Data</Badge>
        </div>
        <DataTable columns={columns} rows={loading ? [] : purchases} getRowKey={(row, index) => getPurchaseId(row) || index} onRowClick={setSelectedDrop} />
      </Card>

      <Modal open={confirmOpen} title="Konfirmasi Simpan DROP Ayam" subtitle="Ini akan membuat transaksi hidup" onClose={() => { if (!submitting) setConfirmOpen(false); }}>
        <div className="da-modal-summary"><div><div className="da-mini-title">Total Modal Ayam</div><div className="da-big-text">{formatRupiah(preview.total_amount)}</div><p className="da-muted">Harga/kg aktual ini akan dikunci untuk nota/drop ini.</p></div><Badge tone={preview.remaining_amount > 0 ? "warning" : "success"}>{preview.payment_status}</Badge></div>
        <div className="da-detail-grid">
          <div className="da-detail-box"><div className="da-mini-title">DROP</div><p><strong>Tanggal:</strong> {formatDisplayDate(preview.drop_date)}</p><p><strong>Supplier:</strong> {safeText(preview.supplier_name)}</p><p><strong>No Nota:</strong> {safeText(preview.invoice_no, "Belum diisi")}</p></div>
          <div className="da-detail-box"><div className="da-mini-title">Ayam Masuk</div><p><strong>Kg:</strong> {preview.qty_kg.toLocaleString("id-ID")} kg</p><p><strong>Harga/kg:</strong> {formatRupiah(preview.unit_cost)}</p><p><strong>Total modal:</strong> {formatRupiah(preview.total_amount)}</p></div>
          <div className="da-detail-box"><div className="da-mini-title">Pembayaran</div><p><strong>Dibayar:</strong> {formatRupiah(preview.amount_paid)}</p><p><strong>Dompet:</strong> {safeText(preview.payment_wallet_name, "Belum bayar")}</p><p><strong>Sisa hutang:</strong> {formatRupiah(preview.remaining_amount)}</p></div>
          <div className="da-detail-box"><div className="da-mini-title">Yang Dibuat Backend</div><p><strong>DROP Ayam:</strong> Ya</p><p><strong>Lot Harga Aktual:</strong> Ya</p><p><strong>Hutang Nana:</strong> {preview.remaining_amount > 0 ? "Ya" : "Tidak"}</p><p><strong>Mutasi Dompet:</strong> {preview.amount_paid > 0 ? "Ya" : "Tidak"}</p></div>
        </div>
        <div className="da-modal-note" style={{ marginTop: 14 }}>Setelah disimpan, backend membuat DROP Ayam, Lot Harga Aktual, stok ayam masuk, hutang Nana jika belum lunas, mutasi dompet jika ada pembayaran, arsip, dan audit.</div>
        {submitResult && !submitResult.success ? <div className="da-form-warning">{submitResult.message}</div> : null}
        <div className="da-form-actions"><Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>Koreksi Lagi</Button><Button type="button" onClick={handleLiveSubmit} disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan Live DROP Ayam"}</Button></div>
      </Modal>

      <Modal open={Boolean(selectedDrop)} title={selectedDrop ? "Detail DROP Ayam" : ""} subtitle={selectedDrop ? getPurchaseId(selectedDrop) : ""} onClose={() => setSelectedDrop(null)}>
        {selectedDrop ? <DropDetailModal selectedDrop={selectedDrop} linkedLot={findLinkedLot(selectedDrop, lots)} linkedPayable={findLinkedPayable(selectedDrop, payables)} /> : null}
      </Modal>
    </div>
  );
}

function DropDetailModal({ selectedDrop, linkedLot, linkedPayable }) {
  const dropId = getPurchaseId(selectedDrop);
  const lotId = getLotId(linkedLot) || pick(selectedDrop, ["chicken_lot_id", "lot_id"], "-");
  const payableId = getPayableId(linkedPayable) || pick(selectedDrop, ["payable_id", "hutang_id"], "-");
  const stockMovementId = pick(selectedDrop, ["stock_movement_id", "raw_stock_movement_id"], pick(linkedLot, ["stock_movement_id"], "-"));
  const costLayerId = pick(selectedDrop, ["cost_layer_id", "stock_layer_id", "inventory_cost_layer_id"], pick(linkedLot, ["cost_layer_id", "stock_layer_id", "inventory_cost_layer_id"], "-"));
  const lotRemaining = numberValue(pick(linkedLot, ["qty_kg_remaining", "remaining_kg", "qty_remaining"], 0));
  const lotUnitCost = pick(linkedLot, ["unit_cost", "price_per_kg", "harga_kg"], selectedDrop.unit_cost);

  return (
    <div>
      <div className="da-modal-summary"><div><div className="da-mini-title">Total Modal Ayam</div><div className="da-big-text">{formatRupiah(pick(selectedDrop, ["total_amount", "amount"]))}</div><p className="da-muted">Harga/kg dikunci di nota ini: <strong>{formatRupiah(pick(selectedDrop, ["unit_cost", "harga_kg"]))}</strong>.</p></div><Badge tone={getStatusTone(selectedDrop.payment_status || selectedDrop.status)}>{safeText(selectedDrop.payment_status || selectedDrop.status)}</Badge></div>

      <div className="da-trace-strip"><TraceItem label="DROP Ayam" value={dropId} tone="success" /><TraceItem label="Lot Harga Aktual" value={lotId} tone="success" /><TraceItem label="Hutang Nana" value={payableId} tone="warning" /><TraceItem label="Stok Ayam" value={stockMovementId} tone="success" /><TraceItem label="Modal Lot" value={costLayerId} tone="success" /></div>

      <div className="da-detail-grid">
        <div className="da-detail-box"><div className="da-mini-title">DROP</div><p><strong>ID:</strong> {safeText(dropId)}</p><p><strong>Tanggal:</strong> {formatDisplayDate(pick(selectedDrop, ["purchase_date", "drop_date", "date"]))}</p><p><strong>Supplier:</strong> {safeText(pick(selectedDrop, ["supplier_name", "supplier", "vendor_name"]))}</p><p><strong>No Nota:</strong> {safeText(pick(selectedDrop, ["invoice_no", "nota", "no_nota"]))}</p></div>
        <div className="da-detail-box"><div className="da-mini-title">Ayam Masuk</div><p><strong>Kg:</strong> {numberValue(pick(selectedDrop, ["qty_kg", "kg", "qty"])).toLocaleString("id-ID")} kg</p><p><strong>Harga/kg:</strong> {formatRupiah(pick(selectedDrop, ["unit_cost", "price_per_kg", "harga_kg"]))}</p><p><strong>Total:</strong> {formatRupiah(pick(selectedDrop, ["total_amount", "amount"]))}</p><p><strong>Dibayar:</strong> {formatRupiah(pick(selectedDrop, ["amount_paid", "paid_amount"]))}</p></div>
        <div className="da-detail-box"><div className="da-mini-title">Lot Harga Aktual</div>{linkedLot ? <><p><strong>Lot ID:</strong> {safeText(lotId)}</p><p><strong>Sisa kg:</strong> {lotRemaining.toLocaleString("id-ID")} kg</p><p><strong>Harga/kg:</strong> {formatRupiah(lotUnitCost)}</p><p><strong>Status:</strong> {safeText(linkedLot.status)}</p></> : <p className="da-muted">Lot belum terbaca di bootstrap.</p>}</div>
        <div className="da-detail-box"><div className="da-mini-title">Hutang Nana</div>{linkedPayable ? <><p><strong>Hutang ID:</strong> {safeText(payableId)}</p><p><strong>Nominal:</strong> {formatRupiah(getMoneyValue(linkedPayable))}</p><p><strong>Status:</strong> {safeText(linkedPayable.status || linkedPayable.payable_status)}</p><p><strong>Sumber:</strong> {safeText(linkedPayable.source_id || linkedPayable.purchase_id)}</p></> : <p className="da-muted">Tidak ada hutang terkait / sudah lunas.</p>}</div>
      </div>

      <div className="da-modal-note" style={{ marginTop: 14 }}>Rantai transaksi ini harus tetap terkunci: DROP Ayam → Lot Harga Aktual → Produksi/Adukan → Stok Jadi → Order → Uang Masuk → Hutang Nana → 4 Amplop.</div>
    </div>
  );
}
