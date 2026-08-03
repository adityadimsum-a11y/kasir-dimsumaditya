import { useEffect, useMemo, useState } from "react";
import { createDropAyam, getDropAyamBootstrap } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import ProductionFlowPanel from "../production/ProductionFlowPanel";

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

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function numberValue(value) {
  const clean = String(value ?? "0")
    .replace(/[^0-9,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function pick(row, fields, fallback = "") {
  for (const field of fields) {
    const value = row?.[field];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return fallback;
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

  return (
    hasAnyText(row, ["supplier_name", "supplier", "invoice_no", "nota", "item_name"]) &&
    hasAnyMoney(row, ["qty_kg", "kg", "qty", "total_amount", "amount"])
  );
}

function isRealLot(row) {
  const id = String(pick(row, ["chicken_lot_id", "lot_id", "lot_no"])).trim();
  if (id) return true;

  return (
    hasAnyText(row, ["supplier_name", "invoice_no", "purchase_id"]) &&
    hasAnyMoney(row, ["qty_kg", "qty_kg_in", "qty_kg_remaining", "remaining_kg", "total_cost"])
  );
}

function isRealPayable(row) {
  const id = String(pick(row, ["payable_id", "payable_no", "hutang_id"])).trim();
  if (id) return true;

  return (
    hasAnyText(row, ["supplier_name", "vendor_name", "source_id"]) &&
    hasAnyMoney(row, ["remaining_amount", "outstanding_amount", "original_amount", "amount"])
  );
}

function isActiveStatus(row) {
  const status = String(row?.status || row?.payment_status || row?.payable_status || "").toUpperCase();

  return !["VOID", "CANCEL", "CANCELLED", "DELETED", "INACTIVE"].some((word) =>
    status.includes(word)
  );
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
      if (row?.[field] !== undefined && row?.[field] !== "") {
        return total + numberValue(row[field]);
      }
    }

    return total;
  }, 0);
}

function getStatusTone(status) {
  const value = String(status || "").toUpperCase();

  if (value.includes("LUNAS") || value.includes("PAID")) return "success";
  if (value.includes("POSTED") || value.includes("ACTIVE")) return "success";
  if (value.includes("PARTIAL") || value.includes("SEBAGIAN")) return "warning";
  if (value.includes("OPEN") || value.includes("BELUM")) return "warning";

  return "warning";
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
  const totalSisaHutang = sumRows(payables, [
    "remaining_amount",
    "outstanding_amount",
    "original_amount",
    "amount",
  ]);
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
  if (preview.amount_paid > preview.total_amount) {
    errors.push("Bayar saat DROP tidak boleh lebih besar dari total modal ayam.");
  }
  if (preview.amount_paid > 0 && !form.payment_wallet_id) {
    errors.push("Kalau ada pembayaran, dompet pembayaran wajib dipilih.");
  }

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

    return (
      (lotId && purchaseLotId && lotId === purchaseLotId) ||
      (sourceId && purchaseId && sourceId === purchaseId)
    );
  });
}

function findLinkedPayable(drop, payables) {
  const purchaseId = String(getPurchaseId(drop));
  const dropPayableId = String(pick(drop, ["payable_id", "hutang_id"]));

  return payables.find((payable) => {
    const payableId = String(getPayableId(payable));
    const sourceId = String(pick(payable, ["source_id", "purchase_id", "ref_id"]));

    return (
      (payableId && dropPayableId && payableId === dropPayableId) ||
      (sourceId && purchaseId && sourceId === purchaseId)
    );
  });
}

function TraceItem({ label, value, tone = "warning" }) {
  const hasValue = value && value !== "-";

  return (
    <div className="da-trace-item">
      <div className="da-trace-label">{label}</div>
      <div className="da-trace-value">{hasValue ? value : "Belum terbaca"}</div>
      <Badge tone={hasValue ? tone : "warning"}>{hasValue ? "Terhubung" : "Perlu Cek"}</Badge>
    </div>
  );
}

