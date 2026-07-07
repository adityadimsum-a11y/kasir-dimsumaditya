import { useEffect, useMemo, useState } from "react";
import {
  approveBranchGoodsRequest,
  createBranchGoodsRequest,
  createDeliveryOrderFromRequest,
  getRequestDOStockBootstrap,
  receiveDeliveryOrder,
} from "../../lib/api/actions";
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
  const parsed = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
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

function normalizeStock(row) {
  return {
    ...row,
    stock_key: row.stock_key || row.product_id || row.product_code || row.product_name || "",
    location_code: row.location_code || row.location_id || "TGR",
    product_id: row.product_id || row.id || "",
    product_code: row.product_code || row.code || "",
    product_name: row.product_name || row.name || row.item_name || "Produk",
    total_pcs: numberValue(row.total_pcs || row.stock_pcs || row.qty_pcs || row.qty || 0),
    held_pcs: numberValue(row.held_pcs || row.reserved_pcs || row.allocated_pcs || 0),
    free_pcs: numberValue(row.free_pcs || row.available_pcs || row.ready_pcs || 0),
    avg_unit_cost: numberValue(row.avg_unit_cost || row.unit_cost || row.hpp_per_pcs || 0),
  };
}

function normalizeRequest(row) {
  return {
    ...row,
    request_id: row.request_id || row.branch_request_id || row.id || "",
    request_date: row.request_date || row.date || row.created_at || "",
    needed_date: row.needed_date || row.target_date || row.due_date || "",
    source_location: row.source_location || row.from_location || row.from_location_code || "TGR",
    destination_location: row.destination_location || row.to_location || row.to_location_code || "",
    product_id: row.product_id || "",
    product_code: row.product_code || "",
    product_name: row.product_name || row.item_name || "Produk",
    qty_pcs: numberValue(row.qty_pcs || row.qty || row.quantity || 0),
    approved_qty_pcs: numberValue(row.approved_qty_pcs || row.qty_approved || 0),
    status: row.status || "PENDING",
    notes: row.notes || row.catatan || "",
    delivery_order_id: row.delivery_order_id || row.do_id || "",
  };
}

function normalizeDO(row) {
  return {
    ...row,
    do_id: row.do_id || row.delivery_order_id || row.id || "",
    request_id: row.request_id || row.branch_request_id || "",
    do_date: row.do_date || row.delivery_date || row.date || row.created_at || "",
    source_location: row.source_location || row.from_location || row.from_location_code || "TGR",
    destination_location: row.destination_location || row.to_location || row.to_location_code || "",
    product_id: row.product_id || "",
    product_code: row.product_code || "",
    product_name: row.product_name || row.item_name || "Produk",
    qty_pcs: numberValue(row.qty_pcs || row.shipped_qty_pcs || row.qty || 0),
    received_qty_pcs: numberValue(row.received_qty_pcs || row.qty_received || 0),
    status: row.status || "DRAFT",
    notes: row.notes || row.catatan || "",
  };
}

function normalizeLocation(row) {
  return {
    id: row.location_id || row.id || row.location_code || row.code || "",
    code: row.location_code || row.code || row.location_id || row.id || "",
    name: row.location_name || row.name || row.nama || row.location_code || row.code || "Lokasi",
    type: row.location_type || row.type || "",
  };
}

function normalizeBootstrap(payload) {
  const data = payload?.data || payload || {};
  const stock = asArray(data.finished_stock || data.stock_ready || data.stock || []).map(normalizeStock);
  const requests = asArray(data.branch_requests || data.requests || []).map(normalizeRequest);
  const deliveryOrders = asArray(data.delivery_orders || data.dos || data.deliveryOrders || []).map(normalizeDO);
  const locations = asArray(data.locations || data.location_options || []).map(normalizeLocation);

  return {
    summary: {
      total_stock_free_pcs: numberValue(data.summary?.total_stock_free_pcs),
      pending_request_count: numberValue(data.summary?.pending_request_count),
      approved_request_count: numberValue(data.summary?.approved_request_count),
      in_transit_do_count: numberValue(data.summary?.in_transit_do_count),
      received_do_count: numberValue(data.summary?.received_do_count),
      total_requested_pcs: numberValue(data.summary?.total_requested_pcs),
      total_shipped_pcs: numberValue(data.summary?.total_shipped_pcs),
      total_received_pcs: numberValue(data.summary?.total_received_pcs),
    },
    stock,
    requests,
    deliveryOrders,
    locations,
    filter: data.filter || {},
    warnings: asArray(data.warnings),
  };
}

