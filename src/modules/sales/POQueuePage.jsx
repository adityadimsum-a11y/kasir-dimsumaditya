import { useEffect, useMemo, useState } from "react";
import {
  cancelPOQueue,
  confirmPOQueue,
  createPOQueue,
  getPOQueueBootstrap,
  resolveOrderItemPrice,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { suggestedPaymentMethod } from "../../lib/finance/walletPolicy";
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
  notes: "PO menahan stok. Belum menjadi omzet sebelum dikonfirmasi.",
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
    notes: "PO dikonfirmasi menjadi Order resmi.",
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
      setNotice({ success: false, message: "Server Price Lock belum siap." });
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
        message: result?.message || "Harga PO gagal di-resolve backend.",
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
      message: "Harga PO dikunci backend dan item masuk daftar permintaan.",
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
      notes: "PO dikonfirmasi menjadi Order resmi.",
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
    { key: "queue_status", label: "Status", render: (row) => <Badge tone={tone(row.queue_status)}>{row.queue_status}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Antrian PO"
        description="PO menahan stok dan harga resmi, tetapi belum menjadi omzet, invoice, piutang, atau uang masuk."
        badge="PHP/MySQL Single Source"
      />

      <SalesFlowPanel
        session={session}
        onSessionExpired={onSessionExpired}
        compact
        refreshKey={queue.length}
      />

      <div style={{ height: 16 }} />

      {error ? <div className="da-form-warning">{error}</div> : null}
      {notice ? (
        <div className={notice.success ? "da-form-success" : "da-form-warning"} style={{ marginBottom: 16 }}>
          {notice.message}
        </div>
      ) : null}

      <div className="da-grid da-grid-3">
        <StatCard label="PO Aktif" value={loading ? "..." : numberValue(summary.pending_count)} description="Masih menahan stok dan belum omzet." />
        <StatCard tone="success" label="Sudah Jadi Order" value={loading ? "..." : numberValue(summary.confirmed_count)} description="Sudah memiliki invoice dan kabel keuangan." />
        <StatCard tone="warning" label="Stok Ditahan" value={loading ? "..." : `${numberValue(summary.total_reserved_pcs).toLocaleString("id-ID")} pcs`} description="Bukan stok bebas sampai PO dipenuhi atau dibatalkan." />
      </div>

      <div style={{ height: 16 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">INPUT PO</div>
            <div className="da-big-text">Buat Permintaan dan Tahan Stok</div>
            <p className="da-muted">Harga dikunci backend. Simpan PO tidak membuat jurnal penjualan atau Wallet IN.</p>
          </div>
          <Badge tone={pricingReady && cashierReady ? "success" : "warning"}>
            {pricingReady && cashierReady ? "PO Live Ready" : "Gate Belum Siap"}
          </Badge>
        </div>

        <div className="da-drop-form-grid">
          <div className="da-drop-field"><label>Tanggal PO</label><input className="da-input" type="date" value={draft.po_date} onChange={(event) => updateDraft("po_date", event.target.value)} /></div>
          <div className="da-drop-field"><label>Tanggal Pickup</label><input className="da-input" type="date" value={draft.pickup_date} onChange={(event) => updateDraft("pickup_date", event.target.value)} /></div>
          <div className="da-drop-field"><label>Jenis PO</label><select className="da-select" value={draft.order_mode} onChange={(event) => updateDraft("order_mode", event.target.value)}><option value="PO_HARIAN">PO Harian</option><option value="PO_KARANTINA">PO Karantina</option></select></div>
          <div className="da-drop-field"><label>Customer Terdaftar</label><select className="da-select" value={draft.customer_id} onChange={(event) => handleCustomer(event.target.value)}><option value="">Manual / UMUM</option>{customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
          <div className="da-drop-field"><label>Nama Customer</label><input className="da-input" value={draft.customer_name} onChange={(event) => updateDraft("customer_name", event.target.value)} placeholder="Nama pemesan" /></div>
          <div className="da-drop-field"><label>Produk</label><select className="da-select" value={draft.product_id} onChange={(event) => updateDraft("product_id", event.target.value)}><option value="">Pilih produk stok ready</option>{products.map((row) => <option key={row.id} value={row.id}>{row.name} · stok bebas {row.stock_pcs.toLocaleString("id-ID")} pcs</option>)}</select></div>
          <div className="da-drop-field"><label>Qty / Pcs</label><input className="da-input" inputMode="numeric" value={draft.qty} onChange={(event) => updateDraft("qty", event.target.value)} placeholder="Contoh: 500" /></div>
          <div className="da-drop-field"><label>Catatan</label><input className="da-input" value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} /></div>
        </div>

        <div className="da-form-actions" style={{ justifyContent: "flex-start" }}>
          <Button variant="ghost" onClick={handleAddItem} disabled={resolving || saving || !pricingReady || !cashierReady}>{resolving ? "Mengunci Harga..." : "Kunci Harga & Tambah"}</Button>
        </div>

        <div style={{ height: 14 }} />
        <DataTable columns={cartColumns} rows={cart} getRowKey={(row) => row.product_id} />

        <div className="da-drop-preview-panel" style={{ marginTop: 14 }}>
          <div><div className="da-mini-title">Jumlah Item</div><div className="da-big-text">{cart.length}</div></div>
          <div><div className="da-mini-title">Qty Ditahan</div><div className="da-big-text">{cartQty.toLocaleString("id-ID")} pcs</div></div>
          <div><div className="da-mini-title">Nilai Referensi PO</div><div className="da-big-text">{formatRupiah(cartTotal)}</div><p className="da-muted">Belum menjadi omzet.</p></div>
        </div>

        <div className="da-form-actions">
          <Button variant="ghost" onClick={() => { setDraft(initialDraft); setCart([]); }}>Reset</Button>
          <Button onClick={handleSavePO} disabled={saving || cart.length === 0 || !pricingReady || !cashierReady}>{saving ? "Menyimpan..." : "Simpan Antrian PO"}</Button>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card>
        <div className="da-section-heading">
          <div><div className="da-mini-title">FILTER & MONITOR</div><div className="da-big-text">Antrian PO yang Tercatat</div><p className="da-muted">Klik baris untuk konfirmasi menjadi Order atau membatalkan PO.</p></div>
          <Button variant="ghost" onClick={loadData} disabled={loading}>{loading ? "Memuat..." : "Tarik Data"}</Button>
        </div>
        <div className="da-drop-form-grid">
          <div className="da-drop-field"><label>Mulai</label><input className="da-input" type="date" value={filter.date_start} onChange={(event) => setFilter((current) => ({ ...current, date_start: event.target.value }))} /></div>
          <div className="da-drop-field"><label>Sampai</label><input className="da-input" type="date" value={filter.date_end} onChange={(event) => setFilter((current) => ({ ...current, date_end: event.target.value }))} /></div>
          <div className="da-drop-field"><label>Status</label><select className="da-select" value={filter.status} onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value }))}><option value="ALL">Semua</option><option value="RESERVED">Ditahan</option><option value="CONFIRMED">Sudah Jadi Order</option><option value="CANCELLED">Dibatalkan</option></select></div>
        </div>
        <DataTable columns={poColumns} rows={queue} getRowKey={(row) => row.po_id} onRowClick={setSelectedPO} />
      </Card>

      <Modal
        open={Boolean(selectedPO)}
        title={selectedPO ? `Detail PO ${selectedPO.po_id}` : "Detail PO"}
        subtitle="PO belum menjadi omzet sampai dikonfirmasi."
        onClose={() => { setSelectedPO(null); setCancelReason(""); }}
      >
        {selectedPO ? (
          <div>
            <div className="da-grid da-grid-3">
              <StatCard label="Customer" value={selectedPO.customer_name} description={`Pickup ${safeText(selectedPO.pickup_date)}`} />
              <StatCard tone="warning" label="Stok Ditahan" value={`${selectedPO.reserved_pcs.toLocaleString("id-ID")} pcs`} description={selectedPO.order_mode} />
              <StatCard label="Nilai PO" value={formatRupiah(selectedPO.total_amount)} description="Nilai referensi, belum omzet." />
            </div>

            <div style={{ height: 14 }} />
            <DataTable
              columns={[
                { key: "product_name", label: "Produk" },
                { key: "qty", label: "Qty", render: (row) => `${numberValue(row.qty).toLocaleString("id-ID")} pcs` },
                { key: "unit_price", label: "Harga Terkunci", render: (row) => formatRupiah(row.unit_price) },
                { key: "subtotal", label: "Nilai", render: (row) => formatRupiah(row.subtotal) },
              ]}
              rows={selectedPO.items}
              getRowKey={(row) => row.order_item_id || row.product_id}
            />

            {String(selectedPO.queue_status).toUpperCase() === "RESERVED" ? (
              <>
                <div style={{ height: 18 }} />
                <div className="da-mini-title">JADIKAN ORDER RESMI</div>
                <div className="da-drop-form-grid">
                  <div className="da-drop-field"><label>Tanggal Penjualan</label><input className="da-input" type="date" value={confirmForm.sale_date} onChange={(event) => setConfirmForm((current) => ({ ...current, sale_date: event.target.value }))} /></div>
                  <div className="da-drop-field"><label>Uang Dibayar Sekarang</label><input className="da-input" inputMode="numeric" value={confirmForm.amount_paid} onChange={(event) => setConfirmForm((current) => ({ ...current, amount_paid: event.target.value }))} /></div>
                  <div className="da-drop-field"><label>Dompet Penerimaan</label><select className="da-select" value={confirmForm.wallet_id} onChange={(event) => handleConfirmWallet(event.target.value)} disabled={numberValue(confirmForm.amount_paid) <= 0}><option value="">Pilih dompet</option>{wallets.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>{confirmForm.wallet_id ? <div className="da-muted">Metode otomatis: <strong>{confirmForm.payment_method}</strong></div> : null}</div>
                  <div className="da-drop-field"><label>Catatan</label><input className="da-input" value={confirmForm.notes} onChange={(event) => setConfirmForm((current) => ({ ...current, notes: event.target.value }))} /></div>
                </div>
                <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                  <input type="checkbox" checked={confirmForm.fulfill_now} onChange={(event) => setConfirmForm((current) => ({ ...current, fulfill_now: event.target.checked }))} />
                  Langsung serahkan barang dan potong stok/HPP sekarang
                </label>
                <div className="da-form-actions">
                  <Button onClick={handleConfirmPO} disabled={saving}>{saving ? "Memproses..." : "Jadikan Order Resmi"}</Button>
                </div>

                <div style={{ height: 18 }} />
                <div className="da-mini-title">BATALKAN PO</div>
                <div className="da-drop-field"><label>Alasan Pembatalan</label><input className="da-input" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Wajib diisi; stok akan kembali bebas" /></div>
                <div className="da-form-actions"><Button variant="ghost" onClick={handleCancelPO} disabled={saving}>Batalkan & Lepas Stok</Button></div>
              </>
            ) : (
              <div className="da-form-success" style={{ marginTop: 18 }}>
                Status PO: <strong>{selectedPO.queue_status}</strong>. Detail keuangan dapat ditelusuri dari Order ID yang sama.
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
