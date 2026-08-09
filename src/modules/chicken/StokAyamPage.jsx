import { useEffect, useMemo, useState } from "react";
import { DollarSign, Factory, Layers, RefreshCw, Scale } from "lucide-react";
import { getDropAyamBootstrap, getProductionBootstrap } from "../../lib/api/actions";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import ProductionFlowPanel from "../production/ProductionFlowPanel";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  const parsed = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatKg(value) {
  const number = numberValue(value);
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(number)} kg`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function todayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function firstOfMonthInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function safeText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
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

function normalizeLot(row) {
  return {
    ...row,
    chicken_lot_id: row.chicken_lot_id || row.lot_id || row.layer_id || row.id || "",
    lot_date: row.lot_date || row.drop_date || row.date || row.created_at || "",
    location_id: row.location_id || row.location_code || row.branch_id || "TGR",
    supplier_name: row.supplier_name || row.supplier || "-",
    qty_kg: numberValue(row.qty_kg || row.qty_kg_in || row.kg || row.qty_in || row.qty),
    qty_kg_out: numberValue(row.qty_kg_out || row.kg_out || row.qty_out || row.used_kg),
    qty_kg_remaining: numberValue(row.qty_kg_remaining || row.remaining_kg || row.qty_remaining),
    unit_cost: numberValue(row.unit_cost || row.price_per_kg || row.harga_kg || row.hpp_per_kg),
    total_cost: numberValue(row.total_cost || row.modal || row.amount),
    purchase_id: row.purchase_id || row.drop_id || row.source_id || "",
    payable_id: row.payable_id || row.hutang_id || "",
    stock_layer_id: row.stock_layer_id || row.layer_id || "",
    stock_movement_id: row.stock_movement_id || "",
    status: row.status || "ACTIVE",
    notes: row.notes || row.catatan || "",
  };
}

function normalizeMovement(row) {
  return {
    ...row,
    movement_id: row.movement_id || row.stock_movement_id || row.id || "",
    movement_date: row.movement_date || row.date || row.created_at || "",
    location_id: row.location_id || row.location_code || "TGR",
    direction: row.direction || row.mutation_type || row.type || "",
    qty_kg: numberValue(row.qty_kg || row.qty || row.qty_effect || row.kg || 0),
    unit: row.unit || "kg",
    item_name: row.item_name || row.product_name || row.category || "Ayam",
    source_module: row.source_module || "-",
    source_id: row.source_id || "",
    status: row.status || "POSTED",
  };
}

function normalizeProduction(row) {
  return {
    ...row,
    production_id: row.production_id || row.id || "",
    production_date: row.production_date || row.date || row.created_at || "",
    product_name: row.product_name || row.item_name || "Produk",
    chicken_lot_id: row.chicken_lot_id || row.lot_id || "",
    chicken_kg_used: numberValue(row.chicken_kg_used || row.kg_ayam_dipakai || row.used_kg),
    actual_pcs: numberValue(row.actual_pcs || row.output_pcs || row.hasil_pcs),
    status: row.status || "POSTED",
  };
}

function normalizeBootstrap(result) {
  const data = result?.data || result || {};
  return {
    summary: {
      total_in_kg: numberValue(data.summary?.total_in_kg),
      total_used_kg: numberValue(data.summary?.total_used_kg),
      total_remaining_kg: numberValue(data.summary?.total_remaining_kg),
      total_remaining_value: numberValue(data.summary?.total_remaining_value),
      active_lot_count: numberValue(data.summary?.active_lot_count),
      consumed_lot_count: numberValue(data.summary?.consumed_lot_count),
      movement_count: numberValue(data.summary?.movement_count),
      production_count: numberValue(data.summary?.production_count),
    },
    lots: asArray(data.chicken_lots || data.lots).map(normalizeLot),
    movements: asArray(data.chicken_movements || data.movements).map(normalizeMovement),
    productions: asArray(data.production_usages || data.productions).map(normalizeProduction),
    warnings: asArray(data.warnings),
    filter: data.filter || {},
  };
}


function isOperationalActiveLot(lot) {
  const status = String(lot?.status || "").trim().toUpperCase();
  return status === "ACTIVE" && numberValue(lot?.qty_kg_remaining) > 0;
}

function normalizeFallbackDrop(dropResult, productionResult) {
  const dropData = dropResult?.data || dropResult || {};
  const productionData = productionResult?.data || productionResult || {};

  const lots = asArray(dropData.chicken_lots || dropData.lots).map(normalizeLot);
  const dropMovements = asArray(
    dropData.stock_movements || dropData.chicken_movements || dropData.movements
  ).map(normalizeMovement);
  const productionMovements = asArray(
    productionData.stock_movements || productionData.movements || productionData.chicken_movements
  ).map(normalizeMovement);
  const movementMap = new Map();
  [...dropMovements, ...productionMovements].forEach((row, index) => {
    const key = String(row.movement_id || `${row.source_id}-${row.direction}-${index}`);
    if (!movementMap.has(key)) movementMap.set(key, row);
  });
  const movements = Array.from(movementMap.values());
  const productions = asArray(productionData.production_batches || productionData.production_usages || productionData.productions).map(normalizeProduction);

  const usedByLot = productions.reduce((acc, row) => {
    const lotId = String(row.chicken_lot_id || "").trim();
    if (!lotId) return acc;
    acc[lotId] = (acc[lotId] || 0) + numberValue(row.chicken_kg_used);
    return acc;
  }, {});

  const normalizedLots = lots.map((lot) => {
    const lotId = String(lot.chicken_lot_id || "").trim();
    const fallbackUsed = usedByLot[lotId] || 0;
    const qtyIn = numberValue(lot.qty_kg || lot.qty_kg_in);
    const qtyOut = numberValue(lot.qty_kg_out) || fallbackUsed;
    const remaining = numberValue(lot.qty_kg_remaining) || Math.max(qtyIn - qtyOut, 0);

    return {
      ...lot,
      qty_kg: qtyIn,
      qty_kg_out: qtyOut,
      qty_kg_remaining: remaining,
    };
  });

  const activeStockLots = normalizedLots.filter(isOperationalActiveLot);
  const total_in_kg = normalizedLots.reduce((total, lot) => total + numberValue(lot.qty_kg), 0);
  const total_used_kg = normalizedLots.reduce((total, lot) => total + numberValue(lot.qty_kg_out), 0);
  const total_remaining_kg = activeStockLots.reduce((total, lot) => total + numberValue(lot.qty_kg_remaining), 0);
  const total_remaining_value = activeStockLots.reduce(
    (total, lot) => total + numberValue(lot.qty_kg_remaining) * numberValue(lot.unit_cost),
    0
  );

  return {
    success: true,
    message: "Stok ayam dibaca dari fallback DROP Ayam + Produksi.",
    data: {
      summary: {
        total_in_kg,
        total_used_kg,
        total_remaining_kg,
        total_remaining_value,
        active_lot_count: activeStockLots.length,
        consumed_lot_count: normalizedLots.filter((lot) => !isOperationalActiveLot(lot)).length,
        movement_count: movements.length,
        production_count: productions.length,
      },
      chicken_lots: normalizedLots,
      chicken_movements: movements,
      production_usages: productions,
      warnings: [],
      filter: {},
    },
  };
}

function badgeTone(status) {
  const text = String(status || "").toLowerCase();
  if (text.includes("active") || text.includes("posted")) return "success";
  if (text.includes("consumed") || text.includes("habis")) return "danger";
  if (text.includes("partial") || text.includes("used")) return "warning";
  return "default";
}

export default function StokAyamPage({ session, onSessionExpired }) {
  const sessionToken = session?.sessionToken || "";
  const defaultLocation = session?.user?.location_id || session?.user?.location_code || "LOC-TGR-001";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bootstrap, setBootstrap] = useState(() => normalizeBootstrap({}));
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState(() => ({
    date_start: firstOfMonthInputValue(),
    date_end: todayInputValue(),
    location_id: defaultLocation || "LOC-TGR-001",
  }));

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      // Hotfix 4O-2:
      // Gunakan bootstrap DROP + Produksi yang sudah disatukan di backend PHP/MySQL
      // masih memunculkan Failed to fetch. Data Stok Ayam sudah valid dibaca dari
      // rantai hidup yang sudah hijau: DROP Ayam + Produksi/Adukan.
      const [dropResult, productionResult] = await Promise.all([
        getDropAyamBootstrap(sessionToken, filter),
        getProductionBootstrap(sessionToken, filter),
      ]);

      if (isAuthRequired(dropResult) || isAuthRequired(productionResult)) {
        onSessionExpired?.();
        return;
      }

      if (dropResult?.success || productionResult?.success) {
        const fallbackResult = normalizeFallbackDrop(dropResult, productionResult);
        setBootstrap(normalizeBootstrap(fallbackResult));
        setError("");
        return;
      }

      const message =
        dropResult?.message ||
        dropResult?.error?.message ||
        productionResult?.message ||
        productionResult?.error?.message ||
        "Gagal membaca stok ayam dari DROP Ayam dan Produksi.";
      setError(message);
      setBootstrap(normalizeBootstrap({}));
    } catch (err) {
      setError(err?.message || "Gagal membaca stok ayam dari DROP Ayam dan Produksi.");
      setBootstrap(normalizeBootstrap({}));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeLots = useMemo(() => bootstrap.lots.filter(isOperationalActiveLot), [bootstrap.lots]);
  const latestMovements = useMemo(() => bootstrap.movements.slice(0, 12), [bootstrap.movements]);

  const stockTotalForRatio = bootstrap.summary.total_used_kg + bootstrap.summary.total_remaining_kg;
  const usedRatio = stockTotalForRatio > 0
    ? Math.min(100, (bootstrap.summary.total_used_kg / stockTotalForRatio) * 100)
    : 0;

  return (
    <div className="da-page da-production-workspace-v6">
      <PageHeader
        title="Stok Ayam"
        eyebrow="Produksi & Stok"
        description="Pantau ketersediaan ayam per lot, pemakaian produksi, dan nilai bahan yang masih tersedia."
        actions={<Button variant="secondary" onClick={loadData} disabled={loading}><RefreshCw size={15} /> {loading ? "Memuat" : "Perbarui"}</Button>}
      />

      <ProductionFlowPanel activeStep={1} />

      {error ? <div className="da-prod-public-alert-v6 is-error">{error}</div> : null}

      <div className="da-prod-filter-bar-v6">
        <div><label>Dari</label><input type="date" value={filter.date_start} onChange={(event) => setFilter((prev) => ({ ...prev, date_start: event.target.value }))} /></div>
        <div><label>Sampai</label><input type="date" value={filter.date_end} onChange={(event) => setFilter((prev) => ({ ...prev, date_end: event.target.value }))} /></div>
        <div className="is-location"><label>Lokasi</label><input value={filter.location_id} onChange={(event) => setFilter((prev) => ({ ...prev, location_id: event.target.value.toUpperCase() }))} placeholder="Tangerang" /></div>
        <Button onClick={loadData} disabled={loading}>Terapkan</Button>
      </div>

      <section className="da-prod-kpi-grid-v6">
        <div className="da-prod-kpi-v6 tone-primary"><span className="icon"><Scale size={17} /></span><div><small>Sisa Ayam</small><strong>{formatKg(bootstrap.summary.total_remaining_kg)}</strong><p>Siap dipakai produksi</p></div></div>
        <div className="da-prod-kpi-v6"><span className="icon"><DollarSign size={17} /></span><div><small>Nilai Persediaan</small><strong>{formatMoney(bootstrap.summary.total_remaining_value)}</strong><p>Berdasarkan harga tiap lot</p></div></div>
        <div className="da-prod-kpi-v6"><span className="icon"><Layers size={17} /></span><div><small>Lot Aktif</small><strong>{bootstrap.summary.active_lot_count}</strong><p>Lot dengan sisa bahan</p></div></div>
        <div className="da-prod-kpi-v6 tone-warning"><span className="icon"><Factory size={17} /></span><div><small>Dipakai Produksi</small><strong>{formatKg(bootstrap.summary.total_used_kg)}</strong><p>{bootstrap.summary.production_count} batch produksi</p></div></div>
      </section>

      <section className="da-prod-main-grid-v6">
        <Card className="da-prod-primary-panel-v6" title="Lot Ayam Aktif" description="Persediaan ayam yang masih tersedia untuk produksi. Klik baris untuk melihat rincian lot.">
          <DataTable
            columns={[
              { key: "date", label: "Tanggal", render: (row) => formatDate(row.lot_date) },
              { key: "lot", label: "Lot", render: (row) => <strong>{safeText(row.chicken_lot_id)}</strong> },
              { key: "supplier", label: "Supplier", render: (row) => safeText(row.supplier_name) },
              { key: "in", label: "Masuk", render: (row) => formatKg(row.qty_kg) },
              { key: "used", label: "Dipakai", render: (row) => formatKg(row.qty_kg_out) },
              { key: "remaining", label: "Sisa", render: (row) => <strong>{formatKg(row.qty_kg_remaining)}</strong> },
              { key: "cost", label: "Harga/kg", render: (row) => formatMoney(row.unit_cost) },
            ]}
            rows={activeLots}
            getRowKey={(row) => row.chicken_lot_id}
            onRowClick={(row) => setSelected(row)}
          />
          {!activeLots.length ? <div className="da-prod-empty-v6">Belum ada lot ayam aktif pada periode ini.</div> : null}
        </Card>

        <Card className="da-prod-side-panel-v6" title="Pemakaian Bahan" description="Perbandingan ayam yang sudah dipakai dengan sisa bahan saat ini.">
          <div className="da-prod-side-total-v6">
            <span>Total ayam masuk</span>
            <strong>{formatKg(bootstrap.summary.total_in_kg)}</strong>
            <small>{bootstrap.summary.active_lot_count} lot masih aktif</small>
          </div>
          <div className="da-prod-progress-v6">
            <div className="head"><span>Sudah dipakai</span><b>{usedRatio.toFixed(0)}%</b></div>
            <div className="track"><span style={{ width: `${usedRatio}%` }} /></div>
          </div>
          <div className="da-prod-side-list-v6">
            <div><span>Dipakai produksi</span><strong>{formatKg(bootstrap.summary.total_used_kg)}</strong></div>
            <div><span>Sisa bahan</span><strong>{formatKg(bootstrap.summary.total_remaining_kg)}</strong></div>
            <div><span>Batch produksi</span><strong>{bootstrap.summary.production_count}</strong></div>
            <div><span>Nilai sisa</span><strong>{formatMoney(bootstrap.summary.total_remaining_value)}</strong></div>
          </div>
        </Card>
      </section>

      <section className="da-prod-secondary-grid-v6">
        <Card title="Aktivitas Bahan Terbaru" description="Pergerakan ayam masuk dan pemakaian produksi.">
          <DataTable
            columns={[
              { key: "date", label: "Tanggal", render: (row) => formatDate(row.movement_date) },
              { key: "arah", label: "Jenis", render: (row) => <Badge tone={String(row.direction).toUpperCase().includes("OUT") ? "warning" : "success"}>{String(row.direction).toUpperCase().includes("OUT") ? "Pemakaian" : "Masuk"}</Badge> },
              { key: "qty", label: "Jumlah", render: (row) => formatKg(row.qty_kg) },
              { key: "source", label: "Transaksi", render: (row) => safeText(row.source_id || row.source_module) },
            ]}
            rows={latestMovements}
            getRowKey={(row, index) => row.movement_id || index}
          />
        </Card>

        <Card title="Produksi yang Menggunakan Ayam" description="Batch terakhir yang menggunakan persediaan ayam.">
          <div className="da-prod-activity-list-v6">
            {bootstrap.productions.slice(0, 8).map((row) => (
              <div key={row.production_id} className="da-prod-activity-row-v6">
                <div><strong>{safeText(row.product_name)}</strong><small>{formatDate(row.production_date)}</small></div>
                <div><b>{formatKg(row.chicken_kg_used)}</b><small>{numberValue(row.actual_pcs).toLocaleString("id-ID")} pcs</small></div>
              </div>
            ))}
            {!bootstrap.productions.length ? <div className="da-prod-empty-v6">Belum ada produksi pada periode ini.</div> : null}
          </div>
        </Card>
      </section>

      <Modal open={Boolean(selected)} title="Detail Lot Ayam" subtitle={selected?.chicken_lot_id} onClose={() => setSelected(null)}>
        {selected ? (
          <div className="da-prod-detail-v6">
            <div className="da-modal-summary">
              <div><div className="da-stat-label">Sisa Lot</div><div className="da-stat-value">{formatKg(selected.qty_kg_remaining)}</div><div className="da-muted">Masuk {formatKg(selected.qty_kg)} · Dipakai {formatKg(selected.qty_kg_out)}</div></div>
              <Badge tone={badgeTone(selected.status)}>{safeText(selected.status)}</Badge>
            </div>
            <div className="da-prod-detail-grid-v6">
              <div><span>Supplier</span><strong>{safeText(selected.supplier_name)}</strong></div>
              <div><span>Harga per kg</span><strong>{formatMoney(selected.unit_cost)}</strong></div>
              <div><span>Pembelian</span><strong>{safeText(selected.purchase_id || selected.source_id)}</strong></div>
              <div><span>Hutang Supplier</span><strong>{safeText(selected.payable_id, "Tidak ada")}</strong></div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );

}
