import { useEffect, useMemo, useState } from "react";
import {
  cancelPOQueue,
  createPOQueue,
  getPOQueueBootstrap,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
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
    location_id: row.location_id || row.location_code || "",
    product_id: row.product_id || row.id || "",
    product_code: row.product_code || row.code || "",
    product_name: row.product_name || row.name || row.item_name || "Produk",
    total_pcs: numberValue(row.total_pcs || row.stock_pcs || row.qty_pcs || row.qty || 0),
    held_pcs: numberValue(row.held_pcs || row.reserved_pcs || row.allocated_pcs || 0),
    free_pcs: numberValue(row.free_pcs || row.available_pcs || row.ready_pcs || 0),
    avg_unit_cost: numberValue(row.avg_unit_cost || row.unit_cost || row.hpp_per_pcs || 0),
    stock_value: numberValue(row.stock_value || 0),
  };
}

function normalizeCustomer(row) {
  return {
    id: row.customer_id || row.id || row.code || "",
    name: row.customer_name || row.name || row.nama || row.customer || "Customer",
    phone: row.phone || row.phone_number || row.whatsapp || "",
  };
}

function normalizePO(row) {
  const allocation = asArray(row.allocations || row.stock_allocations).map(normalizeAllocation);
  return {
    ...row,
    po_id: row.po_id || row.order_queue_id || row.id || "",
    po_date: row.po_date || row.order_date || row.date || row.created_at || "",
    target_date: row.target_date || row.due_date || row.pickup_date || "",
    po_type: row.po_type || row.order_type || "PO Harian",
    customer_id: row.customer_id || "",
    customer_name: row.customer_name || row.customer || "Customer",
    product_id: row.product_id || "",
    product_code: row.product_code || "",
    product_name: row.product_name || row.item_name || "Produk",
    qty_pcs: numberValue(row.qty_pcs || row.required_qty_pcs || row.qty || 0),
    reserved_pcs: numberValue(row.reserved_pcs || row.qty_reserved || row.qty_allocated || row.allocated_qty || 0),
    shortage_pcs: numberValue(row.shortage_pcs || row.qty_shortage || 0),
    unit_price: numberValue(row.unit_price || row.price || 0),
    total_amount: numberValue(row.total_amount || row.amount || 0),
    status: row.status || row.po_status || "PENDING",
    allocation_status: row.allocation_status || row.reservation_status || "PENDING",
    notes: row.notes || row.catatan || "",
    allocations: allocation,
  };
}

function normalizeAllocation(row) {
  return {
    ...row,
    allocation_id: row.allocation_id || row.id || "",
    allocation_date: row.allocation_date || row.created_at || "",
    po_id: row.po_id || row.source_id || "",
    product_name: row.product_name || row.item_name || "Produk",
    qty_allocated: numberValue(row.qty_allocated || row.allocated_qty || row.reserved_qty || row.qty || 0),
    status: row.status || "RESERVED",
  };
}

function normalizeBootstrap(payload) {
  const data = payload?.data || payload || {};
  const pos = asArray(data.po_queue || data.pos || data.purchase_orders || data.orders).map(normalizePO);
  const allocations = asArray(data.stock_allocations || data.allocations).map(normalizeAllocation);

  return {
    summary: {
      total_po: numberValue(data.summary?.total_po || pos.length),
      pending_count: numberValue(data.summary?.pending_count),
      reserved_count: numberValue(data.summary?.reserved_count),
      shortage_count: numberValue(data.summary?.shortage_count),
      total_required_pcs: numberValue(data.summary?.total_required_pcs),
      total_reserved_pcs: numberValue(data.summary?.total_reserved_pcs),
      total_shortage_pcs: numberValue(data.summary?.total_shortage_pcs),
      total_free_pcs: numberValue(data.summary?.total_free_pcs),
    },
    stock: asArray(data.finished_stock || data.stock_ready || data.products_stock).map(normalizeStock),
    customers: asArray(data.customers || data.customer_options).map(normalizeCustomer),
    pos,
    allocations,
    warnings: asArray(data.warnings),
    filter: data.filter || {},
  };
}

