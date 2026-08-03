import { useEffect, useMemo, useState } from "react";
import { createOrder, getOrderBootstrap, resolveOrderItemPrice } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";
import SalesFlowPanel from "./SalesFlowPanel";
import { suggestedPaymentMethod } from "../../lib/finance/walletPolicy.js";

const initialForm = {
  order_date: new Date().toISOString().slice(0, 10),
  customer_id: "",
  customer_name: "UMUM",
  product_id: "",
  qty: "",
  unit_price: "",
  price_rule_id: "",
  price_name: "",
  price_tier: "",
  price_date: "",
  price_source: "",
  paid_amount: "0",
  wallet_id: "",
  payment_method: "",
  notes: "",
};

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

function generateRequestId(session) {
  const location =
    session?.user?.location_code ||
    session?.user?.location_id ||
    "LOC";
  return `ORDER-${location}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
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

function normalizeProduct(row) {
  const id =
    row.product_id ||
    row.item_id ||
    row.sku_id ||
    row.id ||
    row.product_code ||
    row.code ||
    "";

  const code = row.product_code || row.sku || row.code || row.item_code || id || "";
  const name = row.product_name || row.item_name || row.name || row.nama_produk || code || "";

  // Selling price is never read from the product master on the Order page.

  const stockPcs = numberValue(
    row.stock_pcs || row.free_pcs || row.available_pcs || row.ready_pcs || row.qty_pcs || row.stock || 0
  );

  return {
    id: String(id || "").trim(),
    code: String(code || "").trim(),
    name: String(name || "").trim(),
    category: row.category || row.product_category || row.type || "",
    unit: row.default_unit || row.unit || "pcs",
    price_per_pcs: 0,
    stock_pcs: stockPcs,
    avg_unit_cost: numberValue(row.avg_unit_cost || row.unit_cost || row.hpp_per_pcs || 0),
    status: row.status || row.stock_status || "AKTIF",
    raw: row,
  };
}

function normalizeCustomer(row) {
  return {
    id: row.customer_id || row.id || "",
    name: row.customer_name || row.name || row.nama || "",
    phone: row.phone || row.no_hp || "",
    type: row.customer_type || row.customer_tier || row.type || "",
    raw: row,
  };
}

function normalizeWallet(row) {
  const id = row.wallet_id || row.id || row.code || "";
  const name = row.wallet_name || row.name || row.account_name || row.nama_dompet || id || "";
  const code = row.wallet_code || row.code || row.bank_name || row.type || name || "";

  return {
    id,
    name,
    code,
    location_id: row.location_id || "",
    raw: row,
  };
}

function normalizeOrder(row) {
  return {
    ...row,
    order_id: row.order_id || row.order_no || row.id || "",
    customer_name: row.customer_name || row.name || "UMUM",
    order_date: row.order_date || row.date || row.created_at || "",
    grand_total: numberValue(row.grand_total || row.total_amount || row.amount || 0),
    paid_amount: numberValue(row.paid_amount || row.amount_paid || 0),
    remaining_amount: numberValue(row.remaining_amount || row.sisa_tagihan || 0),
    payment_status: row.payment_status || row.status_bayar || row.status || "Tercatat",
    fulfillment_status: row.fulfillment_status || row.order_status || row.status || "Tercatat",
  };
}

function getStatusTone(status) {
  const value = String(status || "").toUpperCase();

  if (value.includes("LUNAS") || value.includes("PAID") || value.includes("ACTIVE")) return "success";
  if (value.includes("VOID") || value.includes("BATAL") || value.includes("CANCEL")) return "danger";
  if (value.includes("PIUTANG") || value.includes("BELUM") || value.includes("PARTIAL") || value.includes("DP")) return "warning";

  return "warning";
}

function buildSummary(data) {
  const summary = data?.summary || {};
  return {
    today_order_count: numberValue(summary.today_order_count),
    order_count: numberValue(summary.order_count),
    uang_masuk_actual: numberValue(summary.uang_masuk_actual),
    piutang_open: numberValue(summary.piutang_open),
    stock_ready_pcs: numberValue(summary.stock_ready_pcs),
    product_ready_count: numberValue(summary.product_ready_count),
  };
}

function buildCartTotals(cart, paidAmount) {
  const subtotal = cart.reduce((total, item) => total + numberValue(item.line_total), 0);
  const paid = Math.max(0, Math.min(numberValue(paidAmount), subtotal));
  const remaining = Math.max(subtotal - paid, 0);

  let paymentStatus = "Belum Bayar";
  if (subtotal > 0 && paid >= subtotal) paymentStatus = "Lunas";
  else if (paid > 0 && paid < subtotal) paymentStatus = "DP / Sebagian";
  else if (remaining > 0) paymentStatus = "Belum Bayar / Piutang";

  return {
    subtotal,
    grand_total: subtotal,
    paid_amount: paid,
    remaining_amount: remaining,
    payment_status: paymentStatus,
  };
}

function buildOrderPayload({ form, cart, totals, session, requestId }) {
  const operationId = requestId || generateRequestId(session);
  const customerName = safeText(form.customer_name, "UMUM");
  const locationId = session?.user?.location_id || session?.user?.location_code || "";
  const paymentMethod = form.payment_method || "";

  const items = cart.map((item) => ({
    product_id: item.product_id,
    product_code: item.product_code,
    product_name: item.product_name,
    name: item.product_name,
    qty: item.qty,
    quantity: item.qty,
    qty_pcs: item.qty,
    unit: "pcs",
    unit_price: item.unit_price,
    price_per_unit: item.unit_price,
    price: item.unit_price,
    line_total: item.line_total,
    unit_type: "PCS",
    price_rule_id: item.price_rule_id,
    price_name: item.price_name,
    price_tier: item.price_tier,
    price_source: item.price_source,
    price_date: item.price_date,
    pricing_snapshot: item.pricing_snapshot || null,
    stock_pcs_snapshot: item.stock_pcs,
  }));

  const order = {
    location_id: locationId,
    location_code: session?.user?.location_code || locationId,
    order_date: form.order_date,
    date: form.order_date,
    order_type: "KASIR_READY",
    order_mode: "DIRECT",
    sales_channel: "Kasir / Offline",
    customer_id: form.customer_id,
    customer_name: customerName,
    subtotal: totals.subtotal,
    grand_total: totals.grand_total,
    total_amount: totals.grand_total,
    paid_amount: totals.paid_amount,
    amount_paid: totals.paid_amount,
    remaining_amount: totals.remaining_amount,
    sisa_tagihan: totals.remaining_amount,
    payment_status: totals.payment_status,
    wallet_id: form.wallet_id,
    payment_method: paymentMethod,
    fulfill_now: true,
    notes: form.notes,
    request_id: operationId,
    operation_id: operationId,
    client_request_id: operationId,
    idempotency_key: operationId,
  };

  return {
    request_id: operationId,
    operation_id: operationId,
    client_request_id: operationId,
    idempotency_key: operationId,
    source: "frontend_part_2f_tangerang_real_go_live",
    location_id: locationId,
    order_date: form.order_date,
    customer_id: form.customer_id,
    customer_name: customerName,
    grand_total: totals.grand_total,
    paid_amount: totals.paid_amount,
    remaining_amount: totals.remaining_amount,
    payment_status: totals.payment_status,
    wallet_id: form.wallet_id,
    payment_method: paymentMethod,
    fulfill_now: true,
    order,
    items,
    payment_breakdown:
      totals.paid_amount > 0
        ? [
            {
              method: paymentMethod || "CASH",
              payment_method: paymentMethod,
              wallet_id: form.wallet_id,
              amount: totals.paid_amount,
              request_id: operationId,
            },
          ]
        : [],
  };
}

function PayloadRow({ label, value }) {
  return (
    <div className="da-payload-row">
      <span>{label}</span>
      <strong>{safeText(value)}</strong>
    </div>
  );
}

export default function OrderPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [cart, setCart] = useState([]);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [requestId, setRequestId] = useState(() => generateRequestId(session));
  const [priceResolving, setPriceResolving] = useState(false);
  const [pricePreview, setPricePreview] = useState(null);

  const products = useMemo(() => {
    return asArray(bootstrap?.products).map(normalizeProduct).filter((item) => item.id);
  }, [bootstrap]);

  const customers = useMemo(() => {
    return asArray(bootstrap?.customers).map(normalizeCustomer).filter((item) => item.id || item.name);
  }, [bootstrap]);

  const wallets = useMemo(() => {
    return asArray(bootstrap?.wallets).map(normalizeWallet).filter((item) => item.id || item.name);
  }, [bootstrap]);

  const orders = useMemo(() => {
    return asArray(bootstrap?.orders).map(normalizeOrder);
  }, [bootstrap]);

  const summary = useMemo(() => buildSummary(bootstrap), [bootstrap]);
  const pricingLock = bootstrap?.pricing_lock || {};
  const pricingLockReady = pricingLock?.ready === true;
  const pricingRulesActive = numberValue(pricingLock?.pricing_rules_active);
  const cutoverPriceReady = pricingRulesActive > 0;
  const cutoverStockReady =
    numberValue(summary.stock_ready_pcs) > 0 &&
    numberValue(summary.product_ready_count) > 0;
  const controlledLiveReady =
    pricingLockReady && cutoverPriceReady && cutoverStockReady;
  const firstRealOrderReady =
    controlledLiveReady && numberValue(summary.order_count) === 0;
  const cutoverBlockers = [
    !pricingLockReady ? "Server Price Lock belum siap." : "",
    !cutoverPriceReady ? "Belum ada harga resmi aktif untuk Kasir." : "",
    !cutoverStockReady ? "Belum ada stok bebas produk jadi." : "",
  ].filter(Boolean);
  const totals = useMemo(() => buildCartTotals(cart, form.paid_amount), [cart, form.paid_amount]);
  const livePayload = useMemo(() => buildOrderPayload({ form, cart, totals, session, requestId }), [form, cart, totals, session, requestId]);

  const selectedProduct = products.find((item) => item.id === form.product_id);

  const validationErrors = useMemo(() => {
    const errors = [];
    if (!pricingLockReady) errors.push("Server Price Lock belum siap. Jalankan migration 015 dan refresh data.");
    if (!cutoverPriceReady) errors.push("Belum ada harga resmi aktif. Kasir masih diblokir.");
    if (!cutoverStockReady) errors.push("Belum ada stok bebas produk jadi untuk dijual.");
    if (!form.order_date) errors.push("Tanggal order wajib diisi.");
    if (!form.customer_id && !String(form.customer_name || "").trim()) errors.push("Nama customer wajib diisi.");
    if (cart.length === 0) errors.push("Keranjang masih kosong.");
    if (totals.grand_total <= 0) errors.push("Total order harus lebih dari Rp0.");
    if (totals.paid_amount > totals.grand_total) errors.push("Uang dibayar tidak boleh lebih besar dari total tagihan.");
    if (totals.paid_amount > 0 && !form.wallet_id) errors.push("Dompet penerimaan wajib dipilih kalau ada uang masuk.");
    if (totals.paid_amount > 0 && !form.payment_method) errors.push("Metode pembayaran wajib mengikuti dompet yang dipilih.");

    const qtyByProduct = {};
    const stockByProduct = {};

    cart.forEach((item, index) => {
      const qty = numberValue(item.qty);
      const unitPrice = numberValue(item.unit_price);
      const productKey = item.product_id || item.product_code || item.product_name || `item-${index}`;

      if (qty <= 0) errors.push(`Qty item ke-${index + 1} harus lebih dari 0.`);
      if (unitPrice <= 0) errors.push(`Harga sistem item ke-${index + 1} belum valid.`);
      if (!String(item.price_rule_id || "").trim()) errors.push(`Rule harga item ke-${index + 1} belum terkunci.`);
      if (String(item.price_source || "") !== "PHP_MYSQL_PRICING") errors.push(`Sumber harga item ke-${index + 1} bukan PHP/MySQL Pricing Engine.`);

      qtyByProduct[productKey] = (qtyByProduct[productKey] || 0) + qty;
      stockByProduct[productKey] = Math.max(stockByProduct[productKey] || 0, numberValue(item.stock_pcs));
    });

    Object.keys(qtyByProduct).forEach((productKey) => {
      const stock = stockByProduct[productKey] || 0;
      if (stock > 0 && qtyByProduct[productKey] > stock) {
        const productName = cart.find((item) => (item.product_id || item.product_code || item.product_name) === productKey)?.product_name || productKey;
        errors.push(`Total qty ${productName} melebihi stok ready.`);
      }
    });

    return errors;
  }, [
    form,
    cart,
    totals,
    pricingLockReady,
    cutoverPriceReady,
    cutoverStockReady,
  ]);


  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getOrderBootstrap(session?.sessionToken, {
      source: "frontend_part_2f_tangerang_real_go_live",
      location_id:
        session?.user?.location_id ||
        "",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal membaca data Kasir / Order.");
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

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleOrderDateChange = (value) => {
    if (cart.length > 0) {
      setSubmitResult({
        success: false,
        message: "Kosongkan keranjang sebelum mengganti tanggal order agar snapshot harga tidak stale.",
      });
      return;
    }

    setForm((current) => ({
      ...current,
      order_date: value,
      unit_price: "",
      price_rule_id: "",
      price_name: "",
      price_tier: "",
      price_date: "",
      price_source: "",
    }));
    setPricePreview(null);
  };

  const handleCustomerChange = (value) => {
    if (cart.length > 0) {
      setSubmitResult({
        success: false,
        message: "Kosongkan keranjang sebelum mengganti customer agar tier harga di-resolve ulang.",
      });
      return;
    }

    const customer = customers.find((item) => item.id === value);
    setForm((current) => ({
      ...current,
      customer_id: value,
      customer_name: customer ? customer.name : current.customer_name,
      unit_price: "",
      price_rule_id: "",
      price_name: "",
      price_tier: "",
      price_date: "",
      price_source: "",
    }));
    setPricePreview(null);
  };

  const handleCustomerNameChange = (value) => {
    if (cart.length > 0) {
      setSubmitResult({
        success: false,
        message: "Kosongkan keranjang sebelum mengganti customer.",
      });
      return;
    }

    updateForm("customer_name", value);
  };

  const handleProductChange = (value) => {
    setForm((current) => ({
      ...current,
      product_id: value,
      qty: current.qty || "1",
      unit_price: "",
      price_rule_id: "",
      price_name: "",
      price_tier: "",
      price_date: "",
      price_source: "",
    }));
    setPricePreview(null);
    setSubmitResult(null);
  };

  const handleQtyChange = (value) => {
    setForm((current) => ({
      ...current,
      qty: value,
      unit_price: "",
      price_rule_id: "",
      price_name: "",
      price_tier: "",
      price_date: "",
      price_source: "",
    }));
    setPricePreview(null);
  };

  const handleWalletChange = (value) => {
    const wallet = wallets.find((item) => item.id === value);

    setForm((current) => ({
      ...current,
      wallet_id: value,
      payment_method: wallet ? suggestedPaymentMethod(wallet.raw || wallet) : "",
    }));
  };

  const handleAddItem = async () => {
    if (priceResolving || submitting) return;

    setShowValidationErrors(false);
    setSubmitResult(null);

    const product = selectedProduct;
    const addQty = numberValue(form.qty);

    if (!pricingLockReady) {
      setSubmitResult({
        success: false,
        message: "Server Price Lock belum siap. Jalankan migration 015 lalu Refresh Data.",
      });
      return;
    }

    if (!cutoverPriceReady) {
      setSubmitResult({
        success: false,
        message: "Belum ada harga resmi aktif. Kasir tetap diblokir dan tidak membuat transaksi.",
      });
      return;
    }

    if (!cutoverStockReady) {
      setSubmitResult({
        success: false,
        message: "Belum ada stok bebas produk jadi. Kasir belum boleh live.",
      });
      return;
    }

    if (!product || addQty <= 0 || !form.order_date) {
      setSubmitResult({
        success: false,
        message: "Pilih produk, isi qty, dan pastikan tanggal order tersedia.",
      });
      return;
    }

    const existing = cart.find((item) => item.product_id === product.id);
    const existingQty = numberValue(existing?.qty);
    const targetQty = existingQty + addQty;

    if (product.stock_pcs > 0 && targetQty > product.stock_pcs) {
      setSubmitResult({
        success: false,
        message: `Qty melebihi stok ready. Stok ${product.name}: ${product.stock_pcs.toLocaleString("id-ID")} pcs, sudah di keranjang ${existingQty.toLocaleString("id-ID")} pcs.`,
      });
      return;
    }

    setPriceResolving(true);

    const result = await resolveOrderItemPrice(
      session?.sessionToken,
      {
        location_id:
          session?.user?.location_id ||
          "",
        product_id: product.id,
        customer_id: form.customer_id,
        qty: targetQty,
        unit_type: "PCS",
        channel_code: "POS",
        price_date: form.order_date,
      }
    );

    setPriceResolving(false);

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setPricePreview(null);
      setSubmitResult({
        success: false,
        message: result.message || "Gagal meminta harga dari Pricing Engine.",
      });
      return;
    }

    const resolved = result.data || {};
    setPricePreview(resolved);

    if (!resolved.resolved || numberValue(resolved.price_per_unit) <= 0) {
      setSubmitResult({
        success: false,
        message:
          resolved.message ||
          "Belum ada aturan harga aktif yang cocok. Keranjang tidak diubah.",
      });
      return;
    }

    const unitPrice = numberValue(resolved.price_per_unit);
    const lineTotal = targetQty * unitPrice;
    const cartId = existing?.cart_id || `${product.id}-${Date.now()}`;

    setCart((current) => {
      const nextItem = {
        cart_id: cartId,
        cart_key: product.id,
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        qty: targetQty,
        unit_price: unitPrice,
        line_total: lineTotal,
        stock_pcs: product.stock_pcs,
        price_rule_id: resolved.price_rule_id || "",
        price_name: resolved.price_name || "",
        price_tier:
          resolved.matched_tier ||
          resolved.price_tier ||
          "NORMAL",
        price_source: "PHP_MYSQL_PRICING",
        price_date: resolved.price_date || form.order_date,
        pricing_snapshot: resolved,
      };

      if (existing) {
        return current.map((item) =>
          item.product_id === product.id ? nextItem : item
        );
      }

      return [...current, nextItem];
    });

    setForm((current) => ({
      ...current,
      product_id: "",
      qty: "",
      unit_price: "",
      price_rule_id: "",
      price_name: "",
      price_tier: "",
      price_date: "",
      price_source: "",
    }));
    setPricePreview(null);
    setSubmitResult({
      success: true,
      message: "Harga berhasil dikunci dari PHP/MySQL dan item masuk keranjang.",
    });
  };


  const handleRemoveItem = (cartId) => {
    setCart((current) => current.filter((item) => item.cart_id !== cartId));
  };

  const handlePreviewSubmit = (event) => {
    event.preventDefault();
    setShowValidationErrors(true);
    setSubmitResult(null);

    if (validationErrors.length > 0) return;
    setConfirmOpen(true);
  };

  const handleResetForm = () => {
    setForm(initialForm);
    setCart([]);
    setShowValidationErrors(false);
    setConfirmOpen(false);
    setSubmitResult(null);
    setPricePreview(null);
    setPriceResolving(false);
    setRequestId(generateRequestId(session));
  };

  const handleLiveSubmit = async () => {
    if (submitting || validationErrors.length > 0) return;

    setSubmitting(true);
    setSubmitResult(null);

    const result = await createOrder(session?.sessionToken, livePayload);

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setSubmitResult({
        success: false,
        message: result.message || "Gagal menyimpan order.",
        data: result.data || null,
      });
      setSubmitting(false);
      return;
    }

    setSubmitResult({
      success: true,
      message: result.message || "Order berhasil disimpan.",
      data: result.data || null,
    });

    setConfirmOpen(false);
    setSubmitting(false);
    setForm(initialForm);
    setCart([]);
    setShowValidationErrors(false);
    setRequestId(generateRequestId(session));
    setNeedsRefresh(true);
  };

  const cartColumns = [
    {
      key: "product_name",
      label: "Produk",
      render: (row) => <strong>{row.product_name}</strong>,
    },
    {
      key: "qty",
      label: "Qty",
      render: (row) => `${numberValue(row.qty).toLocaleString("id-ID")} pcs`,
    },
    {
      key: "unit_price",
      label: "Harga / Pcs",
      render: (row) => formatRupiah(row.unit_price),
    },
    {
      key: "price_rule_id",
      label: "Rule Harga",
      render: (row) => (
        <div>
          <strong>{safeText(row.price_name, "Pricing Engine")}</strong>
          <div className="da-muted">{safeText(row.price_rule_id)}</div>
        </div>
      ),
    },
    {
      key: "line_total",
      label: "Total",
      render: (row) => formatRupiah(row.line_total),
    },
    {
      key: "action",
      label: "Aksi",
      render: (row) => (
        <Button variant="ghost" onClick={() => handleRemoveItem(row.cart_id)} disabled={submitting}>
          Hapus
        </Button>
      ),
    },
  ];

  const orderColumns = [
    {
      key: "order_date",
      label: "Tanggal",
      render: (row) => formatDisplayDate(row.order_date),
    },
    {
      key: "order_id",
      label: "Order ID",
      render: (row) => <strong>{safeText(row.order_id)}</strong>,
    },
    {
      key: "customer_name",
      label: "Customer",
      render: (row) => safeText(row.customer_name),
    },
    {
      key: "grand_total",
      label: "Tagihan",
      render: (row) => formatRupiah(row.grand_total),
    },
    {
      key: "paid_amount",
      label: "Dibayar",
      render: (row) => formatRupiah(row.paid_amount),
    },
    {
      key: "payment_status",
      label: "Status Bayar",
      render: (row) => <Badge tone={getStatusTone(row.payment_status)}>{safeText(row.payment_status)}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Kasir / Order"
        description="Kasir Tangerang untuk transaksi nyata: harga resmi dikunci backend dan stok keluar memakai HPP historis."
        badge={controlledLiveReady ? "Tangerang Live" : "Server Price Lock"}
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Penjualan</div>
          <div className="da-dashboard-banner-title">Stok Jadi → Order → Invoice → Uang Masuk</div>
          <div className="da-dashboard-banner-desc">
            Halaman ini khusus jual stok ready. Harga manual diblokir: frontend hanya menampilkan preview, sedangkan backend resolve ulang rule resmi sebelum membuat Order, Invoice, Payment/Piutang, dan stok keluar.
          </div>
        </div>

        <div className="da-dashboard-banner-actions">
          <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Dicek" : "Terhubung"}</Badge>
          <Badge tone={pricingLockReady ? "success" : "danger"}>
            {pricingLockReady ? "Price Lock Ready" : "Price Lock Belum Siap"}
          </Badge>
          <Badge tone={pricingRulesActive > 0 ? "success" : "warning"}>
            {pricingRulesActive} Rule Aktif
          </Badge>
          <Badge tone={controlledLiveReady ? "success" : "warning"}>
            {controlledLiveReady ? "Kasir Siap Live" : "Kasir Diblokir"}
          </Badge>
          <Button variant="ghost" onClick={loadData} disabled={loading || submitting || priceResolving}>
            {loading ? "Membaca..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="da-login-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      {!controlledLiveReady && !loading ? (
        <div className="da-form-warning" style={{ marginBottom: 16 }}>
          <strong>Controlled Go-Live Gate masih menahan Kasir.</strong>
          {cutoverBlockers.map((item) => (
            <div key={item} style={{ marginTop: 4 }}>• {item}</div>
          ))}
          <div style={{ marginTop: 8 }}>
            Tidak ada harga fallback dan tidak ada transaksi yang dibuat selama gate belum siap.
          </div>
        </div>
      ) : null}

      {firstRealOrderReady && !loading ? (
        <div className="da-form-success" style={{ marginBottom: 16 }}>
          <strong>Kasir Tangerang siap untuk transaksi pelanggan nyata pertama.</strong>
          <div style={{ marginTop: 6 }}>
            Pilih customer UMUM atau customer terdaftar, pilih produk dan qty,
            klik Kunci Harga & Tambah, lalu Preview & Konfirmasi. Backend tetap
            resolve ulang harga dan HPP sebelum transaksi disimpan.
          </div>
        </div>
      ) : null}

      {submitResult ? (
        <div
          className={submitResult.success ? "da-form-success" : "da-form-warning"}
          style={{ marginBottom: 16 }}
        >
          {submitResult.message}
          {submitResult.success && needsRefresh ? (
            <div style={{ marginTop: 6, fontWeight: 700 }}>
              Data sudah tersimpan cepat. Klik Refresh Data kalau mau tarik ulang stok/order terbaru.
            </div>
          ) : null}
        </div>
      ) : null}

      <SalesFlowPanel
        session={session}
        onSessionExpired={onSessionExpired}
        compact
        refreshKey={orders.length}
      />

      <div style={{ height: 16 }} />

      <div className="da-grid da-grid-3">
        <StatCard
          tone="primary"
          label="Order Hari Ini"
          value={loading ? "..." : summary.today_order_count}
          description="Transaksi order yang tercatat hari ini."
        />
        <StatCard
          label="Uang Masuk Aktual"
          value={loading ? "..." : formatRupiah(summary.uang_masuk_actual)}
          description="Hanya dari pembayaran yang benar-benar masuk."
        />
        <StatCard
          tone="warning"
          label="Piutang Terbuka"
          value={loading ? "..." : formatRupiah(summary.piutang_open)}
          description="Sisa tagihan customer yang belum lunas."
        />
      </div>

      <div style={{ height: 16 }} />

      <div className="da-grid da-grid-3">
        <StatCard
          label="Stok Ready"
          value={loading ? "..." : `${summary.stock_ready_pcs.toLocaleString("id-ID")} pcs`}
          description="Stok jadi bebas yang bisa dijual."
        />
        <StatCard
          label="Produk Ready"
          value={loading ? "..." : summary.product_ready_count}
          description="Produk dengan stok tersedia."
        />
        <StatCard
          label="Total Order"
          value={loading ? "..." : summary.order_count}
          description="Jumlah order aktif yang terbaca."
        />
      </div>

      <div style={{ height: 16 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Form Kasir</div>
            <div className="da-big-text">Input Order</div>
            <p className="da-muted">
              Pilih produk dan qty. Tombol keranjang akan meminta harga resmi ke PHP/MySQL. Tanpa rule aktif, item tidak dapat masuk dan tidak ada transaksi yang dibuat.
            </p>
          </div>
          <Badge tone="danger">Live + Anti Dobel</Badge>
        </div>

        <form onSubmit={handlePreviewSubmit}>
          <div className="da-drop-form-preview">
            <div className="da-drop-field">
              <label>Tanggal Order</label>
              <input
                type="date"
                className="da-input"
                value={form.order_date}
                onChange={(event) => handleOrderDateChange(event.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="da-drop-field">
              <label>Customer Terdaftar</label>
              <select
                className="da-select"
                value={form.customer_id}
                onChange={(event) => handleCustomerChange(event.target.value)}
                disabled={submitting || loading}
              >
                <option value="">Manual / UMUM</option>
                {customers.map((customer) => (
                  <option key={customer.id || customer.name} value={customer.id}>
                    {customer.name}{customer.type ? ` · ${customer.type}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="da-drop-field">
              <label>Nama Customer</label>
              <input
                className="da-input"
                value={form.customer_name}
                placeholder="Contoh: UMUM / Fajar / Lia"
                onChange={(event) => handleCustomerNameChange(event.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="da-drop-field">
              <label>Produk</label>
              <select
                className="da-select"
                value={form.product_id}
                onChange={(event) => handleProductChange(event.target.value)}
                disabled={submitting || loading}
              >
                <option value="">Pilih produk ready</option>
                {products.map((product) => (
                  <option key={product.id || product.code} value={product.id}>
                    {product.name} · stok {product.stock_pcs.toLocaleString("id-ID")} pcs
                  </option>
                ))}
              </select>
            </div>

            <div className="da-drop-field">
              <label>Qty Pcs</label>
              <input
                className="da-input"
                inputMode="decimal"
                value={form.qty}
                placeholder="Contoh: 50"
                onChange={(event) => handleQtyChange(event.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="da-drop-field">
              <label>Harga Sistem / Pcs</label>
              <input
                className="da-input"
                value={
                  form.unit_price
                    ? formatRupiah(form.unit_price)
                    : ""
                }
                placeholder="Diisi otomatis oleh Pricing Engine"
                readOnly
                disabled
              />
            </div>
          </div>

          {pricePreview && !pricePreview.resolved ? (
            <div className="da-form-warning" style={{ marginTop: 12 }}>
              {pricePreview.message || "Belum ada aturan harga yang cocok."}
            </div>
          ) : null}

          <div className="da-form-actions" style={{ justifyContent: "flex-start" }}>
            <Button
              type="button"
              variant="ghost"
              onClick={handleAddItem}
              disabled={
                submitting ||
                loading ||
                priceResolving ||
                !controlledLiveReady
              }
            >
              {priceResolving ? "Resolve Harga..." : "Kunci Harga & Tambah"}
            </Button>
            {selectedProduct ? (
              <span className="da-muted" style={{ alignSelf: "center" }}>
                Stok ready: <strong>{selectedProduct.stock_pcs.toLocaleString("id-ID")} pcs</strong>
              </span>
            ) : null}
          </div>

          <div style={{ height: 16 }} />

          <DataTable
            columns={cartColumns}
            rows={cart}
            getRowKey={(row) => row.cart_id}
          />

          <div style={{ height: 16 }} />

          <div className="da-drop-form-preview">
            <div className="da-drop-field">
              <label>Uang Dibayar Sekarang</label>
              <input
                className="da-input"
                inputMode="numeric"
                value={form.paid_amount}
                placeholder="0 kalau belum bayar"
                onChange={(event) => updateForm("paid_amount", event.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="da-drop-field">
              <label>Dompet / Metode Bayar</label>
              <select
                className="da-select"
                value={form.wallet_id}
                onChange={(event) => handleWalletChange(event.target.value)}
                disabled={submitting || numberValue(form.paid_amount) <= 0}
              >
                <option value="">Pilih dompet penerimaan</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id || wallet.name} value={wallet.id}>
                    {wallet.name}
                  </option>
                ))}
              </select>
              {form.wallet_id ? (
                <div className="da-muted" style={{ marginTop: 6 }}>
                  Metode otomatis: <strong>{form.payment_method}</strong>
                </div>
              ) : null}
            </div>

            <div className="da-drop-field">
              <label>Catatan</label>
              <input
                className="da-input"
                value={form.notes}
                placeholder="Contoh: ambil langsung / nota gantung"
                onChange={(event) => updateForm("notes", event.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="da-drop-preview-panel">
            <div>
              <div className="da-mini-title">Total Tagihan</div>
              <div className="da-big-text">{formatRupiah(totals.grand_total)}</div>
              <p className="da-muted">Dari {cart.length} item di keranjang.</p>
            </div>
            <div>
              <div className="da-mini-title">Uang Masuk</div>
              <div className="da-big-text">{formatRupiah(totals.paid_amount)}</div>
              <p className="da-muted">Yang benar-benar masuk dompet.</p>
            </div>
            <div>
              <div className="da-mini-title">Sisa Tagihan</div>
              <div className="da-big-text">{formatRupiah(totals.remaining_amount)}</div>
              <p className="da-muted">Status: <strong>{totals.payment_status}</strong></p>
            </div>
          </div>

          {showValidationErrors && validationErrors.length > 0 ? (
            <div className="da-form-warning">
              {validationErrors.map((item) => (
                <div key={item}>• {item}</div>
              ))}
            </div>
          ) : null}

          <div className="da-form-actions">
            <Button type="button" variant="ghost" onClick={handleResetForm} disabled={submitting}>
              Reset Form
            </Button>
            <Button type="submit" disabled={submitting || loading || priceResolving || !controlledLiveReady}>
              Preview & Konfirmasi
            </Button>
          </div>
        </form>
      </Card>

      <div style={{ height: 16 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Daftar Order</div>
            <div className="da-big-text">Order yang Terbaca</div>
            <p className="da-muted">Klik baris untuk lihat ringkasan transaksi.</p>
          </div>
          <Badge tone="warning">Live Data</Badge>
        </div>

        <DataTable
          columns={orderColumns}
          rows={loading ? [] : orders}
          getRowKey={(row, index) => row.order_id || index}
          onRowClick={setSelectedOrder}
        />
      </Card>

      <Modal
        open={confirmOpen}
        title="Konfirmasi Simpan Order"
        subtitle="Ini akan membuat transaksi hidup"
        onClose={() => {
          if (!submitting) setConfirmOpen(false);
        }}
      >
        <div className="da-modal-summary">
          <div>
            <div className="da-mini-title">Total Tagihan</div>
            <div className="da-big-text">{formatRupiah(totals.grand_total)}</div>
            <p className="da-muted">Customer: <strong>{safeText(form.customer_name, "UMUM")}</strong></p>
          </div>
          <Badge tone="danger">Live Submit</Badge>
        </div>

        <div className="da-detail-grid">
          <div className="da-detail-box">
            <div className="da-mini-title">Order</div>
            <p><strong>Tanggal:</strong> {formatDisplayDate(form.order_date)}</p>
            <p><strong>Customer:</strong> {safeText(form.customer_name, "UMUM")}</p>
            <p><strong>Item:</strong> {cart.length} item</p>
          </div>
          <div className="da-detail-box">
            <div className="da-mini-title">Pembayaran</div>
            <p><strong>Tagihan:</strong> {formatRupiah(totals.grand_total)}</p>
            <p><strong>Uang masuk:</strong> {formatRupiah(totals.paid_amount)}</p>
            <p><strong>Sisa:</strong> {formatRupiah(totals.remaining_amount)}</p>
            <p><strong>Status:</strong> {totals.payment_status}</p>
          </div>
          <div className="da-detail-box">
            <div className="da-mini-title">Yang Dibuat Backend</div>
            <p><strong>Resolve harga ulang:</strong> Wajib</p>
            <p><strong>Order & Invoice:</strong> Setelah harga cocok</p>
            <p><strong>Stok Keluar:</strong> Setelah transaksi valid</p>
            <p><strong>Uang Masuk / Piutang:</strong> Sesuai pembayaran</p>
          </div>
          <div className="da-detail-box">
            <div className="da-mini-title">4 Amplop</div>
            <p><strong>Sumber:</strong> Uang masuk aktual saja</p>
            <p><strong>Catatan:</strong> PO/piutang/stok tidak langsung masuk amplop.</p>
          </div>
        </div>

        <div className="da-payload-preview">
          <div className="da-mini-title">Payload Live</div>
          <PayloadRow label="Action" value="legacyCreateOrder · PHP/MySQL Server Price Lock" />
          <PayloadRow label="request_id" value={livePayload.request_id} />
          <PayloadRow label="customer_name" value={livePayload.order.customer_name} />
          <PayloadRow label="grand_total" value={formatRupiah(livePayload.order.grand_total)} />
          <PayloadRow label="paid_amount" value={formatRupiah(livePayload.order.paid_amount)} />
          <PayloadRow label="remaining_amount" value={formatRupiah(livePayload.order.remaining_amount)} />
          <PayloadRow label="items" value={`${livePayload.items.length} item`} />
        </div>

        <div className="da-modal-note" style={{ marginTop: 14 }}>
          Saat tombol simpan ditekan, backend tidak mempercayai harga di payload. Setiap item di-resolve ulang berdasarkan produk, lokasi, customer, qty, unit PCS, channel POS, dan tanggal order. Rule berubah atau tidak tersedia akan membatalkan seluruh transaksi.
        </div>

        {submitResult && !submitResult.success ? (
          <div className="da-form-warning" style={{ marginTop: 14 }}>{submitResult.message}</div>
        ) : null}

        <div className="da-form-actions">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>
            Koreksi Lagi
          </Button>
          <Button type="button" onClick={handleLiveSubmit} disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan Live Order"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(selectedOrder)}
        title="Detail Order"
        subtitle={selectedOrder?.order_id || ""}
        onClose={() => setSelectedOrder(null)}
      >
        {selectedOrder ? (
          <div>
            <div className="da-modal-summary">
              <div>
                <div className="da-mini-title">Total Tagihan</div>
                <div className="da-big-text">{formatRupiah(selectedOrder.grand_total)}</div>
                <p className="da-muted">Customer: <strong>{safeText(selectedOrder.customer_name)}</strong></p>
              </div>
              <Badge tone={getStatusTone(selectedOrder.payment_status)}>{safeText(selectedOrder.payment_status)}</Badge>
            </div>

            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-mini-title">Order</div>
                <p><strong>ID:</strong> {safeText(selectedOrder.order_id)}</p>
                <p><strong>Tanggal:</strong> {formatDisplayDate(selectedOrder.order_date)}</p>
                <p><strong>Status barang:</strong> {safeText(selectedOrder.fulfillment_status)}</p>
              </div>
              <div className="da-detail-box">
                <div className="da-mini-title">Pembayaran</div>
                <p><strong>Dibayar:</strong> {formatRupiah(selectedOrder.paid_amount)}</p>
                <p><strong>Sisa:</strong> {formatRupiah(selectedOrder.remaining_amount)}</p>
                <p><strong>Status:</strong> {safeText(selectedOrder.payment_status)}</p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
