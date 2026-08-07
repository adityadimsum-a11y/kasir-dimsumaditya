import { useEffect, useMemo, useState } from "react";
import { Boxes, DollarSign, PackageCheck, RefreshCw, ShoppingCart } from "lucide-react";
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

function isRealStockRow(row) {
  const product = row?.product_id || row?.product_code || row?.product_name || row?.item_name;
  const total = numberValue(row?.total_pcs);
  const masuk = numberValue(row?.in_pcs);
  const keluar = numberValue(row?.out_pcs);
  const held = numberValue(row?.held_pcs);
  const movementId = row?.last_movement_id || row?.last_source_id || row?.stock_key;
  return product && (total > 0 || masuk > 0 || keluar > 0 || held > 0 || isRealTransactionId(movementId));
}

function getFinishedStockRows(data) {
  return asArray(data?.finished_stock).filter(isRealStockRow).sort((a, b) => {
    return numberValue(b.total_pcs) - numberValue(a.total_pcs);
  });
}

function getTone(status) {
  const value = String(status || "").toUpperCase();
  if (value.includes("TERSEDIA") || value.includes("AKTIF")) return "success";
  if (value.includes("KOSONG")) return "danger";
  return "warning";
}

export default function FinishedStockPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);

  const summary = useMemo(() => getSummary(bootstrap), [bootstrap]);
  const rows = useMemo(() => getFinishedStockRows(bootstrap), [bootstrap]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getFinishedStockBootstrap(session?.sessionToken, {
      source: "frontend_part_3c_stok_jadi",
      location_id: session?.user?.location_id || "",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setError(result.message || "Gagal membaca Stok Jadi.");
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
      key: "product_name",
      label: "Produk",
      render: (row) => <strong>{safeText(row.product_name)}</strong>,
    },
    {
      key: "free_pcs",
      label: "Stok Bebas",
      render: (row) => formatPcs(row.free_pcs),
    },
    {
      key: "held_pcs",
      label: "Ditahan PO",
      render: (row) => formatPcs(row.held_pcs),
    },
    {
      key: "total_pcs",
      label: "Total Stok",
      render: (row) => formatPcs(row.total_pcs),
    },
    {
      key: "in_pcs",
      label: "Masuk",
      render: (row) => formatPcs(row.in_pcs),
    },
    {
      key: "out_pcs",
      label: "Keluar",
      render: (row) => formatPcs(row.out_pcs),
    },
    {
      key: "avg_unit_cost",
      label: "Modal / Pcs",
      render: (row) => formatRupiah(row.avg_unit_cost),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <Badge tone={getTone(row.status)}>{safeText(row.status)}</Badge>,
    },
  ];

  const totalStock = numberValue(summary.total_stock_pcs);
  const heldRatio = totalStock > 0 ? Math.min(100, (numberValue(summary.total_held_pcs) / totalStock) * 100) : 0;

  return (
    <div className="da-page da-production-workspace-v6">
      <PageHeader
        title="Stok Jadi"
        eyebrow="Produksi & Stok"
        description="Pantau stok siap jual, alokasi untuk PO, pergerakan barang, dan nilai persediaan produk jadi."
        actions={<Button variant="secondary" onClick={loadData} disabled={loading}><RefreshCw size={15} /> {loading ? "Memuat" : "Perbarui"}</Button>}
      />

      <ProductionFlowPanel session={session} onSessionExpired={onSessionExpired} compact />
      {error ? <div className="da-prod-public-alert-v6 is-error">{error}</div> : null}

      <section className="da-prod-kpi-grid-v6">
        <div className="da-prod-kpi-v6 tone-primary"><span className="icon"><PackageCheck size={17} /></span><div><small>Stok Siap Jual</small><strong>{loading ? "..." : formatPcs(summary.total_free_pcs)}</strong><p>Belum dialokasikan</p></div></div>
        <div className="da-prod-kpi-v6 tone-warning"><span className="icon"><ShoppingCart size={17} /></span><div><small>Dialokasikan PO</small><strong>{loading ? "..." : formatPcs(summary.total_held_pcs)}</strong><p>Sudah disiapkan untuk order</p></div></div>
        <div className="da-prod-kpi-v6"><span className="icon"><Boxes size={17} /></span><div><small>Total Stok Jadi</small><strong>{loading ? "..." : formatPcs(summary.total_stock_pcs)}</strong><p>{numberValue(summary.product_count).toLocaleString("id-ID")} produk aktif</p></div></div>
        <div className="da-prod-kpi-v6"><span className="icon"><DollarSign size={17} /></span><div><small>Nilai Persediaan</small><strong>{loading ? "..." : formatRupiah(summary.total_stock_value)}</strong><p>Nilai modal stok bebas</p></div></div>
      </section>

      <section className="da-prod-main-grid-v6">
        <Card className="da-prod-primary-panel-v6" title="Persediaan Produk" description="Posisi stok per produk. Klik baris untuk melihat rincian stok dan pergerakan terakhir.">
          <DataTable columns={columns} rows={loading ? [] : rows} getRowKey={(row, index) => row.stock_key || row.product_id || row.product_code || index} onRowClick={setSelectedRow} />
          {!rows.length ? <div className="da-prod-empty-v6">Belum ada stok produk jadi yang tercatat.</div> : null}
        </Card>

        <Card className="da-prod-side-panel-v6" title="Alokasi Persediaan" description="Perbandingan stok bebas dengan stok yang sudah dialokasikan untuk PO.">
          <div className="da-prod-side-total-v6"><span>Total stok jadi</span><strong>{formatPcs(summary.total_stock_pcs)}</strong><small>{formatPcs(summary.total_free_pcs)} masih bebas</small></div>
          <div className="da-prod-progress-v6"><div className="head"><span>Dialokasikan</span><b>{heldRatio.toFixed(0)}%</b></div><div className="track"><span style={{ width: `${heldRatio}%` }} /></div></div>
          <div className="da-prod-side-list-v6">
            <div><span>Stok bebas</span><strong>{formatPcs(summary.total_free_pcs)}</strong></div>
            <div><span>Stok untuk PO</span><strong>{formatPcs(summary.total_held_pcs)}</strong></div>
            <div><span>Masuk freezer</span><strong>{formatPcs(summary.freezer_in_pcs)}</strong></div>
            <div><span>Produk aktif</span><strong>{numberValue(summary.product_count).toLocaleString("id-ID")}</strong></div>
          </div>
        </Card>
      </section>

      <Modal open={Boolean(selectedRow)} title="Detail Stok Jadi" subtitle={selectedRow?.product_name || selectedRow?.product_code || ""} onClose={() => setSelectedRow(null)}>
        {selectedRow ? (
          <div className="da-prod-detail-v6">
            <div className="da-modal-summary"><div><div className="da-mini-title">Stok Siap Jual</div><div className="da-big-text">{formatPcs(selectedRow.free_pcs)}</div><p className="da-muted">Dialokasikan PO: <strong>{formatPcs(selectedRow.held_pcs)}</strong></p></div><Badge tone={getTone(selectedRow.status)}>{safeText(selectedRow.status)}</Badge></div>
            <div className="da-prod-detail-grid-v6">
              <div><span>Total stok</span><strong>{formatPcs(selectedRow.total_pcs)}</strong></div>
              <div><span>Barang masuk</span><strong>{formatPcs(selectedRow.in_pcs)}</strong></div>
              <div><span>Barang keluar</span><strong>{formatPcs(selectedRow.out_pcs)}</strong></div>
              <div><span>Modal per pcs</span><strong>{formatRupiah(selectedRow.avg_unit_cost)}</strong></div>
            </div>
            {asArray(selectedRow.recent_movements).length ? (
              <div className="da-prod-modal-list-v6">
                <span className="label">Pergerakan terakhir</span>
                {asArray(selectedRow.recent_movements).slice(0, 6).map((movement) => (
                  <div key={movement.movement_id || `${movement.source_id}-${movement.direction}`}><span>{formatDisplayDate(movement.movement_date)} · {safeText(movement.direction)}</span><strong>{formatPcs(movement.qty_pcs || movement.qty)}</strong></div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );

}
