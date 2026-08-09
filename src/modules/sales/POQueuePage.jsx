import { useEffect, useMemo, useState } from "react";
import {
  cancelPOQueue,
  confirmPOQueue,
  createPOQueue,
  getPOQueueBootstrap,
  resolveOrderItemPrice,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { suggestedPaymentMethod } from "../../lib/finance/walletPolicy.js";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import SalesFlowPanel from "./SalesFlowPanel";

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

function todayValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function operationId(prefix, session) {
  const location = session?.user?.location_code || "LOC";
  return `${prefix}-${location}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

function isAuthRequired(result) {
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  const message = String(result?.message || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || message.includes("AUTH_REQUIRED");
}

function normalizeProduct(row) {
  return {
    id: row.product_id || row.id || "",
    code: row.product_code || row.code || "",
    name: row.product_name || row.name || "Produk",
    unit: row.unit || row.default_unit || "pcs",
    stock_pcs: numberValue(
      row.stock_pcs || row.free_qty || row.free_pcs || row.available_pcs || 0
    ),
    raw: row,
  };
}

function normalizeCustomer(row) {
  return {
    id: row.customer_id || row.id || "",
    name: row.customer_name || row.name || row.nama || "",
    phone: row.phone || row.no_hp || "",
  };
}

function normalizeWallet(row) {
  return {
    id: row.wallet_id || row.id || "",
    code: row.wallet_code || row.code || "",
    name: row.wallet_name || row.name || row.wallet_code || "Dompet",
    balance: numberValue(row.balance || row.current_balance || 0),
    raw: row,
  };
}

function normalizePO(row) {
  const items = asArray(row.items).map((item) => ({
    ...item,
    qty: numberValue(item.qty || item.quantity),
    unit_price: numberValue(item.unit_price),
    subtotal: numberValue(item.subtotal),
  }));

  return {
    ...row,
    po_id: row.order_id || row.po_id || row.id || "",
    po_date: row.order_date || row.po_date || row.created_at || "",
    pickup_date: row.pickup_date || row.target_date || "",
    customer_name: row.customer_name || "Customer",
    total_amount: numberValue(row.total_amount),
    qty_pcs: numberValue(row.qty_pcs),
    reserved_pcs: numberValue(row.reserved_pcs),
    shortage_pcs: numberValue(row.shortage_pcs),
    queue_status: row.queue_status || row.status || "RESERVED",
    order_mode: row.order_mode || "PO_HARIAN",
    items,
    reservations: asArray(row.reservations),
  };
}

function statusLabel(status) {
  const value = String(status || "").toUpperCase();
  const labels = {
    RESERVED: "Menunggu Konfirmasi",
    CONFIRMED: "Sudah Jadi Order",
    FULFILLED: "Selesai",
    CANCELLED: "Dibatalkan",
  };
  return labels[value] || safeText(status);
}

function tone(status) {
  const text = String(status || "").toUpperCase();
  if (text.includes("CONFIRMED") || text.includes("FULFILLED")) return "success";
  if (text.includes("CANCEL")) return "danger";
  return "warning";
}

const initialDraft = {
  po_date: todayValue(),
  pickup_date: todayValue(),
  order_mode: "PO_HARIAN",
  customer_id: "",
  customer_name: "",
  product_id: "",
  qty: "",
  notes: "",
};

export default function POQueuePage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [bootstrap, setBootstrap] = useState({});
  const [draft, setDraft] = useState(initialDraft);
  const [cart, setCart] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [poFormOpen, setPoFormOpen] = useState(false);
  const [filter, setFilter] = useState({
    date_start: todayValue(),
    date_end: todayValue(),
    status: "ALL",
  });
  const [confirmForm, setConfirmForm] = useState({
    sale_date: todayValue(),
    amount_paid: "0",
    wallet_id: "",
    payment_method: "",
    fulfill_now: true,
    notes: "",
  });
  const [cancelReason, setCancelReason] = useState("");

  const locationId =
    session?.user?.location_id || session?.user?.location_code || "";
  const sessionToken = session?.sessionToken || "";

  const products = useMemo(
    () => asArray(bootstrap.products).map(normalizeProduct).filter((row) => row.id),
    [bootstrap.products]
  );
  const customers = useMemo(
    () => asArray(bootstrap.customers).map(normalizeCustomer),
    [bootstrap.customers]
  );
  const wallets = useMemo(
    () => asArray(bootstrap.wallets).map(normalizeWallet).filter((row) => row.id),
    [bootstrap.wallets]
  );
  const queue = useMemo(
    () => asArray(bootstrap.po_queue).map(normalizePO),
    [bootstrap.po_queue]
  );
  const summary = bootstrap.summary || {};
  const pricingReady = bootstrap?.pricing_lock?.ready === true;
  const cashierReady = bootstrap?.branch_commerce?.cashier_live === true;

  const selectedProduct = products.find((row) => row.id === draft.product_id);
  const selectedCustomer = customers.find((row) => row.id === draft.customer_id);
  const cartQty = cart.reduce((sum, row) => sum + numberValue(row.qty), 0);
  const cartTotal = cart.reduce((sum, row) => sum + numberValue(row.subtotal), 0);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getPOQueueBootstrap(sessionToken, {
      ...filter,
      location_id: locationId,
    });

    setLoading(false);

    if (!result?.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setError(result?.message || "Antrian PO belum dapat dibaca.");
      return;
    }

    setBootstrap(result.data || {});
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, locationId]);

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice(null);
  };

  const handleCustomer = (value) => {
    const customer = customers.find((row) => row.id === value);
    setDraft((current) => ({
      ...current,
      customer_id: value,
      customer_name: customer?.name || current.customer_name,
    }));
  };

  const handleAddItem = async () => {
    const qty = numberValue(draft.qty);

    if (!pricingReady) {
      setNotice({ success: false, message: "Aturan harga resmi belum siap." });
      return;
    }
    if (!cashierReady) {
      setNotice({
        success: false,
        message: "Kasir lokasi belum diaktifkan pada Go-Live Control.",
      });
      return;
    }
    if (!selectedProduct || qty <= 0) {
      setNotice({ success: false, message: "Pilih produk dan isi qty PO." });
      return;
    }

    const existing = cart.find((row) => row.product_id === selectedProduct.id);
    const totalQty = numberValue(existing?.qty) + qty;

    if (selectedProduct.stock_pcs + 0.0001 < totalQty) {
      setNotice({
        success: false,
        message: `Stok bebas ${selectedProduct.name} hanya ${selectedProduct.stock_pcs.toLocaleString(
          "id-ID"
        )} pcs.`,
      });
      return;
    }

    setResolving(true);
    const result = await resolveOrderItemPrice(sessionToken, {
      location_id: locationId,
      product_id: selectedProduct.id,
      customer_id: draft.customer_id,
      qty: totalQty,
      unit_type: "PCS",
      channel_code: "PO",
      price_date: draft.po_date,
    });
    setResolving(false);

    if (!result?.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setNotice({
        success: false,
        message: result?.message || "Harga PO belum berhasil ditentukan sistem.",
      });
      return;
    }

    const resolved = result.data || {};
    const unitPrice = numberValue(resolved.price_per_unit);

    if (!resolved.resolved || unitPrice <= 0 || !resolved.price_rule_id) {
      setNotice({
        success: false,
        message: resolved.message || "Belum ada aturan harga resmi yang cocok.",
      });
      return;
    }

    const next = {
      product_id: selectedProduct.id,
      product_code: selectedProduct.code,
      product_name: selectedProduct.name,
      qty: totalQty,
      unit: "pcs",
      unit_type: "PCS",
      unit_price: unitPrice,
      subtotal: totalQty * unitPrice,
      price_rule_id: resolved.price_rule_id,
      price_name: resolved.price_name || "Harga Resmi",
      price_tier: resolved.price_tier || resolved.matched_tier || "NORMAL",
      price_source: "PHP_MYSQL_PRICING",
      price_date: resolved.price_date || draft.po_date,
      pricing_snapshot: resolved,
      stock_pcs_snapshot: selectedProduct.stock_pcs,
    };

    setCart((current) =>
      existing
        ? current.map((row) => (row.product_id === next.product_id ? next : row))
        : [...current, next]
    );
    setDraft((current) => ({ ...current, product_id: "", qty: "" }));
    setNotice({
      success: true,
      message: "Harga PO dikunci sistem dan item masuk daftar permintaan.",
    });
  };

  const handleSavePO = async () => {
    if (saving) return;

    const customerName = safeText(
      selectedCustomer?.name || draft.customer_name,
      "UMUM"
    );

    if (!draft.po_date || !draft.pickup_date) {
      setNotice({ success: false, message: "Tanggal PO dan pickup wajib diisi." });
      return;
    }
    if (cart.length === 0) {
      setNotice({ success: false, message: "Daftar item PO masih kosong." });
      return;
    }

    const opId = operationId("OP-PO-CREATE", session);
    const payload = {
      operation_id: opId,
      request_id: opId,
      idempotency_key: opId,
      location_id: locationId,
      order_mode: draft.order_mode,
      order_date: draft.po_date,
      pickup_date: draft.pickup_date,
      customer_id: draft.customer_id,
      customer_name: customerName,
      amount_paid: 0,
      fulfill_now: false,
      notes: draft.notes,
      items: cart,
      order: {
        location_id: locationId,
        order_mode: draft.order_mode,
        order_date: draft.po_date,
        pickup_date: draft.pickup_date,
        customer_id: draft.customer_id,
        customer_name: customerName,
        amount_paid: 0,
        fulfill_now: false,
        notes: draft.notes,
        items: cart,
      },
    };

    setSaving(true);
    const result = await createPOQueue(sessionToken, payload);
    setSaving(false);

    if (!result?.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setNotice({ success: false, message: result?.message || "PO gagal disimpan." });
      return;
    }

    setNotice({ success: true, message: result.message || "PO berhasil disimpan." });
    setDraft(initialDraft);
    setCart([]);
    setPoFormOpen(false);
    await loadData();
  };

  const handleConfirmWallet = (walletId) => {
    const wallet = wallets.find((row) => row.id === walletId);
    setConfirmForm((current) => ({
      ...current,
      wallet_id: walletId,
      payment_method: wallet ? suggestedPaymentMethod(wallet.raw || wallet) : "",
    }));
  };

  const handleConfirmPO = async () => {
    if (!selectedPO || saving) return;

    const amount = numberValue(confirmForm.amount_paid);
    if (amount > 0 && !confirmForm.wallet_id) {
      setNotice({
        success: false,
        message: "Pilih dompet yang benar-benar menerima pembayaran.",
      });
      return;
    }

    const opId = operationId("OP-PO-CONFIRM", session);
    setSaving(true);
    const result = await confirmPOQueue(sessionToken, {
      operation_id: opId,
      request_id: opId,
      idempotency_key: opId,
      location_id: locationId,
      order_id: selectedPO.po_id,
      sale_date: confirmForm.sale_date,
      amount_paid: amount,
      wallet_id: confirmForm.wallet_id,
      payment_method: confirmForm.payment_method,
      fulfill_now: confirmForm.fulfill_now,
      notes: confirmForm.notes,
    });
    setSaving(false);

    if (!result?.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setNotice({
        success: false,
        message: result?.message || "PO gagal dijadikan Order resmi.",
      });
      return;
    }

    setNotice({ success: true, message: result.message });
    setSelectedPO(null);
    setConfirmForm({
      sale_date: todayValue(),
      amount_paid: "0",
      wallet_id: "",
      payment_method: "",
      fulfill_now: true,
      notes: "",
    });
    await loadData();
  };

  const handleCancelPO = async () => {
    if (!selectedPO || saving) return;
    if (!cancelReason.trim()) {
      setNotice({ success: false, message: "Alasan pembatalan wajib diisi." });
      return;
    }

    const opId = operationId("OP-PO-CANCEL", session);
    setSaving(true);
    const result = await cancelPOQueue(sessionToken, {
      operation_id: opId,
      request_id: opId,
      idempotency_key: opId,
      location_id: locationId,
      order_id: selectedPO.po_id,
      reason: cancelReason,
    });
    setSaving(false);

    if (!result?.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setNotice({ success: false, message: result?.message || "PO gagal dibatalkan." });
      return;
    }

    setNotice({ success: true, message: result.message });
    setSelectedPO(null);
    setCancelReason("");
    await loadData();
  };

  const cartColumns = [
    { key: "product_name", label: "Produk", render: (row) => <strong>{row.product_name}</strong> },
    { key: "qty", label: "Qty", render: (row) => `${numberValue(row.qty).toLocaleString("id-ID")} pcs` },
    { key: "unit_price", label: "Harga Resmi", render: (row) => formatRupiah(row.unit_price) },
    { key: "price_name", label: "Rule", render: (row) => <div><strong>{row.price_name}</strong><div className="da-muted">{row.price_rule_id}</div></div> },
    { key: "subtotal", label: "Nilai PO", render: (row) => formatRupiah(row.subtotal) },
    { key: "action", label: "Aksi", render: (row) => <Button variant="ghost" onClick={() => setCart((current) => current.filter((item) => item.product_id !== row.product_id))}>Hapus</Button> },
  ];

  const poColumns = [
    { key: "po_date", label: "Tanggal", render: (row) => safeText(row.po_date) },
    { key: "po_id", label: "PO ID", render: (row) => <strong>{row.po_id}</strong> },
    { key: "customer_name", label: "Customer" },
    { key: "pickup_date", label: "Pickup" },
    { key: "qty_pcs", label: "Diminta", render: (row) => `${row.qty_pcs.toLocaleString("id-ID")} pcs` },
    { key: "reserved_pcs", label: "Ditahan", render: (row) => `${row.reserved_pcs.toLocaleString("id-ID")} pcs` },
    { key: "total_amount", label: "Nilai Referensi", render: (row) => formatRupiah(row.total_amount) },
    { key: "queue_status", label: "Status", render: (row) => <Badge tone={tone(row.queue_status)}>{statusLabel(row.queue_status)}</Badge> },
  ];

  const activePOValue = queue
    .filter((row) => !["CONFIRMED", "CANCELLED"].includes(String(row.queue_status).toUpperCase()))
    .reduce((sum, row) => sum + numberValue(row.total_amount), 0);
  const activePOCount = numberValue(summary.pending_count || queue.filter((row) => String(row.queue_status).toUpperCase() === "RESERVED").length);
  const confirmedCount = numberValue(summary.confirmed_count || queue.filter((row) => String(row.queue_status).toUpperCase() === "CONFIRMED").length);
  const reservedQty = numberValue(summary.total_reserved_pcs || queue.reduce((sum, row) => sum + numberValue(row.reserved_pcs), 0));

  return (
    <div className="da-sales-page">
      <PageHeader
        eyebrow="PENJUALAN & DISTRIBUSI"
        title="Antrian PO"
        description="Kelola pesanan terjadwal, reservasi stok, dan konfirmasi menjadi penjualan resmi."
      />

      <div className="da-sales-head-actions">
        <SalesFlowPanel
          session={session}
          onSessionExpired={onSessionExpired}
          activeStep="po"
          refreshKey={queue.length}
        />
        <Button variant="secondary" onClick={loadData} disabled={loading}>
          {loading ? "Memuat..." : "Perbarui"}
        </Button>
        <Button onClick={() => setPoFormOpen(true)}>+ Buat PO</Button>
      </div>

      {error ? <div className="da-form-warning">{error}</div> : null}
      {notice ? (
        <div className={notice.success ? "da-form-success" : "da-form-warning"}>
          {notice.message}
        </div>
      ) : null}

      <section className="da-sales-kpi-grid">
        <StatCard label="PO Aktif" value={loading ? "..." : activePOCount.toLocaleString("id-ID")} description="Pesanan yang masih menunggu konfirmasi." />
        <StatCard tone="warning" label="Stok Direservasi" value={loading ? "..." : `${reservedQty.toLocaleString("id-ID")} pcs`} description="Stok yang sudah disiapkan untuk PO aktif." />
        <StatCard tone="success" label="Sudah Jadi Order" value={loading ? "..." : confirmedCount.toLocaleString("id-ID")} description="PO yang sudah dikonfirmasi menjadi penjualan." />
        <StatCard label="Nilai PO Aktif" value={loading ? "..." : formatRupiah(activePOValue)} description="Nilai referensi PO yang belum menjadi omzet." />
      </section>

      <section className="da-sales-workspace-8-4">
        <Card className="da-sales-main-panel">
          <div className="da-section-heading">
            <div>
              <div className="da-mini-title">ANTRIAN PENJUALAN</div>
              <div className="da-big-text">PO Customer</div>
              <p className="da-muted">Klik baris untuk konfirmasi penjualan, pembayaran, fulfillment, atau pembatalan.</p>
            </div>
            <Button variant="secondary" onClick={() => setPoFormOpen(true)}>PO Baru</Button>
          </div>

          <div className="da-sales-filterbar">
            <label>
              <span>Mulai</span>
              <input className="da-input" type="date" value={filter.date_start} onChange={(event) => setFilter((current) => ({ ...current, date_start: event.target.value }))} />
            </label>
            <label>
              <span>Sampai</span>
              <input className="da-input" type="date" value={filter.date_end} onChange={(event) => setFilter((current) => ({ ...current, date_end: event.target.value }))} />
            </label>
            <label>
              <span>Status</span>
              <select className="da-select" value={filter.status} onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value }))}>
                <option value="ALL">Semua</option>
                <option value="RESERVED">Menunggu konfirmasi</option>
                <option value="CONFIRMED">Sudah jadi order</option>
                <option value="CANCELLED">Dibatalkan</option>
              </select>
            </label>
            <Button variant="secondary" onClick={loadData} disabled={loading}>Terapkan</Button>
          </div>

          <DataTable columns={poColumns} rows={queue} getRowKey={(row) => row.po_id} onRowClick={setSelectedPO} />
          {!loading && queue.length === 0 ? <div className="da-sales-empty">Belum ada PO pada periode yang dipilih.</div> : null}
        </Card>

        <Card className="da-sales-side-panel">
          <div className="da-mini-title">POSISI PO</div>
          <div className="da-sales-side-hero">
            <span>Nilai PO aktif</span>
            <strong>{formatRupiah(activePOValue)}</strong>
            <small>{activePOCount.toLocaleString("id-ID")} PO menunggu konfirmasi</small>
          </div>
          <div className="da-sales-side-list">
            <div><span>Stok direservasi</span><strong>{reservedQty.toLocaleString("id-ID")} pcs</strong></div>
            <div><span>Sudah jadi order</span><strong>{confirmedCount.toLocaleString("id-ID")}</strong></div>
            <div><span>Harga resmi</span><strong>{pricingReady ? "Siap" : "Perlu dilengkapi"}</strong></div>
            <div><span>Kasir lokasi</span><strong>{cashierReady ? "Aktif" : "Belum aktif"}</strong></div>
          </div>
          <p className="da-sales-footnote">PO menahan stok tetapi belum membentuk omzet, invoice, piutang, atau uang masuk sebelum dikonfirmasi.</p>
        </Card>
      </section>

      <Modal
        open={poFormOpen}
        title="Buat PO Customer"
        subtitle="Harga dikunci sesuai aturan aktif dan stok akan direservasi saat PO berhasil disimpan."
        size="xl"
        onClose={() => { if (!saving) setPoFormOpen(false); }}
      >
        <div className="da-sales-form-stack">
          <section className="da-sales-form-section">
            <div className="da-sales-form-section-title"><span>01</span><div><strong>Jadwal & Customer</strong><small>Tentukan tanggal pemesanan, pickup, dan customer.</small></div></div>
            <div className="da-drop-form-grid">
              <div className="da-drop-field"><label>Tanggal PO</label><input className="da-input" type="date" value={draft.po_date} onChange={(event) => updateDraft("po_date", event.target.value)} /></div>
              <div className="da-drop-field"><label>Tanggal Pickup</label><input className="da-input" type="date" value={draft.pickup_date} onChange={(event) => updateDraft("pickup_date", event.target.value)} /></div>
              <div className="da-drop-field"><label>Jenis PO</label><select className="da-select" value={draft.order_mode} onChange={(event) => updateDraft("order_mode", event.target.value)}><option value="PO_HARIAN">PO Harian</option><option value="PO_KARANTINA">PO Karantina</option></select></div>
              <div className="da-drop-field"><label>Customer Terdaftar</label><select className="da-select" value={draft.customer_id} onChange={(event) => handleCustomer(event.target.value)}><option value="">Manual / UMUM</option>{customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
              <div className="da-drop-field da-drop-field-wide"><label>Nama Customer</label><input className="da-input" value={draft.customer_name} onChange={(event) => updateDraft("customer_name", event.target.value)} placeholder="Nama pemesan" /></div>
            </div>
          </section>

          <section className="da-sales-form-section">
            <div className="da-sales-form-section-title"><span>02</span><div><strong>Produk & Reservasi</strong><small>Tambahkan produk satu per satu menggunakan harga resmi sistem.</small></div></div>
            <div className="da-sales-product-row">
              <label><span>Produk</span><select className="da-select" value={draft.product_id} onChange={(event) => updateDraft("product_id", event.target.value)}><option value="">Pilih produk stok ready</option>{products.map((row) => <option key={row.id} value={row.id}>{row.name} · tersedia {row.stock_pcs.toLocaleString("id-ID")} pcs</option>)}</select></label>
              <label><span>Qty / Pcs</span><input className="da-input" inputMode="numeric" value={draft.qty} onChange={(event) => updateDraft("qty", event.target.value)} placeholder="Jumlah pcs" /></label>
              <Button variant="secondary" onClick={handleAddItem} disabled={resolving || saving || !pricingReady || !cashierReady}>{resolving ? "Menghitung..." : "Tambah Produk"}</Button>
            </div>
            <DataTable columns={cartColumns} rows={cart} getRowKey={(row) => row.product_id} />
          </section>

          <section className="da-sales-form-section">
            <div className="da-sales-form-section-title"><span>03</span><div><strong>Ringkasan PO</strong><small>Nilai ini masih referensi dan belum menjadi penjualan.</small></div></div>
            <div className="da-sales-total-grid">
              <div><span>Item</span><strong>{cart.length}</strong></div>
              <div><span>Qty direservasi</span><strong>{cartQty.toLocaleString("id-ID")} pcs</strong></div>
              <div className="highlight"><span>Nilai PO</span><strong>{formatRupiah(cartTotal)}</strong></div>
            </div>
            <div className="da-drop-field"><label>Catatan</label><textarea className="da-input" rows="3" value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} placeholder="Catatan customer / pickup (opsional)" /></div>
          </section>

          <div className="da-form-actions da-sales-sticky-actions">
            <Button variant="ghost" onClick={() => { setDraft(initialDraft); setCart([]); }} disabled={saving}>Reset</Button>
            <Button onClick={handleSavePO} disabled={saving || cart.length === 0 || !pricingReady || !cashierReady}>{saving ? "Menyimpan..." : "Simpan PO"}</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(selectedPO)}
        title={selectedPO ? `PO ${selectedPO.po_id}` : "Detail PO"}
        subtitle={selectedPO ? `${selectedPO.customer_name} · pickup ${safeText(selectedPO.pickup_date)}` : ""}
        size="xl"
        onClose={() => { setSelectedPO(null); setCancelReason(""); }}
      >
        {selectedPO ? (
          <div className="da-sales-form-stack">
            <div className="da-sales-detail-summary">
              <div><span>Status</span><Badge tone={tone(selectedPO.queue_status)}>{statusLabel(selectedPO.queue_status)}</Badge></div>
              <div><span>Qty diminta</span><strong>{selectedPO.qty_pcs.toLocaleString("id-ID")} pcs</strong></div>
              <div><span>Stok ditahan</span><strong>{selectedPO.reserved_pcs.toLocaleString("id-ID")} pcs</strong></div>
              <div><span>Nilai PO</span><strong>{formatRupiah(selectedPO.total_amount)}</strong></div>
            </div>

            <DataTable
              columns={[
                { key: "product_name", label: "Produk" },
                { key: "qty", label: "Qty", render: (row) => `${numberValue(row.qty).toLocaleString("id-ID")} pcs` },
                { key: "unit_price", label: "Harga", render: (row) => formatRupiah(row.unit_price) },
                { key: "subtotal", label: "Nilai", render: (row) => formatRupiah(row.subtotal) },
              ]}
              rows={selectedPO.items}
              getRowKey={(row) => row.order_item_id || row.product_id}
            />

            {String(selectedPO.queue_status).toUpperCase() === "RESERVED" ? (
              <div className="da-sales-split-actions">
                <section className="da-sales-form-section">
                  <div className="da-sales-form-section-title"><span>01</span><div><strong>Konfirmasi Penjualan</strong><small>PO berubah menjadi order, invoice, pembayaran/piutang, dan fulfillment sesuai pilihan.</small></div></div>
                  <div className="da-drop-form-grid">
                    <div className="da-drop-field"><label>Tanggal Penjualan</label><input className="da-input" type="date" value={confirmForm.sale_date} onChange={(event) => setConfirmForm((current) => ({ ...current, sale_date: event.target.value }))} /></div>
                    <div className="da-drop-field"><label>Bayar Sekarang</label><input className="da-input" inputMode="numeric" value={confirmForm.amount_paid} onChange={(event) => setConfirmForm((current) => ({ ...current, amount_paid: event.target.value }))} /></div>
                    <div className="da-drop-field"><label>Dompet Penerimaan</label><select className="da-select" value={confirmForm.wallet_id} onChange={(event) => handleConfirmWallet(event.target.value)} disabled={numberValue(confirmForm.amount_paid) <= 0}><option value="">Pilih dompet</option>{wallets.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>{confirmForm.wallet_id ? <div className="da-muted">Metode: <strong>{confirmForm.payment_method}</strong></div> : null}</div>
                    <div className="da-drop-field"><label>Catatan</label><input className="da-input" value={confirmForm.notes} onChange={(event) => setConfirmForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Opsional" /></div>
                  </div>
                  <label className="da-sales-check-row"><input type="checkbox" checked={confirmForm.fulfill_now} onChange={(event) => setConfirmForm((current) => ({ ...current, fulfill_now: event.target.checked }))} /><span>Barang langsung diserahkan dan stok/HPP diposting pada tanggal penjualan.</span></label>
                  <div className="da-form-actions"><Button onClick={handleConfirmPO} disabled={saving}>{saving ? "Memproses..." : "Konfirmasi Jadi Order"}</Button></div>
                </section>

                <section className="da-sales-form-section da-sales-danger-section">
                  <div className="da-sales-form-section-title"><span>02</span><div><strong>Batalkan PO</strong><small>Reservasi dilepas dan stok kembali tersedia.</small></div></div>
                  <div className="da-drop-field"><label>Alasan Pembatalan</label><textarea className="da-input" rows="4" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Alasan wajib diisi" /></div>
                  <div className="da-form-actions"><Button variant="ghost" onClick={handleCancelPO} disabled={saving}>Batalkan & Lepas Stok</Button></div>
                </section>
              </div>
            ) : (
              <div className="da-form-success">PO ini berstatus <strong>{statusLabel(selectedPO.queue_status)}</strong>. Detail transaksi lanjutan dapat ditelusuri melalui Arsip Digital.</div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