function badgeTone(status) {
  const text = String(status || "").toLowerCase();
  if (text.includes("full") || text.includes("reserved") || text.includes("siap") || text.includes("post")) return "success";
  if (text.includes("short") || text.includes("kurang") || text.includes("batal") || text.includes("cancel")) return "danger";
  if (text.includes("partial") || text.includes("pending") || text.includes("tahan")) return "warning";
  return "default";
}

const PO_COLUMNS = [
  { key: "po_date", label: "Tanggal", render: (row) => formatDisplayDate(row.po_date) },
  { key: "po_id", label: "PO ID", render: (row) => <strong>{safeText(row.po_id)}</strong> },
  { key: "customer_name", label: "Customer" },
  { key: "product_name", label: "Produk" },
  { key: "qty_pcs", label: "Qty", render: (row) => `${numberValue(row.qty_pcs).toLocaleString("id-ID")} pcs` },
  { key: "reserved_pcs", label: "Ditahan", render: (row) => `${numberValue(row.reserved_pcs).toLocaleString("id-ID")} pcs` },
  { key: "shortage_pcs", label: "Kurang", render: (row) => `${numberValue(row.shortage_pcs).toLocaleString("id-ID")} pcs` },
  { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{safeText(row.status)}</Badge> },
];

const STOCK_COLUMNS = [
  { key: "product_name", label: "Produk", render: (row) => <strong>{safeText(row.product_name)}</strong> },
  { key: "total_pcs", label: "Total", render: (row) => `${numberValue(row.total_pcs).toLocaleString("id-ID")} pcs` },
  { key: "held_pcs", label: "Ditahan PO", render: (row) => `${numberValue(row.held_pcs).toLocaleString("id-ID")} pcs` },
  { key: "free_pcs", label: "Stok Bebas", render: (row) => `${numberValue(row.free_pcs).toLocaleString("id-ID")} pcs` },
  { key: "avg_unit_cost", label: "Modal/pcs", render: (row) => formatRupiah(row.avg_unit_cost) },
];

