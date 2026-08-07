import { useEffect, useMemo, useState } from "react";
import { Boxes, DollarSign, PackageCheck, RefreshCw, Snowflake } from "lucide-react";
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

  const totalPosition = numberValue(summary.total_free_pcs) + numberValue(summary.total_held_pcs);
  const heldRatio = totalPosition > 0 ? Math.min(100, (numberValue(summary.total_held_pcs) / totalPosition) * 100) : 0;

  return (
    <div className="da-page da-production-workspace-v6">
      <PageHeader
        title="Barang Masuk Freezer"
        eyebrow="Produksi & Stok"
        description="Pantau hasil produksi yang sudah masuk freezer dan nilai barang jadi yang terbentuk."
        actions={<Button variant="secondary" onClick={loadData} disabled={loading}><RefreshCw size={15} /> {loading ? "Memuat" : "Perbarui"}</Button>}
      />

      <ProductionFlowPanel session={session} onSessionExpired={onSessionExpired} compact />
      {error ? <div className="da-prod-public-alert-v6 is-error">{error}</div> : null}

      <section className="da-prod-kpi-grid-v6">
        <div className="da-prod-kpi-v6 tone-primary"><span className="icon"><Snowflake size={17} /></span><div><small>Masuk Freezer</small><strong>{loading ? "..." : formatPcs(summary.freezer_in_pcs)}</strong><p>Hasil produksi tercatat</p></div></div>
        <div className="da-prod-kpi-v6"><span className="icon"><Boxes size={17} /></span><div><small>Batch Produksi</small><strong>{loading ? "..." : numberValue(summary.production_batch_count).toLocaleString("id-ID")}</strong><p>Batch yang menghasilkan stok</p></div></div>
        <div className="da-prod-kpi-v6"><span className="icon"><PackageCheck size={17} /></span><div><small>Stok Bebas</small><strong>{loading ? "..." : formatPcs(summary.total_free_pcs)}</strong><p>Siap dialokasikan</p></div></div>
        <div className="da-prod-kpi-v6 tone-warning"><span className="icon"><DollarSign size={17} /></span><div><small>Nilai Barang Jadi</small><strong>{loading ? "..." : formatRupiah(summary.total_stock_value)}</strong><p>Modal stok tercatat</p></div></div>
      </section>

      <section className="da-prod-main-grid-v6">
        <Card className="da-prod-primary-panel-v6" title="Penerimaan Freezer Terbaru" description="Hasil produksi yang baru masuk freezer. Klik baris untuk melihat rincian batch.">
          <DataTable columns={columns} rows={loading ? [] : rows} getRowKey={(row, index) => row.movement_id || row.source_id || index} onRowClick={setSelectedRow} />
          {!rows.length ? <div className="da-prod-empty-v6">Belum ada barang masuk freezer yang tercatat.</div> : null}
        </Card>

        <Card className="da-prod-side-panel-v6" title="Komposisi Stok" description="Posisi barang jadi setelah hasil produksi masuk freezer.">
          <div className="da-prod-side-total-v6"><span>Total stok tersedia</span><strong>{formatPcs(totalPosition)}</strong><small>{formatPcs(summary.total_held_pcs)} sudah dialokasikan</small></div>
          <div className="da-prod-progress-v6"><div className="head"><span>Dialokasikan untuk PO</span><b>{heldRatio.toFixed(0)}%</b></div><div className="track"><span style={{ width: `${heldRatio}%` }} /></div></div>
          <div className="da-prod-side-list-v6">
            <div><span>Stok bebas</span><strong>{formatPcs(summary.total_free_pcs)}</strong></div>
            <div><span>Stok dialokasikan</span><strong>{formatPcs(summary.total_held_pcs)}</strong></div>
            <div><span>Batch produksi</span><strong>{numberValue(summary.production_batch_count).toLocaleString("id-ID")}</strong></div>
            <div><span>Nilai stok</span><strong>{formatRupiah(summary.total_stock_value)}</strong></div>
          </div>
        </Card>
      </section>

      <Modal open={Boolean(selectedRow)} title="Detail Barang Masuk Freezer" subtitle={selectedRow?.product_name || selectedRow?.item_name || ""} onClose={() => setSelectedRow(null)}>
        {selectedRow ? (
          <div className="da-prod-detail-v6">
            <div className="da-modal-summary"><div><div className="da-mini-title">Masuk Freezer</div><div className="da-big-text">{formatPcs(selectedRow.qty_pcs || selectedRow.qty)}</div><p className="da-muted">{safeText(selectedRow.product_name || selectedRow.item_name)}</p></div><Badge tone={getTone(selectedRow.status)}>{safeText(selectedRow.status, "Tercatat")}</Badge></div>
            <div className="da-prod-detail-grid-v6">
              <div><span>Tanggal</span><strong>{formatDisplayDate(selectedRow.movement_date)}</strong></div>
              <div><span>Produksi</span><strong>{safeText(selectedRow.production_id || selectedRow.source_id)}</strong></div>
              <div><span>Modal per pcs</span><strong>{formatRupiah(selectedRow.unit_cost)}</strong></div>
              <div><span>Total modal</span><strong>{formatRupiah(selectedRow.total_cost)}</strong></div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );

}