function badgeTone(status) {
  const text = String(status || "").toLowerCase();
  if (text.includes("receive") || text.includes("terima") || text.includes("approved") || text.includes("posted")) return "success";
  if (text.includes("reject") || text.includes("cancel") || text.includes("batal")) return "danger";
  if (text.includes("transit") || text.includes("pending") || text.includes("draft")) return "warning";
  return "default";
}

export default function RequestDOPage({ session, onSessionExpired }) {
  const today = todayInputValue();
  const defaultLocation = session?.user?.location_code || session?.user?.location_id || "TGR";
  const sessionToken = session?.sessionToken || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [bootstrap, setBootstrap] = useState(() => normalizeBootstrap({}));
  const [filter, setFilter] = useState(() => ({
    date_start: today,
    date_end: today,
    source_location: "TGR",
    destination_location: defaultLocation,
    status: "ALL",
  }));
  const [draft, setDraft] = useState(() => ({
    request_date: today,
    needed_date: today,
    source_location: "TGR",
    destination_location: defaultLocation === "TGR" ? "CBN" : defaultLocation,
    product_key: "",
    qty_pcs: "100",
    request_by: session?.user?.name || "",
    notes: "Request barang cabang dari stok pusat.",
  }));
  const [selected, setSelected] = useState(null);
  const [selectedType, setSelectedType] = useState("request");

  const selectedStock = useMemo(() => {
    return bootstrap.stock.find((row) => row.stock_key === draft.product_key) || bootstrap.stock[0] || null;
  }, [bootstrap.stock, draft.product_key]);

  const locationOptions = useMemo(() => {
    const defaults = [
      { id: "TGR", code: "TGR", name: "Tangerang HO" },
      { id: "PML", code: "PML", name: "Produksi Pemalang" },
      { id: "CBN", code: "CBN", name: "Resto Cibinong" },
    ];
    const merged = [...bootstrap.locations, ...defaults];
    const seen = new Set();
    return merged.filter((location) => {
      const key = location.code || location.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [bootstrap.locations]);

  const qtyDraft = numberValue(draft.qty_pcs);
  const freePcs = numberValue(selectedStock?.free_pcs);
  const shortagePreview = Math.max(qtyDraft - freePcs, 0);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getRequestDOStockBootstrap(sessionToken, filter);

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      if (!result?.success) {
        setError(result?.message || "Gagal membaca Request & DO.");
        return;
      }

      const normalized = normalizeBootstrap(result.data || result);
      setBootstrap(normalized);
      setDraft((current) => ({
        ...current,
        product_key: current.product_key || normalized.stock[0]?.stock_key || "",
      }));
    } catch (err) {
      setError(err?.message || "Gagal membaca Request & DO.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateRequest = async () => {
    setError("");
    setSuccess("");

    if (!draft.destination_location) {
      setError("Cabang tujuan wajib dipilih.");
      return;
    }
    if (!selectedStock) {
      setError("Produk stok pusat wajib dipilih.");
      return;
    }
    if (!qtyDraft || qtyDraft <= 0) {
      setError("Qty request wajib lebih dari 0 pcs.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...draft,
        product_id: selectedStock.product_id,
        product_code: selectedStock.product_code,
        product_name: selectedStock.product_name,
        available_pcs: selectedStock.free_pcs,
        qty_pcs: qtyDraft,
      };
      const result = await createBranchGoodsRequest(sessionToken, payload);

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      if (!result?.success) {
        setError(result?.message || "Gagal membuat request barang.");
        return;
      }

      setSuccess(result.message || "Request barang berhasil dibuat dan menunggu approval Tangerang.");
      setDraft((current) => ({
        ...current,
        qty_pcs: "100",
        notes: "Request barang cabang dari stok pusat.",
      }));
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal membuat request barang.");
    } finally {
      setSaving(false);
    }
  };

  const runRequestAction = async (actionName, request) => {
    const requestId = request?.request_id;
    if (!requestId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      let result;
      if (actionName === "approve") {
        result = await approveBranchGoodsRequest(sessionToken, {
          request_id: requestId,
          approved_qty_pcs: request.qty_pcs,
          notes: "Approved oleh owner/Tangerang.",
        });
      } else {
        result = await createDeliveryOrderFromRequest(sessionToken, {
          request_id: requestId,
          do_date: today,
          notes: "DO dibuat dari request barang cabang.",
        });
      }

      if (!result?.success) {
        setError(result?.message || "Aksi request gagal.");
        return;
      }
      setSuccess(result.message || "Aksi request berhasil.");
      setSelected(null);
      await loadData();
    } catch (err) {
      setError(err?.message || "Aksi request gagal.");
    } finally {
      setSaving(false);
    }
  };

  const handleReceiveDO = async (deliveryOrder) => {
    const doId = deliveryOrder?.do_id;
    if (!doId) return;
    if (!window.confirm(`Terima DO ${doId}? Stok cabang akan bertambah sesuai qty DO.`)) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await receiveDeliveryOrder(sessionToken, {
        do_id: doId,
        received_date: today,
        received_qty_pcs: deliveryOrder.qty_pcs,
        notes: "Barang diterima cabang.",
      });
      if (!result?.success) {
        setError(result?.message || "Gagal menerima DO.");
        return;
      }
      setSuccess(result.message || "DO sudah diterima. Stok cabang bertambah dan In Transit ditutup.");
      setSelected(null);
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal menerima DO.");
    } finally {
      setSaving(false);
    }
  };

  const requestColumns = [
    { key: "request_date", label: "Tanggal", render: (row) => formatDisplayDate(row.request_date) },
    { key: "request_id", label: "Request ID", render: (row) => <strong>{safeText(row.request_id)}</strong> },
    { key: "destination_location", label: "Tujuan" },
    { key: "product_name", label: "Produk" },
    { key: "qty_pcs", label: "Qty", render: (row) => `${row.qty_pcs.toLocaleString("id-ID")} pcs` },
    { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{safeText(row.status)}</Badge> },
    {
      key: "aksi",
      label: "Aksi",
      render: (row) => (
        <Button
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedType("request");
            setSelected(row);
          }}
        >
          Detail
        </Button>
      ),
    },
  ];

  const doColumns = [
    { key: "do_date", label: "Tanggal", render: (row) => formatDisplayDate(row.do_date) },
    { key: "do_id", label: "DO ID", render: (row) => <strong>{safeText(row.do_id)}</strong> },
    { key: "destination_location", label: "Tujuan" },
    { key: "product_name", label: "Produk" },
    { key: "qty_pcs", label: "Dikirim", render: (row) => `${row.qty_pcs.toLocaleString("id-ID")} pcs` },
    { key: "received_qty_pcs", label: "Diterima", render: (row) => `${row.received_qty_pcs.toLocaleString("id-ID")} pcs` },
    { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{safeText(row.status)}</Badge> },
  ];

  const stockColumns = [
    { key: "product_name", label: "Produk", render: (row) => <strong>{safeText(row.product_name)}</strong> },
    { key: "location_code", label: "Lokasi" },
    { key: "total_pcs", label: "Total", render: (row) => `${row.total_pcs.toLocaleString("id-ID")} pcs` },
    { key: "held_pcs", label: "Ditahan", render: (row) => `${row.held_pcs.toLocaleString("id-ID")} pcs` },
    { key: "free_pcs", label: "Stok Bebas", render: (row) => `${row.free_pcs.toLocaleString("id-ID")} pcs` },
  ];

  return (
    <>
      <PageHeader
        eyebrow="DIMSUM ADITYA"
        title="Request Barang & DO"
        description="Cabang minta barang ke Tangerang, owner approve, lalu DO mengirim stok antar lokasi. Ini bukan PO customer dan bukan uang masuk."
        badge="Request + DO"
      />

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">BARANG ANTAR LOKASI</div>
            <h2 className="da-section-title">Request Cabang → Approve Tangerang → DO → Receive</h2>
            <p className="da-section-desc">
              Modul ini memisahkan permintaan barang cabang dari Antrian PO Customer supaya tidak tercampur dengan invoice, piutang, dan uang masuk.
            </p>
          </div>
          <div className="da-header-actions">
            <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Cek" : "Terhubung"}</Badge>
            <Button variant="secondary" onClick={loadData} disabled={loading || saving}>Refresh Data</Button>
          </div>
        </div>
        {error ? <div className="da-form-error">{error}</div> : null}
        {success ? <div className="da-form-success">{success}</div> : null}
      </Card>

      <section className="da-stat-grid da-stat-grid-3">
        <StatCard label="Request Pending" value={bootstrap.summary.pending_request_count.toLocaleString("id-ID")} tone="warning" description="Menunggu owner/Tangerang approve." />
        <StatCard label="Request Approved" value={bootstrap.summary.approved_request_count.toLocaleString("id-ID")} tone="success" description="Siap dibuat DO." />
        <StatCard label="DO In Transit" value={bootstrap.summary.in_transit_do_count.toLocaleString("id-ID")} tone="warning" description="Barang sudah dikirim, belum diterima." />
        <StatCard label="DO Diterima" value={bootstrap.summary.received_do_count.toLocaleString("id-ID")} tone="success" description="Barang sudah masuk cabang." />
        <StatCard label="Qty Diminta" value={`${bootstrap.summary.total_requested_pcs.toLocaleString("id-ID")} pcs`} description="Total request dalam filter." />
        <StatCard label="Stok Bebas Pusat" value={`${bootstrap.summary.total_stock_free_pcs.toLocaleString("id-ID")} pcs`} description="Bahan cek sebelum kirim barang." />
      </section>

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">FILTER</div>
            <h2 className="da-section-title">Pantau Request & DO</h2>
            <p className="da-section-desc">Gunakan tanggal dan lokasi supaya request cabang tidak tercampur.</p>
          </div>
          <Badge tone="warning">Bukan Uang Masuk</Badge>
        </div>
        <div className="da-form-grid da-form-grid-4">
          <label className="da-form-field">
            <span>Tanggal Mulai</span>
            <input type="date" value={filter.date_start} onChange={(event) => setFilter((current) => ({ ...current, date_start: event.target.value }))} />
          </label>
          <label className="da-form-field">
            <span>Tanggal Sampai</span>
            <input type="date" value={filter.date_end} onChange={(event) => setFilter((current) => ({ ...current, date_end: event.target.value }))} />
          </label>
          <label className="da-form-field">
            <span>Cabang Tujuan</span>
            <select value={filter.destination_location} onChange={(event) => setFilter((current) => ({ ...current, destination_location: event.target.value }))}>
              <option value="ALL">Semua Cabang</option>
              {locationOptions.map((location) => <option key={location.code} value={location.code}>{location.name} · {location.code}</option>)}
            </select>
          </label>
          <label className="da-form-field">
            <span>Status</span>
            <select value={filter.status} onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value }))}>
              <option value="ALL">Semua</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="RECEIVED">Received</option>
            </select>
          </label>
        </div>
        <div className="da-form-actions">
          <Button variant="secondary" onClick={loadData} disabled={loading}>Tarik Data</Button>
        </div>
      </Card>

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">INPUT REQUEST</div>
            <h2 className="da-section-title">Buat Request Barang Cabang</h2>
            <p className="da-section-desc">Cabang/outlet minta barang ke Tangerang. Approval pusat dulu, baru dibuat DO kirim barang.</p>
          </div>
          <Badge tone="warning">Menunggu Approval</Badge>
        </div>

        <div className="da-form-grid da-form-grid-3">
          <label className="da-form-field">
            <span>Tanggal Request</span>
            <input type="date" value={draft.request_date} onChange={(event) => setDraft((current) => ({ ...current, request_date: event.target.value }))} />
          </label>
          <label className="da-form-field">
            <span>Tanggal Butuh</span>
            <input type="date" value={draft.needed_date} onChange={(event) => setDraft((current) => ({ ...current, needed_date: event.target.value }))} />
          </label>
          <label className="da-form-field">
            <span>Dari Lokasi</span>
            <select value={draft.source_location} onChange={(event) => setDraft((current) => ({ ...current, source_location: event.target.value }))}>
              {locationOptions.map((location) => <option key={location.code} value={location.code}>{location.name} · {location.code}</option>)}
            </select>
          </label>
          <label className="da-form-field">
            <span>Cabang Tujuan</span>
            <select value={draft.destination_location} onChange={(event) => setDraft((current) => ({ ...current, destination_location: event.target.value }))}>
              {locationOptions.map((location) => <option key={location.code} value={location.code}>{location.name} · {location.code}</option>)}
            </select>
          </label>
          <label className="da-form-field">
            <span>Produk Stok Pusat</span>
            <select value={draft.product_key} onChange={(event) => setDraft((current) => ({ ...current, product_key: event.target.value }))}>
              {bootstrap.stock.length === 0 ? <option value="">Belum ada stok ready</option> : null}
              {bootstrap.stock.map((stock) => (
                <option key={`${stock.location_code}-${stock.stock_key}`} value={stock.stock_key}>{stock.product_name} · bebas {stock.free_pcs.toLocaleString("id-ID")} pcs</option>
              ))}
            </select>
          </label>
          <label className="da-form-field">
            <span>Qty Request (pcs)</span>
            <input inputMode="numeric" value={draft.qty_pcs} onChange={(event) => setDraft((current) => ({ ...current, qty_pcs: event.target.value }))} />
          </label>
          <label className="da-form-field">
            <span>PIC / Peminta</span>
            <input value={draft.request_by} onChange={(event) => setDraft((current) => ({ ...current, request_by: event.target.value }))} />
          </label>
          <label className="da-form-field da-form-field-wide">
            <span>Catatan</span>
            <input value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
          </label>
        </div>

        <div className="da-preview-strip">
          <strong>Preview:</strong> request {qtyDraft.toLocaleString("id-ID")} pcs · stok bebas sumber {freePcs.toLocaleString("id-ID")} pcs · potensi kurang {shortagePreview.toLocaleString("id-ID")} pcs · belum potong stok sebelum DO dibuat.
        </div>

        <div className="da-form-actions">
          <Button variant="secondary" onClick={() => setDraft({ request_date: today, needed_date: today, source_location: "TGR", destination_location: defaultLocation === "TGR" ? "CBN" : defaultLocation, product_key: bootstrap.stock[0]?.stock_key || "", qty_pcs: "100", request_by: session?.user?.name || "", notes: "Request barang cabang dari stok pusat." })} disabled={saving}>Reset</Button>
          <Button onClick={handleCreateRequest} disabled={saving || loading}>{saving ? "Menyimpan..." : "Simpan Request"}</Button>
        </div>
      </Card>

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">REQUEST BARANG</div>
            <h2 className="da-section-title">Permintaan Cabang yang Tercatat</h2>
            <p className="da-section-desc">Klik detail untuk approve atau buat DO dari request yang sudah disetujui.</p>
          </div>
          <Badge tone="warning">Approval Pusat</Badge>
        </div>
        <DataTable columns={requestColumns} rows={bootstrap.requests} getRowKey={(row) => row.request_id} />
      </Card>

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">DO ANTAR LOKASI</div>
            <h2 className="da-section-title">Delivery Order / Kirim Barang</h2>
            <p className="da-section-desc">DO mengurangi stok sumber dan menambah stok In Transit. Receive menambah stok cabang.</p>
          </div>
          <Badge tone="success">Traceable</Badge>
        </div>
        <DataTable columns={doColumns} rows={bootstrap.deliveryOrders} getRowKey={(row) => row.do_id} onRowClick={(row) => { setSelectedType("do"); setSelected(row); }} />
      </Card>

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">STOK SUMBER</div>
            <h2 className="da-section-title">Stok Ready untuk Kirim</h2>
            <p className="da-section-desc">Ringkas stok yang bisa jadi bahan request dan DO.</p>
          </div>
          <Badge tone="success">Live Data</Badge>
        </div>
        <DataTable columns={stockColumns} rows={bootstrap.stock} getRowKey={(row) => `${row.location_code}-${row.stock_key}`} />
      </Card>

      <Modal
        open={Boolean(selected)}
        title={selectedType === "do" ? "Detail DO Antar Lokasi" : "Detail Request Barang"}
        subtitle={selectedType === "do" ? selected?.do_id : selected?.request_id}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="da-detail-stack">
            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-detail-label">Rantai Lokasi</div>
                <div className="da-detail-value">{safeText(selected.source_location)} → {safeText(selected.destination_location)}</div>
                <p>Produk: <strong>{safeText(selected.product_name)}</strong></p>
                <p>Qty: <strong>{numberValue(selected.qty_pcs).toLocaleString("id-ID")} pcs</strong></p>
              </div>
              <div className="da-detail-box">
                <div className="da-detail-label">Status</div>
                <div className="da-detail-value"><Badge tone={badgeTone(selected.status)}>{safeText(selected.status)}</Badge></div>
                <p>Request ID: <strong>{safeText(selected.request_id)}</strong></p>
                <p>DO ID: <strong>{safeText(selected.do_id || selected.delivery_order_id)}</strong></p>
              </div>
            </div>

            <div className="da-alert-note">
              Rantai ini harus bisa ditelusuri: Request Barang Cabang → Approval Tangerang → DO Antar Lokasi → Stock OUT sumber → In Transit → Receive Barang Cabang.
            </div>

            {selectedType === "request" ? (
              <div className="da-form-actions">
                {String(selected.status || "").toUpperCase() === "PENDING" ? (
                  <Button onClick={() => runRequestAction("approve", selected)} disabled={saving}>Approve Request</Button>
                ) : null}
                {String(selected.status || "").toUpperCase() === "APPROVED" && !selected.delivery_order_id ? (
                  <Button onClick={() => runRequestAction("do", selected)} disabled={saving}>Buat DO Kirim Barang</Button>
                ) : null}
              </div>
            ) : (
              <div className="da-form-actions">
                {String(selected.status || "").toUpperCase() === "IN_TRANSIT" ? (
                  <Button onClick={() => handleReceiveDO(selected)} disabled={saving}>Receive / Terima Barang</Button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
