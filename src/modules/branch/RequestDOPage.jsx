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
    notes: "Request barang cabang.",
  });
  const [itemDraft, setItemDraft] = useState({ product_id: "", qty: "" });
  const [requestItems, setRequestItems] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedDO, setSelectedDO] = useState(null);
  const [approvalQty, setApprovalQty] = useState({});
  const [receiveQty, setReceiveQty] = useState({});
  const [receiveForm, setReceiveForm] = useState({
    receipt_date: currentDate,
    close_delivery: false,
    discrepancy_reason: "",
    proof_reference: "",
    notes: "Barang diterima cabang.",
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
      setRequestDraft((current) => ({ ...current, notes: "Request barang cabang." }));
    }
  };

  const openRequest = (row) => {
    setSelectedRequest(row);
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
        notes: "Disetujui Tangerang.",
        operation_id: makeOperationId("BRANCH-APPROVE"),
      }),
      "Request berhasil disetujui."
    );
    if (ok) setSelectedRequest(null);
  };

  const rejectRequest = async () => {
    const row = selectedRequest;
    if (!row) return;
    const reason = window.prompt("Tuliskan alasan penolakan request:", "Stok atau jadwal pengiriman belum memungkinkan.");
    if (!reason) return;
    const ok = await runWrite(
      () => rejectBranchGoodsRequest(sessionToken, {
        request_id: row.request_id,
        reason,
        operation_id: makeOperationId("BRANCH-REJECT"),
      }),
      "Request berhasil ditolak."
    );
    if (ok) setSelectedRequest(null);
  };

  const cancelRequest = async () => {
    const row = selectedRequest;
    if (!row || !window.confirm(`Batalkan request ${row.request_id}?`)) return;
    const ok = await runWrite(
      () => cancelBranchGoodsRequest(sessionToken, {
        request_id: row.request_id,
        reason: "Dibatalkan sebelum approval.",
        operation_id: makeOperationId("BRANCH-CANCEL"),
      }),
      "Request dibatalkan."
    );
    if (ok) setSelectedRequest(null);
  };

  const createDO = async () => {
    const row = selectedRequest;
    if (!row || !window.confirm(`Buat dan kirim DO dari ${row.request_id}? Stok sumber akan berkurang.`)) return;
    const ok = await runWrite(
      () => createDeliveryOrderFromRequest(sessionToken, {
        request_id: row.request_id,
        do_date: currentDate,
        notes: "DO dibuat dari request barang cabang.",
        operation_id: makeOperationId("DELIVERY-ORDER"),
      }),
      "DO berhasil dibuat dan dikirim."
    );
    if (ok) setSelectedRequest(null);
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
      notes: "Barang diterima cabang.",
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
    if (!window.confirm(`Konfirmasi penerimaan ${row.do_id}? Stok lokasi tujuan akan bertambah.`)) return;
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
    { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
  ];
  const doColumns = [
    { key: "do_date", label: "Tanggal", render: (row) => displayDate(row.do_date) },
    { key: "do_id", label: "DO ID", render: (row) => <strong>{row.do_id}</strong> },
    { key: "route", label: "Rute", render: (row) => `${row.source_location} → ${row.destination_location}` },
    { key: "shipped", label: "Dikirim", render: (row) => pcs(row.qty_pcs) },
    { key: "received", label: "Diterima", render: (row) => pcs(row.received_qty_pcs) },
    { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
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

  return (
    <>
      <PageHeader
        eyebrow="DIMSUM ADITYA"
        title="Request Barang & DO"
        description="Cabang meminta barang, Tangerang menyetujui dan mengirim, lalu stok cabang bertambah hanya setelah penerimaan dikonfirmasi. Bukan penjualan dan bukan uang masuk."
        badge="PHP/MySQL Single Source"
      />

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">ANTAR-LOKASI</div>
            <h2 className="da-section-title">Request → Approval → DO → In Transit → Receive</h2>
            <p className="da-section-desc">
              HPP historis mengikuti cost layer sumber. Barang In Transit tidak dihitung sebagai stok tujuan.
            </p>
          </div>
          <div className="da-header-actions">
            <Badge tone={data.health?.ready ? "success" : "danger"}>
              {data.health?.ready ? "DO Live Ready" : "Migration 018 Belum Siap"}
            </Badge>
            <Badge tone="warning">Bukan Omzet</Badge>
            <Button variant="secondary" onClick={loadData} disabled={loading || saving}>Refresh Data</Button>
          </div>
        </div>
        {error ? <div className="da-form-error">{error}</div> : null}
        {success ? <div className="da-form-success">{success}</div> : null}
        {data.warnings.map((warning) => <div className="da-alert-note" key={warning}>{warning}</div>)}
      </Card>

      <section className="da-stat-grid da-stat-grid-3">
        <StatCard label="Request Pending" value={data.summary.pending_request_count.toLocaleString("id-ID")} tone="warning" description="Menunggu Tangerang." />
        <StatCard label="Request Approved" value={data.summary.approved_request_count.toLocaleString("id-ID")} tone="success" description="Siap dibuat DO." />
        <StatCard label="DO In Transit" value={data.summary.in_transit_do_count.toLocaleString("id-ID")} tone="warning" description="Belum menjadi stok cabang." />
        <StatCard label="DO Diterima" value={data.summary.received_do_count.toLocaleString("id-ID")} tone="success" description="Sudah masuk stok tujuan." />
        <StatCard label="Qty Dikirim" value={pcs(data.summary.total_shipped_pcs)} description="Total dalam periode." />
        <StatCard label="Stok Bisa Dikirim" value={pcs(data.summary.total_stock_free_pcs)} description="Stok bebas sumber." />
      </section>

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">REQUEST CABANG</div>
            <h2 className="da-section-title">Buat Permintaan Barang</h2>
            <p className="da-section-desc">Request boleh dibuat saat stok masih 0. Approval dan DO baru bisa berjalan ketika stok sumber cukup.</p>
          </div>
          <Badge tone="warning">Belum Potong Stok</Badge>
        </div>

        <div className="da-form-grid da-form-grid-4">
          <label className="da-form-field">
            <span>Tanggal Request</span>
            <input type="date" value={requestDraft.request_date} onChange={(event) => setRequestDraft((current) => ({ ...current, request_date: event.target.value }))} />
          </label>
          <label className="da-form-field">
            <span>Dibutuhkan Tanggal</span>
            <input type="date" value={requestDraft.needed_date} onChange={(event) => setRequestDraft((current) => ({ ...current, needed_date: event.target.value }))} />
          </label>
          <label className="da-form-field">
            <span>Lokasi Sumber</span>
            <select value={requestDraft.source_location} disabled>
              <option value={tangerangLocation?.location_id || "TGR"}>Tangerang HO · TGR</option>
            </select>
          </label>
          <label className="da-form-field">
            <span>Lokasi Tujuan</span>
            <select
              value={requestDraft.destination_location}
              disabled={!isGlobal}
              onChange={(event) => setRequestDraft((current) => ({ ...current, destination_location: event.target.value }))}
            >
              <option value="">Pilih lokasi</option>
              {destinationOptions.map((location) => (
                <option key={location.location_id} value={location.location_id}>
                  {location.location_name} · {location.location_code}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="da-form-grid da-form-grid-4">
          <label className="da-form-field da-form-field-wide">
            <span>Produk</span>
            <select value={itemDraft.product_id} onChange={(event) => setItemDraft((current) => ({ ...current, product_id: event.target.value }))}>
              <option value="">Pilih produk</option>
              {data.products.map((product) => (
                <option key={product.product_id} value={product.product_id}>
                  {product.product_name} · stok bebas TGR {pcs(data.stock.find((row) => row.product_id === product.product_id)?.free_pcs || 0)}
                </option>
              ))}
            </select>
          </label>
          <label className="da-form-field">
            <span>Qty / Pcs</span>
            <input type="number" min="1" step="1" value={itemDraft.qty} onChange={(event) => setItemDraft((current) => ({ ...current, qty: event.target.value }))} placeholder="Contoh: 500" />
          </label>
          <div className="da-form-field">
            <span>&nbsp;</span>
            <Button variant="secondary" onClick={addRequestItem} disabled={saving}>Tambah ke Request</Button>
          </div>
        </div>

        <DataTable
          columns={[
            { key: "product_name", label: "Produk" },
            { key: "qty", label: "Diminta", render: (row) => pcs(row.qty) },
            { key: "free_pcs", label: "Stok Bebas Saat Ini", render: (row) => pcs(row.free_pcs) },
            {
              key: "action",
              label: "Aksi",
              render: (row) => <Button variant="primary" onClick={(event) => {
                event.stopPropagation();
                setRequestItems((current) => current.filter((item) => item.product_id !== row.product_id));
              }}>Hapus</Button>,
            },
          ]}
          rows={requestItems}
          getRowKey={(row) => row.product_id}
        />

        <div className="da-form-grid">
          <label className="da-form-field da-form-field-wide">
            <span>Catatan Request</span>
            <input value={requestDraft.notes} onChange={(event) => setRequestDraft((current) => ({ ...current, notes: event.target.value }))} />
          </label>
        </div>
        <div className="da-preview-strip">
          Tujuan: <strong>{selectedDestination?.location_name || "belum dipilih"}</strong> · {requestItems.length} produk · total {pcs(requestItems.reduce((sum, row) => sum + num(row.qty), 0))} · belum memengaruhi omzet, dompet, atau stok.
        </div>
        <div className="da-form-actions">
          <Button variant="secondary" onClick={() => setRequestItems([])} disabled={saving}>Reset Item</Button>
          <Button onClick={submitRequest} disabled={saving || loading || !data.health?.ready}>
            {saving ? "Menyimpan..." : "Simpan Request Barang"}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">FILTER & MONITOR</div>
            <h2 className="da-section-title">Request Barang yang Tercatat</h2>
            <p className="da-section-desc">Klik ID untuk approval, penolakan, pembatalan, atau pembuatan DO sesuai hak akun.</p>
          </div>
          <Badge tone="success">Live Data</Badge>
        </div>
        <div className="da-form-grid da-form-grid-4">
          <label className="da-form-field"><span>Mulai</span><input type="date" value={filter.date_start} onChange={(event) => setFilter((current) => ({ ...current, date_start: event.target.value }))} /></label>
          <label className="da-form-field"><span>Sampai</span><input type="date" value={filter.date_end} onChange={(event) => setFilter((current) => ({ ...current, date_end: event.target.value }))} /></label>
          <label className="da-form-field">
            <span>Tujuan</span>
            <select value={filter.destination_location} disabled={!isGlobal} onChange={(event) => setFilter((current) => ({ ...current, destination_location: event.target.value }))}>
              <option value="ALL">Semua lokasi</option>
              {destinationOptions.map((location) => <option key={location.location_id} value={location.location_id}>{location.location_name}</option>)}
            </select>
          </label>
          <label className="da-form-field">
            <span>Status</span>
            <select value={filter.status} onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value }))}>
              <option value="ALL">Semua</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="PARTIAL_RECEIVED">Diterima Sebagian</option>
              <option value="RECEIVED">Diterima</option>
              <option value="REJECTED">Ditolak</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </label>
        </div>
        <div className="da-form-actions"><Button variant="secondary" onClick={loadData} disabled={loading}>Tarik Data</Button></div>
        <DataTable columns={requestColumns} rows={data.requests} getRowKey={(row) => row.request_id} onRowClick={openRequest} />
      </Card>

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">DELIVERY ORDER</div>
            <h2 className="da-section-title">Kirim Barang & Penerimaan Cabang</h2>
            <p className="da-section-desc">Stock OUT terjadi ketika DO dibuat. Stock IN tujuan terjadi ketika cabang menekan terima.</p>
          </div>
          <Badge tone="warning">In Transit Tidak Dihitung Stok Cabang</Badge>
        </div>
        <DataTable columns={doColumns} rows={data.deliveryOrders} getRowKey={(row) => row.do_id} onRowClick={openDO} />
      </Card>

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">STOK SUMBER</div>
            <h2 className="da-section-title">Stok Tangerang yang Bisa Dikirim</h2>
            <p className="da-section-desc">Stok bebas adalah stok fisik dikurangi alokasi PO aktif.</p>
          </div>
          <Badge tone="success">Cost Layer PHP/MySQL</Badge>
        </div>
        <DataTable columns={stockColumns} rows={data.stock} getRowKey={(row) => `${row.location_id}-${row.product_id}`} />
      </Card>

      <Modal
        open={Boolean(selectedRequest)}
        title="Detail Request Barang"
        subtitle={selectedRequest?.request_id}
        onClose={() => setSelectedRequest(null)}
      >
        {selectedRequest ? (
          <div className="da-detail-stack">
            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-detail-label">Rute Barang</div>
                <div className="da-detail-value">{selectedRequest.source_location} → {selectedRequest.destination_location}</div>
                <p>Dibuat: <strong>{displayDate(selectedRequest.request_date)}</strong></p>
                <p>Dibutuhkan: <strong>{displayDate(selectedRequest.needed_date)}</strong></p>
              </div>
              <div className="da-detail-box">
                <div className="da-detail-label">Status</div>
                <div className="da-detail-value"><Badge tone={statusTone(selectedRequest.status)}>{selectedRequest.status}</Badge></div>
                <p>DO terkait: <strong>{text(selectedRequest.delivery_order_id)}</strong></p>
              </div>
            </div>
            <DataTable
              columns={[
                { key: "product_name", label: "Produk" },
                { key: "requested", label: "Diminta", render: (row) => pcs(row.qty_requested) },
                {
                  key: "approved",
                  label: "Qty Approval",
                  render: (row) => selectedRequest.status === "PENDING" && canApprove
                    ? <input type="number" min="1" max={num(row.qty_requested)} value={approvalQty[row.request_item_id] || ""} onChange={(event) => setApprovalQty((current) => ({ ...current, [row.request_item_id]: event.target.value }))} />
                    : pcs(row.qty_approved),
                },
                { key: "fulfilled", label: "Diterima", render: (row) => pcs(row.qty_fulfilled) },
              ]}
              rows={selectedRequest.items}
              getRowKey={(row) => row.request_item_id}
            />
            {selectedRequest.rejection_reason ? <div className="da-form-error">Alasan: {selectedRequest.rejection_reason}</div> : null}
            <div className="da-alert-note">Request bukan transaksi jual. Approval belum memotong stok. Stok baru keluar ketika DO dibuat.</div>
            <div className="da-form-actions">
              {selectedRequest.status === "PENDING" && canApprove ? <Button onClick={approveRequest} disabled={saving}>Approve Request</Button> : null}
              {selectedRequest.status === "PENDING" && canApprove ? <Button variant="primary" onClick={rejectRequest} disabled={saving}>Tolak</Button> : null}
              {selectedRequest.status === "PENDING" && !canApprove ? <Button variant="primary" onClick={cancelRequest} disabled={saving}>Batalkan Request</Button> : null}
              {selectedRequest.status === "APPROVED" && canCreateDO && !selectedRequest.delivery_order_id ? <Button onClick={createDO} disabled={saving}>Buat & Kirim DO</Button> : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(selectedDO)}
        title="Detail Delivery Order"
        subtitle={selectedDO?.do_id}
        onClose={() => setSelectedDO(null)}
      >
        {selectedDO ? (
          <div className="da-detail-stack">
            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-detail-label">Rute Barang</div>
                <div className="da-detail-value">{selectedDO.source_location} → {selectedDO.destination_location}</div>
                <p>Request: <strong>{selectedDO.request_id}</strong></p>
              </div>
              <div className="da-detail-box">
                <div className="da-detail-label">Status</div>
                <div className="da-detail-value"><Badge tone={statusTone(selectedDO.status)}>{selectedDO.status}</Badge></div>
                <p>Jumlah receipt: <strong>{selectedDO.receipts.length}</strong></p>
              </div>
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
                    ? <input type="number" min="0" max={Math.max(num(row.qty_shipped) - num(row.qty_received) - num(row.qty_difference), 0)} value={receiveQty[row.do_item_id] || "0"} onChange={(event) => setReceiveQty((current) => ({ ...current, [row.do_item_id]: event.target.value }))} />
                    : pcs(0),
                },
              ]}
              rows={selectedDO.items}
              getRowKey={(row) => row.do_item_id}
            />
            {canReceiveSelectedDO && ["IN_TRANSIT", "PARTIAL_RECEIVED"].includes(selectedDO.status) ? (
              <>
                <div className="da-form-grid da-form-grid-4">
                  <label className="da-form-field"><span>Tanggal Terima</span><input type="date" value={receiveForm.receipt_date} onChange={(event) => setReceiveForm((current) => ({ ...current, receipt_date: event.target.value }))} /></label>
                  <label className="da-form-field"><span>Bukti / Foto Referensi</span><input value={receiveForm.proof_reference} onChange={(event) => setReceiveForm((current) => ({ ...current, proof_reference: event.target.value }))} placeholder="Opsional: nama file / nomor bukti" /></label>
                  <label className="da-form-field da-form-field-wide"><span>Catatan</span><input value={receiveForm.notes} onChange={(event) => setReceiveForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                </div>
                <label className="da-form-field">
                  <span><input type="checkbox" checked={receiveForm.close_delivery} onChange={(event) => setReceiveForm((current) => ({ ...current, close_delivery: event.target.checked }))} /> Tutup DO meskipun ada kekurangan</span>
                </label>
                {receiveForm.close_delivery ? (
                  <label className="da-form-field da-form-field-wide"><span>Alasan Selisih</span><input value={receiveForm.discrepancy_reason} onChange={(event) => setReceiveForm((current) => ({ ...current, discrepancy_reason: event.target.value }))} placeholder="Wajib bila jumlah diterima kurang" /></label>
                ) : null}
                <div className="da-form-actions"><Button onClick={receiveDO} disabled={saving}>Konfirmasi Penerimaan</Button></div>
              </>
            ) : null}
            <div className="da-alert-note">Rantai arsip: Request ID → DO ID → Stock OUT sumber → Receipt ID → Stock IN tujuan. HPP historis tidak dihitung ulang.</div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
