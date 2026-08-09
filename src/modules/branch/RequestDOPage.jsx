import { useEffect, useMemo, useState } from "react";
import {
  approveBranchGoodsRequest,
  cancelBranchGoodsRequest,
  createBranchGoodsRequest,
  createDeliveryOrderFromRequest,
  getRequestDOStockBootstrap,
  receiveDeliveryOrder,
  rejectBranchGoodsRequest,
} from "../../lib/api/actions";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import SalesFlowPanel from "../sales/SalesFlowPanel";

const asArray = (value) => (Array.isArray(value) ? value : []);
const num = (value) => {
  const parsed = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const text = (value, fallback = "-") => String(value || "").trim() || fallback;
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const displayDate = (value) => {
  if (!value) return "-";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};
const makeOperationId = (prefix) => {
  const random = globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 12)
    || Math.random().toString(36).slice(2, 14);
  return `OP-${prefix}-${Date.now()}-${random}`.toUpperCase();
};
const isAuthRequired = (result) => {
  const value = `${result?.code || ""} ${result?.message || ""} ${result?.error?.code || ""}`.toUpperCase();
  return value.includes("AUTH_REQUIRED") || (value.includes("SESSION") && value.includes("TIDAK AKTIF"));
};
const statusTone = (status) => {
  const value = String(status || "").toUpperCase();
  if (["APPROVED", "RECEIVED", "ACTIVE", "POSTED"].includes(value)) return "success";
  if (["REJECTED", "CANCELLED", "RECEIVED_WITH_DIFFERENCE"].includes(value)) return "danger";
  if (["PENDING", "IN_TRANSIT", "PARTIAL_RECEIVED"].includes(value)) return "warning";
  return "default";
};
const pcs = (value) => `${num(value).toLocaleString("id-ID")} pcs`;

const statusLabel = (status) => {
  const value = String(status || "").toUpperCase();
  const labels = {
    PENDING: "Menunggu",
    APPROVED: "Disetujui",
    IN_TRANSIT: "Dalam Perjalanan",
    PARTIAL_RECEIVED: "Diterima Sebagian",
    RECEIVED: "Diterima",
    RECEIVED_WITH_DIFFERENCE: "Diterima dengan Selisih",
    REJECTED: "Ditolak",
    CANCELLED: "Dibatalkan",
    POSTED: "Tercatat",
  };
  return labels[value] || text(status);
};

function normalizePayload(payload) {
  const data = payload?.data || payload || {};
  return {
    health: data.health || {},
    access: data.access || {},
    summary: {
      pending_request_count: num(data.summary?.pending_request_count),
      approved_request_count: num(data.summary?.approved_request_count),
      in_transit_do_count: num(data.summary?.in_transit_do_count),
      received_do_count: num(data.summary?.received_do_count),
      total_requested_pcs: num(data.summary?.total_requested_pcs),
      total_shipped_pcs: num(data.summary?.total_shipped_pcs),
      total_received_pcs: num(data.summary?.total_received_pcs),
      total_difference_pcs: num(data.summary?.total_difference_pcs),
      total_in_transit_pcs: num(data.summary?.total_in_transit_pcs),
      total_stock_free_pcs: num(data.summary?.total_stock_free_pcs),
    },
    stock: asArray(data.finished_stock || data.stock_ready).map((row) => ({
      ...row,
      stock_key: row.stock_key || row.product_id,
      product_id: row.product_id || "",
      product_code: row.product_code || "",
      product_name: row.product_name || "Produk",
      location_id: row.location_id || "",
      location_code: row.location_code || "",
      total_pcs: num(row.total_pcs),
      held_pcs: num(row.held_pcs),
      free_pcs: num(row.free_pcs),
    })),
    requests: asArray(data.branch_requests).map((row) => ({
      ...row,
      request_id: row.request_id || row.id || "",
      source_location: row.source_location || row.source_location_code || "",
      destination_location: row.destination_location || row.destination_location_code || "",
      items: asArray(row.items),
      qty_pcs: num(row.qty_pcs),
      approved_qty_pcs: num(row.approved_qty_pcs),
      status: row.status || "PENDING",
    })),
    deliveryOrders: asArray(data.delivery_orders).map((row) => ({
      ...row,
      do_id: row.do_id || row.id || "",
      source_location: row.source_location || row.source_location_code || "",
      destination_location: row.destination_location || row.destination_location_code || "",
      items: asArray(row.items),
      receipts: asArray(row.receipts),
      qty_pcs: num(row.qty_pcs),
      received_qty_pcs: num(row.received_qty_pcs),
      difference_qty_pcs: num(row.difference_qty_pcs),
      status: row.status || "IN_TRANSIT",
    })),
    locations: asArray(data.locations),
    products: asArray(data.products),
    warnings: asArray(data.warnings),
  };
}

