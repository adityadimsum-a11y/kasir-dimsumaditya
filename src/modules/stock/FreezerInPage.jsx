import { useEffect, useMemo, useState } from "react";
import { getFinishedStockBootstrap } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";
import ProductionFlowPanel from "../production/ProductionFlowPanel";

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

function isRealTransactionId(value) {
  const text = String(value || "").trim();
  if (!text || text === "-") return false;
  if (/^ROW[-_]?\d+$/i.test(text)) return false;
  if (/^Tab[A-Za-z0-9_]+-ROW-\d+$/i.test(text)) return false;
  if (/^\d+$/.test(text)) return false;
  return /[A-Z]{2,}|[-_]/i.test(text);
}

function formatPcs(value) {
  return `${numberValue(value).toLocaleString("id-ID")} pcs`;
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

function getSummary(data) {
  return data?.summary || {};
}

function isRealFreezerRow(row) {
  const movementId = row?.movement_id || row?.stock_movement_id || row?.id;
  const sourceId = row?.source_id || row?.production_id;
  const product = row?.product_id || row?.product_code || row?.product_name || row?.item_name;
  const qty = numberValue(row?.qty_pcs || row?.qty || row?.quantity);
  return (isRealTransactionId(movementId) || isRealTransactionId(sourceId)) && product && qty > 0;
}

function getFreezerRows(data) {
  return asArray(data?.freezer_in).filter(isRealFreezerRow).sort((a, b) => {
    return String(b.movement_date || b.created_at || "").localeCompare(
      String(a.movement_date || a.created_at || "")
    );
  });
}

function getTone(status) {
  const value = String(status || "").toUpperCase();
  if (value.includes("POSTED") || value.includes("ACTIVE") || value.includes("TERCATAT")) return "success";
  if (value.includes("VOID") || value.includes("BATAL")) return "danger";
  return "warning";
}

export default function FreezerInPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);

  const summary = useMemo(() => getSummary(bootstrap), [bootstrap]);
  const rows = useMemo(() => getFreezerRows(bootstrap), [bootstrap]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getFinishedStockBootstrap(session?.sessionToken, {
      source: "frontend_part_3c_barang_masuk_freezer",
      location_id: session?.user?.location_id || "",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setError(result.message || "Gagal membaca Barang Masuk Freezer.");
      setBootstrap(null);
      setLoading(false);
      return;
    }

    setBootstrap(result.data || {});
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionToken]);

  const columns = [
    {
      key: "movement_date",
      label: "Tanggal",
      render: (row) => formatDisplayDate(row.movement_date || row.created_at),
    },
    {
      key: "movement_id",
      label: "Gerak Stok ID",
      render: (row) => <strong>{safeText(row.movement_id)}</strong>,
    },
    {
      key: "production_id",
      label: "Produksi ID",
      render: (row) => safeText(row.production_id || row.source_id),
    },
    {
      key: "product_name",
      label: "Produk",
      render: (row) => safeText(row.product_name || row.item_name),
    },
    {
      key: "qty_pcs",
      label: "Masuk Freezer",
      render: (row) => formatPcs(row.qty_pcs || row.qty),
    },
    {
      key: "unit_cost",
      label: "Modal / Pcs",
      render: (row) => formatRupiah(row.unit_cost),
    },
    {
      key: "total_cost",
      label: "Modal Batch",
      render: (row) => formatRupiah(row.total_cost),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <Badge tone={getTone(row.status)}>{safeText(row.status, "POSTED")}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Barang Masuk Freezer"
        description="Pantau hasil produksi yang masuk freezer dari batch adukan. Data ini read-only dari gerak stok hidup."
        badge="Live Data"
      />

      <ProductionFlowPanel
        session={session}
        onSessionExpired={onSessionExpired}
        compact
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Stok produksi</div>
          <div className="da-dashboard-banner-title">Adukan → Barang Masuk Freezer</div>
          <div className="da-dashboard-banner-desc">
            Halaman ini hanya membaca hasil produksi yang sudah masuk stok jadi/freezer.
            Tidak membuat transaksi baru.
          </div>
        </div>
        <div className="da-dashboard-banner-actions">
          <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Dicek" : "Terhubung"}</Badge>
          <Button variant="ghost" onClick={loadData} disabled={loading}>
            {loading ? "Membaca..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      {error ? <div className="da-login-error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {!error && numberValue(summary.hidden_rows) > 0 ? (
        <div className="da-login-error" style={{ marginBottom: 16 }}>
          {numberValue(summary.hidden_rows).toLocaleString("id-ID")} baris kosong/formatting disembunyikan supaya freezer tidak menampilkan angka yatim.
        </div>
      ) : null}

      <div className="da-grid da-grid-3">
        <StatCard
          tone="primary"
          label="Barang Masuk Freezer"
          value={loading ? "..." : formatPcs(summary.freezer_in_pcs)}
          description="Total pcs hasil produksi yang masuk freezer."
        />
        <StatCard
          label="Batch Produksi"
          value={loading ? "..." : numberValue(summary.production_batch_count).toLocaleString("id-ID")}
          description="Jumlah batch/adukan yang tercatat."
        />
        <StatCard
          tone="warning"
          label="Modal Barang Jadi"
          value={loading ? "..." : formatRupiah(summary.total_stock_value)}
          description="Perkiraan nilai stok bebas berdasarkan modal terkunci."
        />
      </div>

      <div style={{ height: 16 }} />

      <div className="da-grid da-grid-3">
        <StatCard
          label="Stok Bebas"
          value={loading ? "..." : formatPcs(summary.total_free_pcs)}
          description="Stok jadi yang belum ditahan PO/order."
        />
        <StatCard
          label="Stok Ditahan"
          value={loading ? "..." : formatPcs(summary.total_held_pcs)}
          description="Stok yang sudah dialokasikan untuk PO/antrian."
        />
        <StatCard
          label="Perlu Source"
          value={loading ? "..." : numberValue(summary.need_source_count).toLocaleString("id-ID")}
          description="Gerak stok nyata yang belum punya sumber jelas."
        />
      </div>

      <div style={{ height: 16 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Riwayat Freezer</div>
            <div className="da-big-text">Barang Masuk Freezer yang Terbaca</div>
            <p className="da-muted">
              Klik baris untuk melihat detail popup: produksi, lot ayam, modal, dan gerak stok.
            </p>
          </div>
          <Badge tone="warning">Read Only</Badge>
        </div>

        <DataTable
          columns={columns}
          rows={loading ? [] : rows}
          getRowKey={(row, index) => row.movement_id || row.source_id || index}
          onRowClick={setSelectedRow}
        />
      </Card>

      <Modal
        open={Boolean(selectedRow)}
        title="Detail Barang Masuk Freezer"
        subtitle={selectedRow?.movement_id || selectedRow?.source_id || ""}
        onClose={() => setSelectedRow(null)}
      >
        {selectedRow ? (
          <div>
            <div className="da-modal-summary">
              <div>
                <div className="da-mini-title">Masuk Freezer</div>
                <div className="da-big-text">{formatPcs(selectedRow.qty_pcs || selectedRow.qty)}</div>
                <p className="da-muted">
                  Produk: <strong>{safeText(selectedRow.product_name || selectedRow.item_name)}</strong>
                </p>
              </div>
              <Badge tone={getTone(selectedRow.status)}>{safeText(selectedRow.status, "POSTED")}</Badge>
            </div>

            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-mini-title">Sumber Produksi</div>
                <p><strong>Produksi ID:</strong> {safeText(selectedRow.production_id || selectedRow.source_id)}</p>
                <p><strong>Tanggal:</strong> {formatDisplayDate(selectedRow.movement_date)}</p>
                <p><strong>Lot ayam:</strong> {safeText(selectedRow.chicken_lot_id)}</p>
              </div>
              <div className="da-detail-box">
                <div className="da-mini-title">Modal Terkunci</div>
                <p><strong>Modal/pcs:</strong> {formatRupiah(selectedRow.unit_cost)}</p>
                <p><strong>Total modal:</strong> {formatRupiah(selectedRow.total_cost)}</p>
                <p><strong>Cost layer:</strong> {safeText(selectedRow.cost_layer_id)}</p>
              </div>
            </div>

            <div className="da-modal-note" style={{ marginTop: 14 }}>
              Rantai ini harus bisa ditelusuri: Produksi/Adukan → Gerak Stok IN → Stok Jadi → Order/Kasir.
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
