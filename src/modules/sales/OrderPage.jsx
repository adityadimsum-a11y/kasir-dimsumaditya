import { useEffect, useMemo, useState } from "react";
import { createOrder, getOrderBootstrap } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";

const initialForm = {
  order_date: new Date().toISOString().slice(0, 10),
  customer_id: "",
  customer_name: "UMUM",
  product_id: "",
  qty: "",
  unit_price: "",
  paid_amount: "0",
  payment_method: "CASH",
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

  const pricePerPcs = numberValue(
    row.price_per_pcs ||
      row.harga_pcs ||
      row.harga_per_pcs ||
      row.price_pcs ||
      row.normal_price_pcs ||
      row.selling_price_pcs ||
      row.unit_price ||
      row.price ||
      row.selling_price ||
      row.harga_jual ||
      0
  );

  const stockPcs = numberValue(
    row.stock_pcs || row.free_pcs || row.available_pcs || row.ready_pcs || row.qty_pcs || row.stock || 0
  );

  return {
    id: String(id || "").trim(),
    code: String(code || "").trim(),
    name: String(name || "").trim(),
    category: row.category || row.product_category || row.type || "",
    unit: row.default_unit || row.unit || "pcs",
    price_per_pcs: pricePerPcs,
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
  const paymentMethod = form.payment_method || (totals.paid_amount > 0 ? "CASH" : "");

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
    price: item.unit_price,
    line_total: item.line_total,
    stock_pcs_snapshot: item.stock_pcs,
  }));

  const order = {
    location_id: locationId,
    location_code: session?.user?.location_code || locationId,
    order_date: form.order_date,
    date: form.order_date,
    order_type: "KASIR_READY",
    order_mode: "JUAL_STOK_READY",
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
    payment_method: paymentMethod,
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
    source: "frontend_part_4p_kasir_order_hardening",
    location_id: locationId,
    order_date: form.order_date,
    customer_id: form.customer_id,
    customer_name: customerName,
    grand_total: totals.grand_total,
    paid_amount: totals.paid_amount,
    remaining_amount: totals.remaining_amount,
    payment_status: totals.payment_status,
    payment_method: paymentMethod,
    order,
    items,
    payment_breakdown:
      totals.paid_amount > 0
        ? [
            {
              method: paymentMethod || "CASH",
              payment_method: paymentMethod || "CASH",
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
  const totals = useMemo(() => buildCartTotals(cart, form.paid_amount), [cart, form.paid_amount]);
  const livePayload = useMemo(() => buildOrderPayload({ form, cart, totals, session, requestId }), [form, cart, totals, session, requestId]);

  const selectedProduct = products.find((item) => item.id === form.product_id);

  const validationErrors = useMemo(() => {
    const errors = [];
    if (!form.order_date) errors.push("Tanggal order wajib diisi.");
    if (!form.customer_id && !String(form.customer_name || "").trim()) errors.push("Nama customer wajib diisi.");
    if (cart.length === 0) errors.push("Keranjang masih kosong.");
    if (totals.grand_total <= 0) errors.push("Total order harus lebih dari Rp0.");
    if (totals.paid_amount > totals.grand_total) errors.push("Uang dibayar tidak boleh lebih besar dari total tagihan.");
    if (totals.paid_amount > 0 && !form.payment_method) errors.push("Metode pembayaran wajib dipilih kalau ada uang masuk.");

    const qtyByProduct = {};
    const stockByProduct = {};

    cart.forEach((item, index) => {
      const qty = numberValue(item.qty);
      const unitPrice = numberValue(item.unit_price);
      const productKey = item.product_id || item.product_code || item.product_name || `item-${index}`;

      if (qty <= 0) errors.push(`Qty item ke-${index + 1} harus lebih dari 0.`);
      if (unitPrice <= 0) errors.push(`Harga item ke-${index + 1} harus lebih dari 0.`);

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
  }, [form, cart, totals]);


  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getOrderBootstrap(session?.sessionToken, {
      source: "frontend_part_4p_kasir_order_hardening",
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

  const handleCustomerChange = (value) => {
    const customer = customers.find((item) => item.id === value);
    setForm((current) => ({
      ...current,
      customer_id: value,
      customer_name: customer ? customer.name : current.customer_name,
    }));
  };

  const handleProductChange = (value) => {
    const product = products.find((item) => item.id === value);
    setForm((current) => ({
      ...current,
      product_id: value,
      unit_price: product?.price_per_pcs ? String(product.price_per_pcs) : current.unit_price,
      qty: current.qty || "1",
    }));
  };

  const handleWalletChange = (value) => {
    const wallet = wallets.find((item) => item.id === value);
    updateForm("payment_method", wallet?.code || wallet?.name || value || "CASH");
  };

  const handleAddItem = () => {
    setShowValidationErrors(false);
    setSubmitResult(null);

    const product = selectedProduct;
    const qty = numberValue(form.qty);
    const unitPrice = numberValue(form.unit_price);

    if (!product || qty <= 0 || unitPrice <= 0) {
      setSubmitResult({
        success: false,
        message: "Pilih produk, isi qty, dan harga/pcs dulu.",
      });
      return;
    }

    const existingQty = cart
      .filter((item) => item.product_id === product.id)
      .reduce((total, item) => total + numberValue(item.qty), 0);

    if (product.stock_pcs > 0 && existingQty + qty > product.stock_pcs) {
      setSubmitResult({
        success: false,
        message: `Qty melebihi stok ready. Stok ${product.name}: ${product.stock_pcs.toLocaleString("id-ID")} pcs, sudah di keranjang ${existingQty.toLocaleString("id-ID")} pcs.`,
      });
      return;
    }

    const cartKey = `${product.id}-${unitPrice}`;

    setCart((current) => {
      const existing = current.find((item) => item.cart_key === cartKey);
      if (existing) {
        return current.map((item) => {
          if (item.cart_key !== cartKey) return item;
          const nextQty = numberValue(item.qty) + qty;
          return {
            ...item,
            qty: nextQty,
            line_total: nextQty * unitPrice,
          };
        });
      }

      return [
        ...current,
        {
          cart_id: `${product.id}-${Date.now()}`,
          cart_key: cartKey,
          product_id: product.id,
          product_code: product.code,
          product_name: product.name,
          qty,
          unit_price: unitPrice,
          line_total: qty * unitPrice,
          stock_pcs: product.stock_pcs,
        },
      ];
    });

    setForm((current) => ({
      ...current,
      product_id: "",
      qty: "",
      unit_price: "",
    }));
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
        description="Input order dari stok ready dengan validasi stok, anti-double-submit, invoice, payment, piutang, dan stok keluar yang saling tersambung."
        badge="Live Submit"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Penjualan</div>
          <div className="da-dashboard-banner-title">Stok Jadi → Order → Invoice → Uang Masuk</div>
          <div className="da-dashboard-banner-desc">
            Halaman ini khusus jual stok ready. Sistem memblok order kosong, qty lebih dari stok, dan request ganda supaya tidak ada order 0 pcs/Rp0.
          </div>
        </div>

        <div className="da-dashboard-banner-actions">
          <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Dicek" : "Terhubung"}</Badge>
          <Button variant="ghost" onClick={loadData} disabled={loading || submitting}>
            {loading ? "Membaca..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="da-login-error" style={{ marginBottom: 16 }}>
          {error}
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
              Tambahkan produk ke keranjang, isi pembayaran aktual, lalu simpan. Sistem akan membuat Order, Invoice, Uang Masuk/Piutang, dan stok keluar.
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
                onChange={(event) => updateForm("order_date", event.target.value)}
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
                onChange={(event) => updateForm("customer_name", event.target.value)}
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
                onChange={(event) => updateForm("qty", event.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="da-drop-field">
              <label>Harga / Pcs</label>
              <input
                className="da-input"
                inputMode="numeric"
                value={form.unit_price}
                placeholder="Contoh: 2125"
                onChange={(event) => updateForm("unit_price", event.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="da-form-actions" style={{ justifyContent: "flex-start" }}>
            <Button type="button" variant="ghost" onClick={handleAddItem} disabled={submitting || loading}>
              Tambah ke Keranjang
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
                value={wallets.find((wallet) => wallet.code === form.payment_method || wallet.name === form.payment_method)?.id || ""}
                onChange={(event) => handleWalletChange(event.target.value)}
                disabled={submitting || numberValue(form.paid_amount) <= 0}
              >
                <option value="">CASH / TUNAI</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id || wallet.name} value={wallet.id}>
                    {wallet.name}
                  </option>
                ))}
              </select>
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
            <Button type="submit" disabled={submitting || loading}>
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
            <p><strong>Order:</strong> Ya</p>
            <p><strong>Invoice:</strong> Ya</p>
            <p><strong>Stok Keluar:</strong> Ya</p>
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
          <PayloadRow label="Action" value="legacyCreateOrderHardenedFromOldPos" />
          <PayloadRow label="request_id" value={livePayload.request_id} />
          <PayloadRow label="customer_name" value={livePayload.order.customer_name} />
          <PayloadRow label="grand_total" value={formatRupiah(livePayload.order.grand_total)} />
          <PayloadRow label="paid_amount" value={formatRupiah(livePayload.order.paid_amount)} />
          <PayloadRow label="remaining_amount" value={formatRupiah(livePayload.order.remaining_amount)} />
          <PayloadRow label="items" value={`${livePayload.items.length} item`} />
        </div>

        <div className="da-modal-note" style={{ marginTop: 14 }}>
          Setelah disimpan, backend hardening akan validasi request_id, cart, stok ready, lalu membuat Order, Invoice, stok keluar, Payment/Wallet Mutation jika ada uang masuk, atau Piutang jika belum lunas.
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
