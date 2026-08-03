import { useEffect, useMemo, useState } from "react";
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


function normalizeFallbackDrop(dropResult, productionResult) {
  const dropData = dropResult?.data || dropResult || {};
  const productionData = productionResult?.data || productionResult || {};

  const lots = asArray(dropData.chicken_lots || dropData.lots).map(normalizeLot);
  const movements = asArray(productionData.stock_movements || productionData.movements || productionData.chicken_movements).map(normalizeMovement);
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

  const total_in_kg = normalizedLots.reduce((total, lot) => total + numberValue(lot.qty_kg), 0);
  const total_used_kg = normalizedLots.reduce((total, lot) => total + numberValue(lot.qty_kg_out), 0);
  const total_remaining_kg = normalizedLots.reduce((total, lot) => total + numberValue(lot.qty_kg_remaining), 0);
  const total_remaining_value = normalizedLots.reduce(
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
        active_lot_count: normalizedLots.filter((lot) => numberValue(lot.qty_kg_remaining) > 0).length,
        consumed_lot_count: normalizedLots.filter((lot) => numberValue(lot.qty_kg_remaining) <= 0).length,
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
  const defaultLocation = session?.user?.location_code || session?.user?.location_id || "TGR";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bootstrap, setBootstrap] = useState(() => normalizeBootstrap({}));
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState(() => ({
    date_start: firstOfMonthInputValue(),
    date_end: todayInputValue(),
    location_id: defaultLocation || "TGR",
  }));

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      // Hotfix 4O-2:
      // Jangan panggil endpoint Stok Ayam khusus dulu karena di beberapa deploy Apps Script
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

  const activeLots = useMemo(() => bootstrap.lots.filter((lot) => numberValue(lot.qty_kg_remaining) > 0), [bootstrap.lots]);
  const latestMovements = useMemo(() => bootstrap.movements.slice(0, 12), [bootstrap.movements]);

  return (
    <>
      <PageHeader
        title="Stok Ayam"
        description="Pantau ayam masuk, ayam dipakai produksi, sisa kg per lot, dan modal ayam terkunci dari DROP. Halaman ini read-only supaya stok ayam bisa dicek tanpa membuat transaksi baru."
        badge="Live Ayam"
      />

      <ProductionFlowPanel
        session={session}
        onSessionExpired={onSessionExpired}
        compact
      />

      <Card>
        <div className="da-page-kicker">STOK BAHAN UTAMA</div>
        <h2 style={{ margin: "4px 0 8px" }}>DROP Ayam → Lot → Produksi/Adukan</h2>
        <p className="da-muted" style={{ marginTop: 0 }}>
          Stok ayam di sini membaca TabChickenLots, gerak stok ayam, dan batch produksi. Angka harus nyambung dengan DROP Ayam dan Produksi/Adukan.
        </p>
        <div className="da-filter-row" style={{ marginTop: 16, marginBottom: 0 }}>
          <input
            className="da-input"
            type="date"
            value={filter.date_start}
            onChange={(event) => setFilter((prev) => ({ ...prev, date_start: event.target.value }))}
          />
          <input
            className="da-input"
            type="date"
            value={filter.date_end}
            onChange={(event) => setFilter((prev) => ({ ...prev, date_end: event.target.value }))}
          />
          <input
            className="da-input"
            value={filter.location_id}
            onChange={(event) => setFilter((prev) => ({ ...prev, location_id: event.target.value.toUpperCase() }))}
            placeholder="TGR / PML / CBN"
          />
          <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Dicek" : "Terhubung"}</Badge>
          <Button variant="ghost" onClick={loadData} disabled={loading}>
            {loading ? "Membaca..." : "Refresh Data"}
          </Button>
        </div>
        {error ? <div className="da-form-warning" style={{ marginTop: 14 }}>{error}</div> : null}
      </Card>

      <div className="da-grid da-grid-3" style={{ marginTop: 16 }}>
        <StatCard
          label="Kg Ayam Masuk"
          value={formatKg(bootstrap.summary.total_in_kg)}
          description="Total kg dari lot ayam yang terbaca."
          tone="default"
        />
        <StatCard
          label="Kg Ayam Dipakai"
          value={formatKg(bootstrap.summary.total_used_kg)}
          description="Ayam yang sudah dipakai produksi/adukan."
          tone="warning"
        />
        <StatCard
          label="Sisa Kg Ayam"
          value={formatKg(bootstrap.summary.total_remaining_kg)}
          description="Sisa ayam aktif yang masih bisa dipakai."
          tone="primary"
        />
        <StatCard
          label="Nilai Sisa Ayam"
          value={formatMoney(bootstrap.summary.total_remaining_value)}
          description="Sisa kg x harga aktual per lot."
          tone="default"
        />
        <StatCard
          label="Lot Aktif"
          value={bootstrap.summary.active_lot_count}
          description="Lot ayam yang belum habis."
          tone="default"
        />
        <StatCard
          label="Batch Produksi"
          value={bootstrap.summary.production_count}
          description="Produksi yang memakai ayam pada filter ini."
          tone="default"
        />
      </div>

      {bootstrap.warnings.length ? (
        <div className="da-form-warning" style={{ marginTop: 16 }}>
          {bootstrap.warnings.map((warning) => warning.message || warning).join(" ")}
        </div>
      ) : null}

      <Card className="da-card-padding" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div className="da-page-kicker">LOT AYAM</div>
            <h2 style={{ margin: "4px 0 6px" }}>Lot Ayam Aktif</h2>
            <p className="da-muted" style={{ marginTop: 0 }}>Klik baris untuk melihat rantai DROP, hutang, stock layer, dan gerak stok.</p>
          </div>
          <Badge tone="warning">Read Only</Badge>
        </div>
        <DataTable
          columns={[
            { key: "date", label: "Tanggal", render: (row) => formatDate(row.lot_date) },
            { key: "lot", label: "Lot ID", render: (row) => <strong>{safeText(row.chicken_lot_id)}</strong> },
            { key: "supplier", label: "Supplier", render: (row) => safeText(row.supplier_name) },
            { key: "in", label: "Masuk", render: (row) => formatKg(row.qty_kg) },
            { key: "used", label: "Dipakai", render: (row) => formatKg(row.qty_kg_out) },
            { key: "remaining", label: "Sisa", render: (row) => <strong>{formatKg(row.qty_kg_remaining)}</strong> },
            { key: "cost", label: "Harga/kg", render: (row) => formatMoney(row.unit_cost) },
            { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{safeText(row.status)}</Badge> },
          ]}
          rows={activeLots}
          getRowKey={(row) => row.chicken_lot_id}
          onRowClick={(row) => setSelected(row)}
        />
        {!activeLots.length ? <p className="da-muted">Belum ada lot ayam aktif terbaca untuk filter ini.</p> : null}
      </Card>

      <div className="da-grid da-grid-3" style={{ marginTop: 16, alignItems: "start" }}>
        <Card className="da-card-padding" style={{ gridColumn: "span 2" }}>
          <div className="da-page-kicker">GERAK STOK AYAM</div>
          <h2 style={{ margin: "4px 0 6px" }}>Mutasi Ayam Terbaru</h2>
          <p className="da-muted" style={{ marginTop: 0 }}>Gerak masuk dari DROP dan keluar/pakai dari produksi harus punya source ID.</p>
          <DataTable
            columns={[
              { key: "date", label: "Tanggal", render: (row) => formatDate(row.movement_date) },
              { key: "id", label: "Mutasi ID", render: (row) => <strong>{safeText(row.movement_id)}</strong> },
              { key: "arah", label: "Arah", render: (row) => <Badge tone={String(row.direction).toUpperCase().includes("OUT") ? "warning" : "success"}>{safeText(row.direction)}</Badge> },
              { key: "qty", label: "Qty", render: (row) => formatKg(row.qty_kg) },
              { key: "source", label: "Sumber", render: (row) => safeText(row.source_id || row.source_module) },
              { key: "status", label: "Status", render: (row) => safeText(row.status) },
            ]}
            rows={latestMovements}
            getRowKey={(row, index) => row.movement_id || index}
          />
        </Card>

        <Card className="da-card-padding">
          <div className="da-page-kicker">PRODUKSI TERKAIT</div>
          <h2 style={{ margin: "4px 0 6px" }}>Ayam Dipakai Adukan</h2>
          <p className="da-muted" style={{ marginTop: 0 }}>Batch produksi yang memakai ayam dalam filter ini.</p>
          <div style={{ display: "grid", gap: 10 }}>
            {bootstrap.productions.slice(0, 8).map((row) => (
              <button
                type="button"
                key={row.production_id}
                className="da-card da-card-padding"
                style={{ textAlign: "left", borderColor: "var(--da-color-border)" }}
              >
                <div style={{ fontWeight: 900 }}>{safeText(row.production_id)}</div>
                <div className="da-muted">{formatDate(row.production_date)} · {safeText(row.product_name)}</div>
                <div style={{ marginTop: 6, fontWeight: 850 }}>{formatKg(row.chicken_kg_used)} → {numberValue(row.actual_pcs).toLocaleString("id-ID")} pcs</div>
              </button>
            ))}
            {!bootstrap.productions.length ? <p className="da-muted">Belum ada batch produksi terkait pada filter ini.</p> : null}
          </div>
        </Card>
      </div>

      <Modal
        open={Boolean(selected)}
        title="Detail Lot Ayam"
        subtitle={selected?.chicken_lot_id}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div className="da-modal-summary">
              <div>
                <div className="da-stat-label">Sisa Lot</div>
                <div className="da-stat-value">{formatKg(selected.qty_kg_remaining)}</div>
                <div className="da-muted">Masuk {formatKg(selected.qty_kg)} · Dipakai {formatKg(selected.qty_kg_out)}</div>
              </div>
              <Badge tone={badgeTone(selected.status)}>{safeText(selected.status)}</Badge>
            </div>

            <div className="da-grid da-grid-3">
              <Card>
                <div className="da-stat-label">DROP / Purchase</div>
                <strong>{safeText(selected.purchase_id || selected.source_id)}</strong>
              </Card>
              <Card>
                <div className="da-stat-label">Hutang Nana</div>
                <strong>{safeText(selected.payable_id)}</strong>
              </Card>
              <Card>
                <div className="da-stat-label">Layer Modal</div>
                <strong>{safeText(selected.stock_layer_id)}</strong>
              </Card>
            </div>

            <div className="da-modal-note">
              Rantai ini harus bisa ditelusuri: DROP Ayam → Lot Ayam → Produksi/Adukan → Barang Masuk Freezer → Stok Jadi.
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