export default function POQueuePage({ session, onSessionExpired }) {
  const today = todayInputValue();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [bootstrap, setBootstrap] = useState(() => normalizeBootstrap({}));
  const [filter, setFilter] = useState(() => ({
    date_start: today,
    date_end: today,
    location_code: session?.user?.location_code || session?.user?.location_id || "TGR",
    status: "ALL",
  }));
  const [draft, setDraft] = useState(() => ({
    po_date: today,
    target_date: today,
    po_type: "PO Harian",
    customer_id: "",
    customer_name: "",
    product_key: "",
    qty_pcs: "100",
    unit_price: "0",
    notes: "PO ditahan dari stok ready jika tersedia.",
  }));
  const [selectedPO, setSelectedPO] = useState(null);
  const sessionToken = session?.sessionToken || "";

  const selectedStock = useMemo(() => {
    return bootstrap.stock.find((row) => row.stock_key === draft.product_key) || bootstrap.stock[0] || null;
  }, [bootstrap.stock, draft.product_key]);

  const selectedCustomer = useMemo(() => {
    return bootstrap.customers.find((row) => row.id === draft.customer_id) || null;
  }, [bootstrap.customers, draft.customer_id]);

  const qtyDraft = numberValue(draft.qty_pcs);
  const freePcs = numberValue(selectedStock?.free_pcs);
  const reservedPreview = Math.min(qtyDraft, freePcs);
  const shortagePreview = Math.max(qtyDraft - freePcs, 0);
  const nominalPreview = qtyDraft * numberValue(draft.unit_price);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getPOQueueBootstrap(sessionToken, filter);

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      if (!result?.success) {
        setError(result?.message || "Gagal membaca Antrian PO.");
        return;
      }

      const normalized = normalizeBootstrap(result.data || result);
      setBootstrap(normalized);
      setDraft((current) => ({
        ...current,
        product_key: current.product_key || normalized.stock[0]?.stock_key || "",
      }));
    } catch (err) {
      setError(err?.message || "Gagal membaca Antrian PO.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!selectedStock) {
      setError("Produk stok ready wajib dipilih.");
      return;
    }
    if (!qtyDraft || qtyDraft <= 0) {
      setError("Qty PO wajib lebih dari 0 pcs.");
      return;
    }
    if (!draft.customer_name && !selectedCustomer?.name) {
      setError("Customer wajib diisi/dipilih.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...draft,
        ...filter,
        customer_id: draft.customer_id || selectedCustomer?.id || "",
        customer_name: draft.customer_name || selectedCustomer?.name || "",
        product_id: selectedStock.product_id,
        product_code: selectedStock.product_code,
        product_name: selectedStock.product_name,
        product_key: selectedStock.stock_key,
        available_pcs: selectedStock.free_pcs,
        qty_pcs: qtyDraft,
        unit_price: numberValue(draft.unit_price),
      };
      const result = await createPOQueue(sessionToken, payload);

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      if (!result?.success) {
        setError(result?.message || "Gagal menyimpan PO.");
        return;
      }

      setSuccess(result.message || "PO berhasil dicatat dan stok ditahan sesuai stok tersedia.");
      setDraft((current) => ({
        ...current,
        customer_id: "",
        customer_name: "",
        qty_pcs: "100",
        unit_price: "0",
        notes: "PO ditahan dari stok ready jika tersedia.",
      }));
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal menyimpan PO.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (po) => {
    const poId = po?.po_id;
    if (!poId) return;
    if (!window.confirm(`Batalkan PO ${poId}? Stok yang ditahan akan dilepas.`)) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await cancelPOQueue(sessionToken, { po_id: poId, notes: "PO dibatalkan dari Antrian PO." });
      if (!result?.success) {
        setError(result?.message || "Gagal membatalkan PO.");
        return;
      }
      setSuccess(result.message || "PO dibatalkan dan stok ditahan dilepas.");
      setSelectedPO(null);
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal membatalkan PO.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="DIMSUM ADITYA"
        title="Antrian PO"
        description="Catat PO harian/besar, tahan stok ready jika tersedia, dan tampilkan kekurangan produksi tanpa mencampur dengan kasir biasa."
        badge="Live Reserve"
      />

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">PO & STOK DITAHAN</div>
            <h2 className="da-section-title">Order Dulu → Tahan Stok → Siap Kirim</h2>
            <p className="da-section-desc">
              PO tidak membuat uang masuk dan tidak membuat invoice otomatis. PO hanya mencatat kebutuhan customer dan memisahkan stok bebas dengan stok ditahan.
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
        <StatCard label="Stok Bebas" value={`${bootstrap.summary.total_free_pcs.toLocaleString("id-ID")} pcs`} description="Stok ready yang belum ditahan PO." />
        <StatCard label="Stok Ditahan PO" value={`${bootstrap.summary.total_reserved_pcs.toLocaleString("id-ID")} pcs`} tone="warning" description="Stok yang sudah dipisahkan untuk PO." />
        <StatCard label="Kekurangan PO" value={`${bootstrap.summary.total_shortage_pcs.toLocaleString("id-ID")} pcs`} tone="danger" description="Butuh produksi/ambil stok tambahan." />
        <StatCard label="Jumlah PO" value={bootstrap.summary.total_po.toLocaleString("id-ID")} description="PO aktif dalam filter." />
        <StatCard label="PO Siap" value={bootstrap.summary.reserved_count.toLocaleString("id-ID")} tone="success" description="Stok penuh atau sebagian tertahan." />
        <StatCard label="PO Kurang" value={bootstrap.summary.shortage_count.toLocaleString("id-ID")} tone="warning" description="Perlu dipantau owner/admin." />
      </section>

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">FILTER</div>
            <h2 className="da-section-title">Pantau Antrian PO</h2>
            <p className="da-section-desc">Gunakan tanggal target/pickup supaya PO hari ini dan PO besar tidak bercampur.</p>
          </div>
          <Badge tone="warning">Tidak Potong Dompet</Badge>
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
            <span>Lokasi/Cabang</span>
            <input value={filter.location_code} onChange={(event) => setFilter((current) => ({ ...current, location_code: event.target.value }))} />
          </label>
          <label className="da-form-field">
            <span>Status</span>
            <select value={filter.status} onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value }))}>
              <option value="ALL">Semua</option>
              <option value="FULL_RESERVED">Siap / Full Reserved</option>
              <option value="PARTIAL_RESERVED">Sebagian Ditahan</option>
              <option value="SHORTAGE">Kurang Stok</option>
              <option value="CANCELED">Batal</option>
            </select>
          </label>
        </div>

        <div className="da-form-actions">
          <Button variant="secondary" onClick={loadData} disabled={loading}>Tarik Antrian</Button>
        </div>
      </Card>

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">INPUT LIVE</div>
            <h2 className="da-section-title">Tambah PO / Stok Ditahan</h2>
            <p className="da-section-desc">Simpan PO akan membuat catatan PO. Jika stok bebas tersedia, sistem membuat alokasi stok ditahan.</p>
          </div>
          <Badge tone="warning">Reserve Stok</Badge>
        </div>

        <div className="da-form-grid da-form-grid-3">
          <label className="da-form-field">
            <span>Tanggal PO</span>
            <input type="date" value={draft.po_date} onChange={(event) => setDraft((current) => ({ ...current, po_date: event.target.value }))} />
          </label>
          <label className="da-form-field">
            <span>Tanggal Ambil / Target</span>
            <input type="date" value={draft.target_date} onChange={(event) => setDraft((current) => ({ ...current, target_date: event.target.value }))} />
          </label>
          <label className="da-form-field">
            <span>Tipe PO</span>
            <select value={draft.po_type} onChange={(event) => setDraft((current) => ({ ...current, po_type: event.target.value }))}>
              <option>PO Harian</option>
              <option>PO Besar</option>
              <option>PO Karantina</option>
              <option>PO Cabang</option>
            </select>
          </label>
          <label className="da-form-field">
            <span>Pilih Customer Lama</span>
            <select value={draft.customer_id} onChange={(event) => setDraft((current) => ({ ...current, customer_id: event.target.value, customer_name: "" }))}>
              <option value="">Input manual / customer baru</option>
              {bootstrap.customers.map((customer) => (
                <option key={customer.id || customer.name} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </label>
          <label className="da-form-field">
            <span>Nama Customer</span>
            <input value={draft.customer_name || selectedCustomer?.name || ""} onChange={(event) => setDraft((current) => ({ ...current, customer_id: "", customer_name: event.target.value }))} placeholder="Contoh: Fajar / Mymoon" />
          </label>
          <label className="da-form-field">
            <span>Produk Stok Ready</span>
            <select value={draft.product_key} onChange={(event) => setDraft((current) => ({ ...current, product_key: event.target.value }))}>
              {bootstrap.stock.length === 0 ? <option value="">Belum ada stok ready</option> : null}
              {bootstrap.stock.map((stock) => (
                <option key={stock.stock_key} value={stock.stock_key}>{stock.product_name} · bebas {stock.free_pcs.toLocaleString("id-ID")} pcs</option>
              ))}
            </select>
          </label>
          <label className="da-form-field">
            <span>Qty PO (pcs)</span>
            <input inputMode="numeric" value={draft.qty_pcs} onChange={(event) => setDraft((current) => ({ ...current, qty_pcs: event.target.value }))} />
          </label>
          <label className="da-form-field">
            <span>Harga/pcs Opsional</span>
            <input inputMode="numeric" value={draft.unit_price} onChange={(event) => setDraft((current) => ({ ...current, unit_price: event.target.value }))} />
          </label>
          <label className="da-form-field">
            <span>Catatan</span>
            <input value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
          </label>
        </div>

        <div className="da-preview-strip">
          <strong>Preview:</strong> PO {qtyDraft.toLocaleString("id-ID")} pcs · stok bebas {freePcs.toLocaleString("id-ID")} pcs · ditahan {reservedPreview.toLocaleString("id-ID")} pcs · kurang {shortagePreview.toLocaleString("id-ID")} pcs · nilai {formatRupiah(nominalPreview)}
        </div>

        <div className="da-form-actions">
          <Button variant="secondary" onClick={() => setDraft({ po_date: today, target_date: today, po_type: "PO Harian", customer_id: "", customer_name: "", product_key: bootstrap.stock[0]?.stock_key || "", qty_pcs: "100", unit_price: "0", notes: "PO ditahan dari stok ready jika tersedia." })} disabled={saving}>Reset</Button>
          <Button onClick={handleSubmit} disabled={saving || loading}>{saving ? "Menyimpan..." : "Simpan PO / Tahan Stok"}</Button>
        </div>
      </Card>

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">STOK READY</div>
            <h2 className="da-section-title">Stok Bebas vs Stok Ditahan</h2>
            <p className="da-section-desc">Angka ini mengikuti gerak stok jadi dan TabStockAllocations.</p>
          </div>
          <Badge tone="success">Live Data</Badge>
        </div>
        <DataTable columns={STOCK_COLUMNS} rows={bootstrap.stock} getRowKey={(row) => row.stock_key} />
      </Card>

      <Card>
        <div className="da-card-header-inline">
          <div>
            <div className="da-section-eyebrow">ANTRIAN PO</div>
            <h2 className="da-section-title">PO yang Tercatat</h2>
            <p className="da-section-desc">Klik baris untuk melihat stok yang ditahan, shortage, dan rantai ID.</p>
          </div>
          <Badge tone="warning">Karantina / Reserved</Badge>
        </div>
        <DataTable columns={PO_COLUMNS} rows={bootstrap.pos} getRowKey={(row) => row.po_id} onRowClick={setSelectedPO} />
      </Card>

      <Modal
        open={Boolean(selectedPO)}
        title="Detail Antrian PO"
        subtitle={selectedPO?.po_id}
        onClose={() => setSelectedPO(null)}
      >
        {selectedPO ? (
          <div className="da-detail-stack">
            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-detail-label">Customer</div>
                <div className="da-detail-value">{safeText(selectedPO.customer_name)}</div>
                <p>Target: <strong>{formatDisplayDate(selectedPO.target_date)}</strong></p>
                <p>Tipe: <strong>{safeText(selectedPO.po_type)}</strong></p>
              </div>
              <div className="da-detail-box">
                <div className="da-detail-label">Produk & Qty</div>
                <div className="da-detail-value">{safeText(selectedPO.product_name)}</div>
                <p>PO: <strong>{selectedPO.qty_pcs.toLocaleString("id-ID")} pcs</strong></p>
                <p>Ditahan: <strong>{selectedPO.reserved_pcs.toLocaleString("id-ID")} pcs</strong></p>
                <p>Kurang: <strong>{selectedPO.shortage_pcs.toLocaleString("id-ID")} pcs</strong></p>
              </div>
            </div>

            <div className="da-alert-note">
              Rantai ini harus bisa ditelusuri: PO → Stok Allocation → Stok Jadi → Produksi/Freezer → Order/Kasir nanti.
            </div>

            <div>
              <div className="da-section-eyebrow">ALOKASI STOK</div>
              <DataTable
                columns={[
                  { key: "allocation_id", label: "Allocation ID", render: (row) => <strong>{safeText(row.allocation_id)}</strong> },
                  { key: "product_name", label: "Produk" },
                  { key: "qty_allocated", label: "Qty", render: (row) => `${row.qty_allocated.toLocaleString("id-ID")} pcs` },
                  { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{safeText(row.status)}</Badge> },
                ]}
                rows={selectedPO.allocations}
                getRowKey={(row) => row.allocation_id}
              />
            </div>

            {String(selectedPO.status || "").toUpperCase().includes("CANCEL") ? null : (
              <div className="da-form-actions">
                <Button variant="secondary" onClick={() => handleCancel(selectedPO)} disabled={saving}>Batalkan PO & Lepas Stok</Button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