export default function RequestDOPage({ session, onSessionExpired }) {
  const sessionToken = session?.sessionToken || "";
  const userLocationId = session?.user?.location_id || "";
  const userRoleId = session?.user?.role_id || "";
  const currentDate = today();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState(() => normalizePayload({}));
  const [filter, setFilter] = useState({
    date_start: currentDate.slice(0, 8) + "01",
    date_end: currentDate,
    destination_location: "ALL",
    status: "ALL",
  });
  const [requestDraft, setRequestDraft] = useState({
    request_date: currentDate,
    needed_date: currentDate,
    source_location: "TGR",
    destination_location: "",
    notes: "",
  });
  const [itemDraft, setItemDraft] = useState({ product_id: "", qty: "" });
  const [requestItems, setRequestItems] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [activeView, setActiveView] = useState("requests");
  const [decisionReason, setDecisionReason] = useState("");
  const [selectedDO, setSelectedDO] = useState(null);
  const [approvalQty, setApprovalQty] = useState({});
  const [receiveQty, setReceiveQty] = useState({});
  const [receiveForm, setReceiveForm] = useState({
    receipt_date: currentDate,
    close_delivery: false,
    discrepancy_reason: "",
    proof_reference: "",
    notes: "",
  });

  const isGlobal = Boolean(data.access?.is_global)
    || ["ROLE-OWNER", "ROLE-HO-ADMIN"].includes(userRoleId);
  const canApprove = Boolean(data.access?.can_approve) || isGlobal;
  const canCreateDO = Boolean(data.access?.can_create_do) || isGlobal;

  const tangerangLocation = useMemo(
    () => data.locations.find((row) => row.location_code === "TGR") || null,
    [data.locations]
  );
  const destinationOptions = useMemo(
    () => data.locations.filter((row) => row.location_code !== "TGR"),
    [data.locations]
  );
  const selectedProduct = useMemo(
    () => data.products.find((row) => row.product_id === itemDraft.product_id) || null,
    [data.products, itemDraft.product_id]
  );
  const selectedProductStock = useMemo(
    () => data.stock.find((row) => row.product_id === itemDraft.product_id) || null,
    [data.stock, itemDraft.product_id]
  );

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getRequestDOStockBootstrap(sessionToken, {
        date_start: filter.date_start,
        date_end: filter.date_end,
        destination_location: filter.destination_location,
        status: filter.status,
        source_location: "TGR",
      });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal membaca Request & DO.");
        return;
      }
      const normalized = normalizePayload(result.data || result);
      setData(normalized);
      setRequestDraft((current) => {
        const own = normalized.locations.find((row) => row.location_id === userLocationId);
        const defaultDestination = isGlobal
          ? normalized.locations.find((row) => row.location_code !== "TGR")
          : own;
        return {
          ...current,
          source_location: normalized.locations.find((row) => row.location_code === "TGR")?.location_id || "TGR",
          destination_location: current.destination_location || defaultDestination?.location_id || "",
        };
      });
      setItemDraft((current) => ({
        ...current,
        product_id: current.product_id || normalized.products[0]?.product_id || "",
      }));
    } catch (caught) {
      setError(caught?.message || "Gagal membaca Request & DO.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runWrite = async (action, successFallback) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await action();
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return false;
      }
      if (!result?.success) {
        setError(result?.message || "Transaksi ditolak backend.");
        return false;
      }
      setSuccess(result?.message || successFallback);
      await loadData();
      return true;
    } catch (caught) {
      setError(caught?.message || "Transaksi gagal diproses.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addRequestItem = () => {
    setError("");
    const quantity = num(itemDraft.qty);
    if (!selectedProduct) {
      setError("Produk wajib dipilih.");
      return;
    }
    if (quantity <= 0) {
      setError("Qty request wajib lebih dari 0 pcs.");
      return;
    }
    if (requestItems.some((row) => row.product_id === selectedProduct.product_id)) {
      setError("Produk yang sama sudah ada dalam request.");
      return;
    }
    setRequestItems((current) => [
      ...current,
      {
        product_id: selectedProduct.product_id,
        product_code: selectedProduct.product_code,
        product_name: selectedProduct.product_name,
        qty: quantity,
        free_pcs: selectedProductStock?.free_pcs || 0,
      },
    ]);
    setItemDraft((current) => ({ ...current, qty: "" }));
  };

  const submitRequest = async () => {
    if (!requestDraft.destination_location) {
      setError("Lokasi tujuan wajib dipilih.");
      return;
    }
    if (requestItems.length === 0) {
      setError("Tambahkan minimal satu produk ke request.");
      return;
    }
    const ok = await runWrite(
      () => createBranchGoodsRequest(sessionToken, {
        ...requestDraft,
        items: requestItems,
        requested_by_name: session?.user?.name || session?.user?.username || "",
        operation_id: makeOperationId("BRANCH-REQ"),
      }),
      "Request barang berhasil dibuat."
    );
    if (ok) {
      setRequestItems([]);
      setRequestDraft((current) => ({ ...current, notes: "" }));
      setRequestFormOpen(false);
    }
  };

  const openRequest = (row) => {
    setSelectedRequest(row);
    setDecisionReason("");
    setApprovalQty(Object.fromEntries(
      row.items.map((item) => [item.request_item_id, String(num(item.qty_requested))])
    ));
  };

  const approveRequest = async () => {
    const row = selectedRequest;
    if (!row) return;
    const ok = await runWrite(
      () => approveBranchGoodsRequest(sessionToken, {
        request_id: row.request_id,
        items: row.items.map((item) => ({
          request_item_id: item.request_item_id,
          qty_approved: num(approvalQty[item.request_item_id]),
        })),
        notes: "Disetujui untuk diproses pengiriman.",
        operation_id: makeOperationId("BRANCH-APPROVE"),
      }),
      "Request berhasil disetujui."
    );
    if (ok) setSelectedRequest(null);
  };

  const rejectRequest = async () => {
    const row = selectedRequest;
    if (!row) return;
    const reason = decisionReason.trim();
    if (!reason) {
      setError("Alasan penolakan wajib diisi.");
      return;
    }
    const ok = await runWrite(
      () => rejectBranchGoodsRequest(sessionToken, {
        request_id: row.request_id,
        reason,
        operation_id: makeOperationId("BRANCH-REJECT"),
      }),
      "Request berhasil ditolak."
    );
    if (ok) { setSelectedRequest(null); setDecisionReason(""); }
  };

  const cancelRequest = async () => {
    const row = selectedRequest;
    if (!row) return;
    const reason = decisionReason.trim();
    if (!reason) {
      setError("Alasan pembatalan wajib diisi.");
      return;
    }
    const ok = await runWrite(
      () => cancelBranchGoodsRequest(sessionToken, {
        request_id: row.request_id,
        reason,
        operation_id: makeOperationId("BRANCH-CANCEL"),
      }),
      "Request dibatalkan."
    );
    if (ok) { setSelectedRequest(null); setDecisionReason(""); }
  };

  const createDO = async () => {
    const row = selectedRequest;
    if (!row) return;
    const ok = await runWrite(
      () => createDeliveryOrderFromRequest(sessionToken, {
        request_id: row.request_id,
        do_date: currentDate,
        notes: "Pengiriman barang antar lokasi.",
        operation_id: makeOperationId("DELIVERY-ORDER"),
      }),
      "DO berhasil dibuat dan barang keluar dari stok sumber."
    );
    if (ok) { setSelectedRequest(null); setActiveView("delivery"); }
  };

  const openDO = (row) => {
    setSelectedDO(row);
    setReceiveQty(Object.fromEntries(
      row.items.map((item) => [
        item.do_item_id,
        String(Math.max(num(item.qty_shipped) - num(item.qty_received) - num(item.qty_difference), 0)),
      ])
    ));
    setReceiveForm({
      receipt_date: currentDate,
      close_delivery: false,
      discrepancy_reason: "",
      proof_reference: "",
      notes: "",
    });
  };

  const receiveDO = async () => {
    const row = selectedDO;
    if (!row) return;
    const totalReceive = row.items.reduce(
      (sum, item) => sum + num(receiveQty[item.do_item_id]),
      0
    );
    if (totalReceive <= 0 && !receiveForm.close_delivery) {
      setError("Minimal ada qty yang diterima.");
      return;
    }
    if (receiveForm.close_delivery && !receiveForm.discrepancy_reason) {
      const stillShort = row.items.some((item) => {
        const remaining = Math.max(num(item.qty_shipped) - num(item.qty_received) - num(item.qty_difference), 0);
        return num(receiveQty[item.do_item_id]) + 0.0001 < remaining;
      });
      if (stillShort) {
        setError("Alasan selisih wajib diisi saat DO ditutup dalam kondisi kurang.");
        return;
      }
    }
    const ok = await runWrite(
      () => receiveDeliveryOrder(sessionToken, {
        do_id: row.do_id,
        receipt_date: receiveForm.receipt_date,
        close_delivery: receiveForm.close_delivery,
        discrepancy_reason: receiveForm.discrepancy_reason,
        proof_reference: receiveForm.proof_reference,
        notes: receiveForm.notes,
        items: row.items.map((item) => ({
          do_item_id: item.do_item_id,
          qty_received: num(receiveQty[item.do_item_id]),
        })),
        operation_id: makeOperationId("DELIVERY-RECEIVE"),
      }),
      "Penerimaan DO berhasil."
    );
    if (ok) setSelectedDO(null);
  };

  const requestColumns = [
    { key: "request_date", label: "Tanggal", render: (row) => displayDate(row.request_date) },
    { key: "request_id", label: "Request ID", render: (row) => <strong>{row.request_id}</strong> },
    { key: "destination_location", label: "Tujuan" },
    { key: "items", label: "Produk", render: (row) => `${row.items.length} produk` },
    { key: "qty", label: "Diminta", render: (row) => pcs(row.qty_pcs) },
    { key: "approved", label: "Disetujui", render: (row) => pcs(row.approved_qty_pcs) },
    { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge> },
  ];
  const doColumns = [
    { key: "do_date", label: "Tanggal", render: (row) => displayDate(row.do_date) },
    { key: "do_id", label: "DO ID", render: (row) => <strong>{row.do_id}</strong> },
    { key: "route", label: "Rute", render: (row) => `${row.source_location} → ${row.destination_location}` },
    { key: "shipped", label: "Dikirim", render: (row) => pcs(row.qty_pcs) },
    { key: "received", label: "Diterima", render: (row) => pcs(row.received_qty_pcs) },
    { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge> },
  ];
  const stockColumns = [
    { key: "product_name", label: "Produk", render: (row) => <strong>{row.product_name}</strong> },
    { key: "location_code", label: "Lokasi" },
    { key: "total_pcs", label: "Fisik", render: (row) => pcs(row.total_pcs) },
    { key: "held_pcs", label: "Ditahan PO", render: (row) => pcs(row.held_pcs) },
    { key: "free_pcs", label: "Bisa Dikirim", render: (row) => pcs(row.free_pcs) },
  ];

  const selectedDestination = data.locations.find(
    (row) => row.location_id === requestDraft.destination_location
  );
  const canReceiveSelectedDO = selectedDO && (
    isGlobal || selectedDO.destination_location_id === userLocationId
  );

  const requestCount = data.requests.length;
  const deliveryCount = data.deliveryOrders.length;
  const sourceFree = data.summary.total_stock_free_pcs;
  const inTransit = data.summary.in_transit_do_count;
  const inTransitQty = data.summary.total_in_transit_pcs;

  return (
    <div className="da-sales-page">
      <PageHeader
        eyebrow="PENJUALAN & DISTRIBUSI"
        title="Request Barang & DO"
        description="Kelola permintaan cabang, persetujuan, pengiriman, dan penerimaan stok antar lokasi dalam satu ruang kerja."
      />

      <div className="da-sales-head-actions">
        <SalesFlowPanel
          session={session}
          onSessionExpired={onSessionExpired}
          activeStep="distribution"
          refreshKey={requestCount + deliveryCount}
        />
        <Button variant="secondary" onClick={loadData} disabled={loading || saving}>
          {loading ? "Memuat..." : "Perbarui"}
        </Button>
        <Button onClick={() => setRequestFormOpen(true)}>+ Buat Request</Button>
      </div>

      {error ? <div className="da-form-error">{error}</div> : null}
      {success ? <div className="da-form-success">{success}</div> : null}
      {data.warnings.map((warning) => <div className="da-alert-note" key={warning}>{warning}</div>)}

      <section className="da-sales-kpi-grid">
        <StatCard onClick={() => setActiveView("requests")} label="Request Pending" value={data.summary.pending_request_count.toLocaleString("id-ID")} tone="warning" description="Menunggu persetujuan pusat." />
        <StatCard onClick={() => setActiveView("requests")} label="Siap Dikirim" value={data.summary.approved_request_count.toLocaleString("id-ID")} tone="success" description="Request approved yang dapat dibuatkan DO." />
        <StatCard onClick={() => setActiveView("delivery")} label="Dalam Perjalanan" value={inTransit.toLocaleString("id-ID")} tone="warning" description="Sudah keluar sumber, belum diterima tujuan." />
        <StatCard onClick={() => setActiveView("stock")} label="Stok Bisa Dikirim" value={pcs(sourceFree)} description="Persediaan bebas pada lokasi sumber." />
      </section>

      <section className="da-sales-workspace-8-4">
        <Card className="da-sales-main-panel">
          <div className="da-sales-tabs">
            <button type="button" className={activeView === "requests" ? "active" : ""} onClick={() => setActiveView("requests")}>Request <span>{requestCount}</span></button>
            <button type="button" className={activeView === "delivery" ? "active" : ""} onClick={() => setActiveView("delivery")}>Delivery Order <span>{deliveryCount}</span></button>
            <button type="button" className={activeView === "stock" ? "active" : ""} onClick={() => setActiveView("stock")}>Stok Sumber</button>
          </div>

          <div className="da-sales-filterbar da-sales-filterbar-wide">
            <label><span>Mulai</span><input className="da-input" type="date" value={filter.date_start} onChange={(event) => setFilter((current) => ({ ...current, date_start: event.target.value }))} /></label>
            <label><span>Sampai</span><input className="da-input" type="date" value={filter.date_end} onChange={(event) => setFilter((current) => ({ ...current, date_end: event.target.value }))} /></label>
            <label>
              <span>Tujuan</span>
              <select className="da-select" value={filter.destination_location} disabled={!isGlobal} onChange={(event) => setFilter((current) => ({ ...current, destination_location: event.target.value }))}>
                <option value="ALL">Semua lokasi</option>
                {destinationOptions.map((location) => <option key={location.location_id} value={location.location_id}>{location.location_name}</option>)}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select className="da-select" value={filter.status} onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value }))}>
                <option value="ALL">Semua</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="IN_TRANSIT">Dalam perjalanan</option>
                <option value="PARTIAL_RECEIVED">Diterima sebagian</option>
                <option value="RECEIVED">Diterima</option>
                <option value="REJECTED">Ditolak</option>
                <option value="CANCELLED">Dibatalkan</option>
              </select>
            </label>
            <Button variant="secondary" onClick={loadData} disabled={loading}>Terapkan</Button>
          </div>

          {activeView === "requests" ? (
            <>
              <div className="da-section-heading"><div><div className="da-mini-title">PERMINTAAN CABANG</div><div className="da-big-text">Request Barang</div><p className="da-muted">Klik baris untuk approval, penolakan, pembatalan, atau pembuatan DO.</p></div><Button variant="secondary" onClick={() => setRequestFormOpen(true)}>Request Baru</Button></div>
              <DataTable columns={requestColumns} rows={data.requests} getRowKey={(row) => row.request_id} onRowClick={openRequest} />
              {!loading && data.requests.length === 0 ? <div className="da-sales-empty">Belum ada request barang pada periode ini.</div> : null}
            </>
          ) : null}

          {activeView === "delivery" ? (
            <>
              <div className="da-section-heading"><div><div className="da-mini-title">PENGIRIMAN ANTAR LOKASI</div><div className="da-big-text">Delivery Order</div><p className="da-muted">Barang keluar dari lokasi sumber saat DO dibuat dan masuk ke tujuan saat penerimaan dikonfirmasi.</p></div></div>
              <DataTable columns={doColumns} rows={data.deliveryOrders} getRowKey={(row) => row.do_id} onRowClick={openDO} />
              {!loading && data.deliveryOrders.length === 0 ? <div className="da-sales-empty">Belum ada pengiriman pada periode ini.</div> : null}
            </>
          ) : null}

          {activeView === "stock" ? (
            <>
              <div className="da-section-heading"><div><div className="da-mini-title">PERSEDIAAN SUMBER</div><div className="da-big-text">Stok yang Bisa Dikirim</div><p className="da-muted">Stok bebas setelah dikurangi reservasi PO aktif.</p></div></div>
              <DataTable columns={stockColumns} rows={data.stock} getRowKey={(row) => `${row.location_id}-${row.product_id}`} />
              {!loading && data.stock.length === 0 ? <div className="da-sales-empty">Belum ada stok sumber yang tersedia.</div> : null}
            </>
          ) : null}
        </Card>

        <Card className="da-sales-side-panel">
          <div className="da-mini-title">POSISI DISTRIBUSI</div>
          <div className="da-sales-side-hero">
            <span>Barang dalam perjalanan</span>
            <strong>{pcs(inTransitQty)}</strong>
            <small>{inTransit.toLocaleString("id-ID")} DO masih berjalan</small>
          </div>
          <div className="da-sales-side-list">
            <div><span>Request pending</span><strong>{data.summary.pending_request_count.toLocaleString("id-ID")}</strong></div>
            <div><span>Request approved</span><strong>{data.summary.approved_request_count.toLocaleString("id-ID")}</strong></div>
            <div><span>Sudah diterima</span><strong>{pcs(data.summary.total_received_pcs)}</strong></div>
            <div><span>Stok bebas sumber</span><strong>{pcs(sourceFree)}</strong></div>
          </div>
          <p className="da-sales-footnote">Transfer antar lokasi tidak membentuk omzet atau uang masuk. Nilai persediaan mengikuti HPP historis dari cost layer sumber.</p>
        </Card>
      </section>

      <Modal
        open={requestFormOpen}
        title="Buat Request Barang"
        subtitle="Request mencatat kebutuhan cabang. Stok baru keluar setelah DO dibuat."
        size="xl"
        onClose={() => { if (!saving) setRequestFormOpen(false); }}
      >
        <div className="da-sales-form-stack">
          <section className="da-sales-form-section">
            <div className="da-sales-form-section-title"><span>01</span><div><strong>Jadwal & Rute</strong><small>Tentukan sumber, tujuan, dan tanggal kebutuhan.</small></div></div>
            <div className="da-drop-form-grid">
              <div className="da-drop-field"><label>Tanggal Request</label><input className="da-input" type="date" value={requestDraft.request_date} onChange={(event) => setRequestDraft((current) => ({ ...current, request_date: event.target.value }))} /></div>
              <div className="da-drop-field"><label>Dibutuhkan Tanggal</label><input className="da-input" type="date" value={requestDraft.needed_date} onChange={(event) => setRequestDraft((current) => ({ ...current, needed_date: event.target.value }))} /></div>
              <div className="da-drop-field"><label>Lokasi Sumber</label><input className="da-input" value={tangerangLocation?.location_name || "Tangerang HO"} disabled /></div>
              <div className="da-drop-field"><label>Lokasi Tujuan</label><select className="da-select" value={requestDraft.destination_location} disabled={!isGlobal} onChange={(event) => setRequestDraft((current) => ({ ...current, destination_location: event.target.value }))}>{destinationOptions.map((location) => <option key={location.location_id} value={location.location_id}>{location.location_name}</option>)}</select></div>
            </div>
          </section>

          <section className="da-sales-form-section">
            <div className="da-sales-form-section-title"><span>02</span><div><strong>Barang yang Diminta</strong><small>Request boleh dibuat walau stok sumber belum mencukupi; approval dan pengiriman tetap divalidasi backend.</small></div></div>
            <div className="da-sales-product-row">
              <label><span>Produk</span><select className="da-select" value={itemDraft.product_id} onChange={(event) => setItemDraft((current) => ({ ...current, product_id: event.target.value }))}>{data.products.map((product) => <option key={product.product_id} value={product.product_id}>{product.product_name}{data.stock.find((row) => row.product_id === product.product_id) ? ` · tersedia ${pcs(data.stock.find((row) => row.product_id === product.product_id)?.free_pcs)}` : ""}</option>)}</select></label>
              <label><span>Qty / Pcs</span><input className="da-input" inputMode="numeric" value={itemDraft.qty} onChange={(event) => setItemDraft((current) => ({ ...current, qty: event.target.value }))} placeholder="Jumlah pcs" /></label>
              <Button variant="secondary" onClick={addRequestItem}>Tambah Barang</Button>
            </div>
            <DataTable
              columns={[
                { key: "product_name", label: "Produk", render: (row) => <strong>{row.product_name}</strong> },
                { key: "qty", label: "Diminta", render: (row) => pcs(row.qty) },
                { key: "free", label: "Stok Bebas Saat Ini", render: (row) => pcs(row.free_pcs) },
                { key: "action", label: "Aksi", render: (row) => <Button variant="ghost" onClick={() => setRequestItems((current) => current.filter((item) => item.product_id !== row.product_id))}>Hapus</Button> },
              ]}
              rows={requestItems}
              getRowKey={(row) => row.product_id}
            />
          </section>

          <section className="da-sales-form-section">
            <div className="da-sales-form-section-title"><span>03</span><div><strong>Catatan Permintaan</strong><small>Catatan operasional untuk tim pusat dan cabang.</small></div></div>
            <div className="da-drop-field"><label>Catatan</label><textarea className="da-input" rows="3" value={requestDraft.notes} onChange={(event) => setRequestDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Opsional" /></div>
            <div className="da-sales-total-grid">
              <div><span>Produk</span><strong>{requestItems.length}</strong></div>
              <div><span>Total diminta</span><strong>{pcs(requestItems.reduce((sum, row) => sum + num(row.qty), 0))}</strong></div>
              <div className="highlight"><span>Tujuan</span><strong>{selectedDestination?.location_name || "-"}</strong></div>
            </div>
          </section>

          <div className="da-form-actions da-sales-sticky-actions">
            <Button variant="ghost" onClick={() => setRequestItems([])} disabled={saving}>Reset Item</Button>
            <Button onClick={submitRequest} disabled={saving || requestItems.length === 0}>{saving ? "Menyimpan..." : "Simpan Request"}</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(selectedRequest)}
        title={selectedRequest ? `Request ${selectedRequest.request_id}` : "Detail Request"}
        subtitle={selectedRequest ? `${selectedRequest.source_location} → ${selectedRequest.destination_location}` : ""}
        size="xl"
        onClose={() => { setSelectedRequest(null); setDecisionReason(""); }}
      >
        {selectedRequest ? (
          <div className="da-sales-form-stack">
            <div className="da-sales-detail-summary">
              <div><span>Status</span><Badge tone={statusTone(selectedRequest.status)}>{statusLabel(selectedRequest.status)}</Badge></div>
              <div><span>Dibuat</span><strong>{displayDate(selectedRequest.request_date)}</strong></div>
              <div><span>Dibutuhkan</span><strong>{displayDate(selectedRequest.needed_date)}</strong></div>
              <div><span>DO terkait</span><strong>{text(selectedRequest.delivery_order_id)}</strong></div>
            </div>

            <DataTable
              columns={[
                { key: "product_name", label: "Produk" },
                { key: "requested", label: "Diminta", render: (row) => pcs(row.qty_requested) },
                {
                  key: "approved",
                  label: "Qty Disetujui",
                  render: (row) => selectedRequest.status === "PENDING" && canApprove
                    ? <input className="da-input da-inline-number" type="number" min="0" max={num(row.qty_requested)} value={approvalQty[row.request_item_id] || ""} onChange={(event) => setApprovalQty((current) => ({ ...current, [row.request_item_id]: event.target.value }))} />
                    : pcs(row.qty_approved),
                },
                { key: "fulfilled", label: "Diterima", render: (row) => pcs(row.qty_fulfilled) },
              ]}
              rows={selectedRequest.items}
              getRowKey={(row) => row.request_item_id}
            />

            {selectedRequest.rejection_reason ? <div className="da-form-error">Alasan: {selectedRequest.rejection_reason}</div> : null}

            {selectedRequest.status === "PENDING" ? (
              <section className="da-sales-form-section">
                <div className="da-sales-form-section-title"><span>01</span><div><strong>Keputusan Request</strong><small>Approval belum mengurangi stok. Stok keluar hanya ketika DO dibuat.</small></div></div>
                <div className="da-form-actions">
                  {canApprove ? <Button onClick={approveRequest} disabled={saving}>Setujui Request</Button> : null}
                </div>
                <div className="da-drop-field"><label>{canApprove ? "Alasan bila ditolak" : "Alasan pembatalan"}</label><textarea className="da-input" rows="3" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} placeholder="Wajib diisi untuk menolak atau membatalkan" /></div>
                <div className="da-form-actions">
                  {canApprove ? <Button variant="ghost" onClick={rejectRequest} disabled={saving}>Tolak Request</Button> : <Button variant="ghost" onClick={cancelRequest} disabled={saving}>Batalkan Request</Button>}
                </div>
              </section>
            ) : null}

            {selectedRequest.status === "APPROVED" && canCreateDO && !selectedRequest.delivery_order_id ? (
              <section className="da-sales-form-section">
                <div className="da-sales-form-section-title"><span>02</span><div><strong>Buat Delivery Order</strong><small>Stok sumber akan keluar dan nilainya berpindah ke Persediaan Dalam Perjalanan.</small></div></div>
                <div className="da-form-actions"><Button onClick={createDO} disabled={saving}>{saving ? "Memproses..." : "Buat & Kirim DO"}</Button></div>
              </section>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(selectedDO)}
        title={selectedDO ? `Delivery Order ${selectedDO.do_id}` : "Detail Delivery Order"}
        subtitle={selectedDO ? `${selectedDO.source_location} → ${selectedDO.destination_location}` : ""}
        size="xl"
        onClose={() => setSelectedDO(null)}
      >
        {selectedDO ? (
          <div className="da-sales-form-stack">
            <div className="da-sales-detail-summary">
              <div><span>Status</span><Badge tone={statusTone(selectedDO.status)}>{statusLabel(selectedDO.status)}</Badge></div>
              <div><span>Dikirim</span><strong>{pcs(selectedDO.qty_pcs)}</strong></div>
              <div><span>Diterima</span><strong>{pcs(selectedDO.received_qty_pcs)}</strong></div>
              <div><span>Request</span><strong>{selectedDO.request_id}</strong></div>
            </div>

            <DataTable
              columns={[
                { key: "product_name", label: "Produk" },
                { key: "shipped", label: "Dikirim", render: (row) => pcs(row.qty_shipped) },
                { key: "received", label: "Sudah Diterima", render: (row) => pcs(row.qty_received) },
                { key: "difference", label: "Selisih Ditutup", render: (row) => pcs(row.qty_difference) },
                {
                  key: "receive_now",
                  label: "Terima Sekarang",
                  render: (row) => canReceiveSelectedDO && ["IN_TRANSIT", "PARTIAL_RECEIVED"].includes(selectedDO.status)
                    ? <input className="da-input da-inline-number" type="number" min="0" max={Math.max(num(row.qty_shipped) - num(row.qty_received) - num(row.qty_difference), 0)} value={receiveQty[row.do_item_id] || "0"} onChange={(event) => setReceiveQty((current) => ({ ...current, [row.do_item_id]: event.target.value }))} />
                    : "-",
                },
              ]}
              rows={selectedDO.items}
              getRowKey={(row) => row.do_item_id}
            />

            {canReceiveSelectedDO && ["IN_TRANSIT", "PARTIAL_RECEIVED"].includes(selectedDO.status) ? (
              <section className="da-sales-form-section">
                <div className="da-sales-form-section-title"><span>01</span><div><strong>Konfirmasi Penerimaan</strong><small>Stok tujuan bertambah sesuai qty diterima. Sisa tetap berada dalam perjalanan sampai diterima atau ditutup sebagai selisih.</small></div></div>
                <div className="da-drop-form-grid">
                  <div className="da-drop-field"><label>Tanggal Terima</label><input className="da-input" type="date" value={receiveForm.receipt_date} onChange={(event) => setReceiveForm((current) => ({ ...current, receipt_date: event.target.value }))} /></div>
                  <div className="da-drop-field"><label>Referensi Bukti</label><input className="da-input" value={receiveForm.proof_reference} onChange={(event) => setReceiveForm((current) => ({ ...current, proof_reference: event.target.value }))} placeholder="Nomor/nama bukti (opsional)" /></div>
                  <div className="da-drop-field da-drop-field-wide"><label>Catatan</label><input className="da-input" value={receiveForm.notes} onChange={(event) => setReceiveForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Opsional" /></div>
                </div>
                <label className="da-sales-check-row"><input type="checkbox" checked={receiveForm.close_delivery} onChange={(event) => setReceiveForm((current) => ({ ...current, close_delivery: event.target.checked }))} /><span>Tutup pengiriman setelah penerimaan ini.</span></label>
                {receiveForm.close_delivery ? <div className="da-drop-field"><label>Alasan Selisih</label><textarea className="da-input" rows="3" value={receiveForm.discrepancy_reason} onChange={(event) => setReceiveForm((current) => ({ ...current, discrepancy_reason: event.target.value }))} placeholder="Wajib bila masih ada kekurangan" /></div> : null}
                <div className="da-form-actions"><Button onClick={receiveDO} disabled={saving}>{saving ? "Memproses..." : "Konfirmasi Penerimaan"}</Button></div>
              </section>
            ) : null}

            {selectedDO.receipts.length ? (
              <section className="da-sales-form-section">
                <div className="da-sales-form-section-title"><span>02</span><div><strong>Riwayat Penerimaan</strong><small>Jejak receipt yang sudah diposting untuk DO ini.</small></div></div>
                <DataTable
                  columns={[
                    { key: "receipt_date", label: "Tanggal", render: (row) => displayDate(row.receipt_date) },
                    { key: "receipt_id", label: "Receipt ID" },
                    { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge> },
                  ]}
                  rows={selectedDO.receipts}
                  getRowKey={(row) => row.receipt_id}
                />
              </section>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