function SummaryPill({ label, value }) {
  return (
    <div className="da-drop-summary-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="da-drop-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function PreviewPanel({ preview }) {
  return (
    <div className="da-drop-preview-panel">
      <div className="da-page-kicker">PREVIEW MODAL AYAM</div>

      <div className="da-drop-preview-total">{formatRupiah(preview.total_amount)}</div>
      <p>
        {preview.qty_kg.toLocaleString("id-ID")} kg × {formatRupiah(preview.unit_cost)} / kg
      </p>

      <div className="da-drop-preview-grid">
        <SummaryPill label="Bayar Saat DROP" value={formatRupiah(preview.amount_paid)} />
        <SummaryPill label="Sisa Hutang" value={formatRupiah(preview.remaining_amount)} />
        <SummaryPill label="Status Bayar" value={preview.payment_status} />
      </div>

      <div className="da-drop-preview-note">
        Setelah disimpan, harga/kg dikunci sebagai modal ayam aktual untuk nota/drop ini.
      </div>
    </div>
  );
}

function mapBootstrap(data) {
  const source = data || {};

  const purchasesRaw = firstArray(
    source.purchases,
    source.chicken_purchases,
    source.drop_ayam,
    source.drops,
    source.records,
    source.rows,
    source.data?.purchases
  );

  const lotsRaw = firstArray(
    source.lots,
    source.chicken_lots,
    source.chickenLots,
    source.data?.lots
  );

  const payablesRaw = firstArray(
    source.payables,
    source.hutang_nana,
    source.hutang,
    source.supplier_payables,
    source.data?.payables
  );

  const suppliersRaw = firstArray(
    source.suppliers,
    source.master_suppliers,
    source.options?.suppliers,
    source.data?.suppliers
  );

  const walletsRaw = firstArray(
    source.wallets,
    source.dompet,
    source.options?.wallets,
    source.data?.wallets
  );

  const purchases = cleanRows(purchasesRaw, isRealPurchase);
  const lots = cleanRows(lotsRaw, isRealLot);
  const payables = cleanRows(payablesRaw, isRealPayable);

  const suppliers = dedupeBy(
    suppliersRaw.map(normalizeSupplier).filter((item) => item.id || item.name),
    (item) => item.id || item.name
  );

  const wallets = dedupeBy(
    walletsRaw.map(normalizeWallet).filter((item) => item.id || item.name),
    (item) => item.id || item.name
  );

  return {
    purchases,
    lots,
    payables,
    suppliers,
    wallets,
  };
}

function DropDetailModal({ selectedDrop, linkedLot, linkedPayable }) {
  const dropId = getPurchaseId(selectedDrop);
  const lotId =
    getLotId(linkedLot) || pick(selectedDrop, ["chicken_lot_id", "lot_id"], "-");
  const payableId =
    getPayableId(linkedPayable) || pick(selectedDrop, ["payable_id", "hutang_id"], "-");
  const stockMovementId = pick(
    selectedDrop,
    ["stock_movement_id", "raw_stock_movement_id"],
    pick(linkedLot, ["stock_movement_id"], "-")
  );
  const costLayerId = pick(
    selectedDrop,
    ["cost_layer_id", "stock_layer_id", "inventory_cost_layer_id"],
    pick(linkedLot, ["cost_layer_id", "stock_layer_id", "inventory_cost_layer_id"], "-")
  );
  const lotRemaining = numberValue(pick(linkedLot, ["qty_kg_remaining", "remaining_kg", "qty_remaining"], 0));
  const lotUnitCost = pick(linkedLot, ["unit_cost", "price_per_kg", "harga_kg"], selectedDrop.unit_cost);

  return (
    <div className="da-drop-detail">
      <div className="da-drop-modal-summary">
        <div>
          <div className="da-page-kicker">TOTAL MODAL AYAM</div>
          <div className="da-drop-modal-total">
            {formatRupiah(pick(selectedDrop, ["total_amount", "amount"]))}
          </div>
          <p>
            Harga/kg dikunci di nota ini:{" "}
            <strong>{formatRupiah(pick(selectedDrop, ["unit_cost", "harga_kg"]))}</strong>
          </p>
        </div>

        <Badge tone={getStatusTone(selectedDrop.payment_status || selectedDrop.status)}>
          {safeText(selectedDrop.payment_status || selectedDrop.status)}
        </Badge>
      </div>

      <div className="da-trace-strip">
        <TraceItem label="DROP Ayam" value={dropId} tone="success" />
        <TraceItem label="Lot Harga Aktual" value={lotId} tone="success" />
        <TraceItem label="Hutang Nana" value={payableId} tone="warning" />
        <TraceItem label="Stok Ayam" value={stockMovementId} tone="success" />
        <TraceItem label="Modal Lot" value={costLayerId} tone="success" />
      </div>

      <div className="da-drop-detail-grid">
        <div className="da-detail-box">
          <div className="da-page-kicker">DROP</div>
          <p><strong>ID:</strong> {safeText(dropId)}</p>
          <p><strong>Tanggal:</strong> {formatDisplayDate(pick(selectedDrop, ["purchase_date", "drop_date", "date"]))}</p>
          <p><strong>Supplier:</strong> {safeText(pick(selectedDrop, ["supplier_name", "supplier", "vendor_name"]))}</p>
          <p><strong>No Nota:</strong> {safeText(pick(selectedDrop, ["invoice_no", "nota", "no_nota"]))}</p>
        </div>

        <div className="da-detail-box">
          <div className="da-page-kicker">AYAM MASUK</div>
          <p><strong>Kg:</strong> {numberValue(pick(selectedDrop, ["qty_kg", "kg", "qty"])).toLocaleString("id-ID")} kg</p>
          <p><strong>Harga/kg:</strong> {formatRupiah(pick(selectedDrop, ["unit_cost", "price_per_kg", "harga_kg"]))}</p>
          <p><strong>Total:</strong> {formatRupiah(pick(selectedDrop, ["total_amount", "amount"]))}</p>
          <p><strong>Dibayar:</strong> {formatRupiah(pick(selectedDrop, ["amount_paid", "paid_amount"]))}</p>
        </div>

        <div className="da-detail-box">
          <div className="da-page-kicker">LOT HARGA AKTUAL</div>
          {linkedLot ? (
            <>
              <p><strong>Lot ID:</strong> {safeText(lotId)}</p>
              <p><strong>Sisa kg:</strong> {lotRemaining.toLocaleString("id-ID")} kg</p>
              <p><strong>Harga/kg:</strong> {formatRupiah(lotUnitCost)}</p>
              <p><strong>Status:</strong> {safeText(linkedLot.status)}</p>
            </>
          ) : (
            <p className="da-muted">Lot belum terbaca di bootstrap.</p>
          )}
        </div>

        <div className="da-detail-box">
          <div className="da-page-kicker">HUTANG NANA</div>
          {linkedPayable ? (
            <>
              <p><strong>Hutang ID:</strong> {safeText(payableId)}</p>
              <p><strong>Nominal:</strong> {formatRupiah(getMoneyValue(linkedPayable))}</p>
              <p><strong>Status:</strong> {safeText(linkedPayable.status || linkedPayable.payable_status)}</p>
              <p><strong>Sumber:</strong> {safeText(linkedPayable.source_id || linkedPayable.purchase_id)}</p>
            </>
          ) : (
            <p className="da-muted">Tidak ada hutang terkait / sudah lunas.</p>
          )}
        </div>
      </div>

      <div className="da-drop-note">
        Rantai transaksi ini harus tetap terkunci: DROP Ayam → Lot Harga Aktual → Produksi/Adukan → Stok Jadi → Order → Uang Masuk → Hutang Nana → 4 Amplop.
      </div>
    </div>
  );
}

function buildColumns({ lots, payables, onSelect }) {
  return [
    {
      key: "date",
      label: "Tanggal",
      render: (row) => formatDisplayDate(pick(row, ["purchase_date", "drop_date", "date"])),
    },
    {
      key: "id",
      label: "DROP ID",
      render: (row) => <strong>{safeText(getPurchaseId(row))}</strong>,
    },
    {
      key: "supplier",
      label: "Supplier",
      render: (row) => safeText(pick(row, ["supplier_name", "supplier", "vendor_name"])),
    },
    {
      key: "kg",
      label: "Kg",
      render: (row) => `${numberValue(pick(row, ["qty_kg", "kg", "qty"])).toLocaleString("id-ID")} kg`,
    },
    {
      key: "unit",
      label: "Harga / Kg",
      render: (row) => formatRupiah(pick(row, ["unit_cost", "price_per_kg", "harga_kg"])),
    },
    {
      key: "amount",
      label: "Total Modal",
      render: (row) => formatRupiah(pick(row, ["total_amount", "amount"])),
    },
    {
      key: "trace",
      label: "Rantai",
      render: (row) => {
        const lot = findLinkedLot(row, lots);
        const payable = findLinkedPayable(row, payables);

        return (
          <div className="da-drop-mini-trace">
            <Badge tone={lot ? "success" : "warning"}>{lot ? "Lot" : "Lot?"}</Badge>
            <Badge tone={payable ? "warning" : "success"}>{payable ? "Hutang" : "Lunas"}</Badge>
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge tone={getStatusTone(row.payment_status || row.status)}>
          {safeText(row.payment_status || row.status)}
        </Badge>
      ),
    },
    {
      key: "action",
      label: "Aksi",
      render: (row) => (
        <button type="button" className="da-drop-table-action" onClick={() => onSelect(row)}>
          Detail
        </button>
      ),
    },
  ];
}

export default function DropAyamPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  const mapped = useMemo(() => mapBootstrap(bootstrap), [bootstrap]);
  const { purchases, lots, payables, suppliers, wallets } = mapped;
  const summary = useMemo(() => buildSummary({ purchases, lots, payables }), [purchases, lots, payables]);
  const preview = useMemo(() => buildDropPreview(form, suppliers, wallets), [form, suppliers, wallets]);
  const formErrors = useMemo(() => validateDropForm(form, preview), [form, preview]);

  async function loadData() {
    setLoading(true);
    setError("");

    const result = await getDropAyamBootstrap(session?.sessionToken, {
      source: "frontend_part_6d_drop_ayam_merchant_form_polish",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal membaca data DROP Ayam.");
      setLoading(false);
      return;
    }

    setBootstrap(result.data || {});
    setNeedsRefresh(false);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionToken]);

  function updateField(field, value) {
    setSubmitResult(null);
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handlePreview() {
    setSubmitResult(null);

    if (formErrors.length > 0) {
      setSubmitResult({
        success: false,
        message: formErrors.join(" "),
      });
      return;
    }

    setConfirmOpen(true);
  }

  async function handleLiveSubmit() {
    if (formErrors.length > 0) {
      setSubmitResult({
        success: false,
        message: formErrors.join(" "),
      });
      return;
    }

    setSubmitting(true);

    const result = await createDropAyam(
      session?.sessionToken,
      buildLivePayload({ preview, session })
    );

    setSubmitting(false);

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setSubmitResult({
        success: false,
        message: result.message || "Gagal menyimpan DROP Ayam.",
      });
      return;
    }

    setSubmitResult({
      success: true,
      message: result.message || "DROP Ayam berhasil disimpan.",
    });
    setConfirmOpen(false);
    setForm(initialForm);
    setNeedsRefresh(true);
  }

  const columns = useMemo(
    () => buildColumns({ lots, payables, onSelect: setSelectedDrop }),
    [lots, payables]
  );

  return (
    <div className="da-page da-drop-page">
      <PageHeader
        title="DROP Ayam"
        description="Catatan ayam masuk dari supplier. Harga ayam dikunci per nota/drop agar transaksi lama tidak berubah saat harga baru berubah."
        badge="Live Trace"
        badgeTone="warning"
      />

      <ProductionFlowPanel
        session={session}
        onSessionExpired={onSessionExpired}
        compact
      />

      <Card className="da-drop-hero">
        <div>
          <div className="da-page-kicker">NYAWA PRODUKSI</div>
          <h2>DROP Ayam → Lot Harga Aktual → Hutang Nana</h2>
          <p>
            Satu nota ayam harus membuat rantai ID: DROP, lot, gerak stok, hutang, dan arsip.
          </p>

          <div className="da-drop-hero-actions">
            <Badge tone={error ? "danger" : loading ? "warning" : "success"}>
              {loading ? "Membaca..." : error ? "Perlu Cek" : "Terhubung"}
            </Badge>
            <Button variant="ghost" onClick={loadData}>
              Refresh Data
            </Button>
          </div>

          {error ? <div className="da-drop-error">{error}</div> : null}
        </div>

        <div className="da-drop-hero-note">
          <Badge tone="warning">Read Only + Input Terkontrol</Badge>
          <strong>{summary.totalDrop} nota bersih terbaca.</strong>
          <span>Baris kosong/formatting disembunyikan supaya tidak jadi angka yatim.</span>
        </div>
      </Card>

      <div className="da-grid da-grid-3 da-drop-stat-grid">
        <StatCard
          label="Total Modal Ayam"
          value={loading ? "..." : formatRupiah(summary.totalModalAyam)}
          description="Total nilai DROP Ayam bersih yang terbaca."
        />
        <StatCard
          label="Kg Ayam Masuk"
          value={loading ? "..." : `${summary.totalKgMasuk.toLocaleString("id-ID")} kg`}
          description="Total kg ayam dari nota/drop bersih."
        />
        <StatCard
          tone={summary.totalSisaHutang > 0 ? "warning" : "success"}
          label="Sisa Hutang Nana"
          value={loading ? "..." : formatRupiah(summary.totalSisaHutang)}
          description="Sisa hutang supplier ayam yang terbaca."
        />
        <StatCard
          label="Jumlah DROP"
          value={loading ? "..." : summary.totalDrop}
          description="Jumlah nota/drop ayam bersih."
        />
        <StatCard
          label="Lot Ayam Aktif"
          value={loading ? "..." : summary.totalLot}
          description="Lot harga aktual ayam yang siap dipakai produksi."
        />
        <StatCard
          label="Sisa Kg Ayam"
          value={loading ? "..." : `${summary.totalKgSisa.toLocaleString("id-ID")} kg`}
          description="Sisa kg ayam dari lot aktif."
        />
      </div>

      <div className="da-drop-layout">
        <Card className="da-drop-form-card">
          <div className="da-section-heading da-drop-section-heading">
            <div>
              <div className="da-page-kicker">FORM DROP AYAM</div>
              <h2>Input Nota Ayam</h2>
              <p>
                Harga/kg akan dikunci sebagai modal ayam aktual. Simpan hanya setelah nota benar.
              </p>
            </div>
            <Badge tone="warning">Live Transaction</Badge>
          </div>

          <div className="da-drop-form-grid">
            <div className="da-drop-form-fields">
              <Field label="Tanggal DROP">
                <input
                  type="date"
                  value={form.drop_date}
                  onChange={(event) => updateField("drop_date", event.target.value)}
                />
              </Field>

              <Field label="Supplier">
                <select
                  value={form.supplier_id}
                  onChange={(event) => updateField("supplier_id", event.target.value)}
                >
                  <option value="">Pilih supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id || supplier.name} value={supplier.id}>
                      {supplier.name || supplier.id}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="No Nota Supplier" hint="Contoh: NANA-2026-001">
                <input
                  value={form.invoice_no}
                  onChange={(event) => updateField("invoice_no", event.target.value)}
                  placeholder="Contoh: NANA-2026-001"
                />
              </Field>

              <Field label="Kg Ayam" hint="Contoh: 1020">
                <input
                  value={form.qty_kg}
                  onChange={(event) => updateField("qty_kg", event.target.value)}
                  placeholder="Contoh: 1020"
                  inputMode="decimal"
                />
              </Field>

              <Field label="Harga / Kg Aktual" hint="Masukkan harga aktual per kg">
                <input
                  value={form.unit_cost}
                  onChange={(event) => updateField("unit_cost", event.target.value)}
                  placeholder="Harga aktual per kg"
                  inputMode="decimal"
                />
              </Field>

              <Field label="Bayar Saat DROP">
                <input
                  value={form.amount_paid}
                  onChange={(event) => updateField("amount_paid", event.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                />
              </Field>

              <Field label="Dompet Pembayaran">
                <select
                  value={form.payment_wallet_id}
                  onChange={(event) => updateField("payment_wallet_id", event.target.value)}
                >
                  <option value="">Pilih kalau ada pembayaran</option>
                  {wallets.map((wallet) => (
                    <option key={wallet.id || wallet.name} value={wallet.id}>
                      {wallet.name || wallet.id}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Catatan">
                <textarea
                  value={form.note}
                  onChange={(event) => updateField("note", event.target.value)}
                  placeholder="Contoh: turun ayam pagi / titip nota"
                />
              </Field>
            </div>

            <PreviewPanel preview={preview} />
          </div>

          {submitResult ? (
            <div className={`da-drop-submit-result ${submitResult.success ? "success" : "danger"}`}>
              {submitResult.message}
              {submitResult.success && needsRefresh ? (
                <div style={{ marginTop: 6, fontWeight: 700 }}>
                  Data sudah tersimpan cepat. Klik Refresh Data kalau mau tarik ulang DROP, lot ayam, dan hutang terbaru.
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="da-drop-form-actions">
            <Button variant="ghost" onClick={() => setForm(initialForm)}>
              Reset Form
            </Button>
            <Button type="button" onClick={handlePreview}>
              Preview & Konfirmasi
            </Button>
          </div>
        </Card>
      </div>

      <Card className="da-drop-list-card">
        <div className="da-section-heading da-drop-section-heading">
          <div>
            <div className="da-page-kicker">DAFTAR DROP AYAM</div>
            <h2>Nota Ayam yang Terbaca</h2>
            <p>
              Klik detail untuk melihat rantai: DROP, lot, hutang, stok, modal, dan ID terkait.
            </p>
          </div>
          <Badge tone="success">Live Data</Badge>
        </div>

        <DataTable
          columns={columns}
          rows={purchases}
          getRowKey={(row, index) => getPurchaseId(row) || index}
        />
      </Card>

      <Modal
        open={confirmOpen}
        title="Konfirmasi DROP Ayam"
        subtitle="Cek ulang sebelum disimpan live."
        onClose={() => setConfirmOpen(false)}
      >
        <div className="da-drop-confirm">
          <PreviewPanel preview={preview} />

          <div className="da-drop-confirm-list">
            <SummaryPill label="Tanggal" value={formatDisplayDate(preview.drop_date)} />
            <SummaryPill label="Supplier" value={safeText(preview.supplier_name)} />
            <SummaryPill label="No Nota" value={safeText(preview.invoice_no)} />
            <SummaryPill label="Dompet Bayar" value={safeText(preview.payment_wallet_name, preview.amount_paid > 0 ? "Belum dipilih" : "-")} />
          </div>

          <div className="da-drop-note">
            Setelah disimpan, backend membuat DROP Ayam, Lot Harga Aktual, stok ayam masuk, hutang Nana jika belum lunas, mutasi dompet jika ada pembayaran, arsip, dan audit.
          </div>

          {submitResult && !submitResult.success ? (
            <div className="da-drop-submit-result danger">{submitResult.message}</div>
          ) : null}

          <div className="da-drop-form-actions">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Koreksi Lagi
            </Button>
            <Button type="button" onClick={handleLiveSubmit} disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan Live DROP Ayam"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(selectedDrop)}
        title={selectedDrop ? "Detail DROP Ayam" : ""}
        subtitle={selectedDrop ? getPurchaseId(selectedDrop) : ""}
        onClose={() => setSelectedDrop(null)}
      >
        {selectedDrop ? (
          <DropDetailModal
            selectedDrop={selectedDrop}
            linkedLot={findLinkedLot(selectedDrop, lots)}
            linkedPayable={findLinkedPayable(selectedDrop, payables)}
          />
        ) : null}
      </Modal>
    </div>
  );
}
