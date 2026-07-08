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

  return (
    <div>
      <PageHeader
        title="Stok Jadi"
        description="Pantau stok siap jual: stok bebas, stok ditahan PO, barang masuk freezer, dan barang keluar."
        badge="Live Stock"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Stok siap jual</div>
          <div className="da-dashboard-banner-title">Barang Jadi → PO / Kasir / Order</div>
          <div className="da-dashboard-banner-desc">
            Halaman ini membaca stok jadi dari gerak stok hidup. Detail transaksi baru dibuka saat baris diklik.
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
          {numberValue(summary.hidden_rows).toLocaleString("id-ID")} baris kosong/formatting disembunyikan supaya stok jadi tidak menampilkan angka yatim.
        </div>
      ) : null}

      <div className="da-grid da-grid-3">
        <StatCard
          tone="primary"
          label="Stok Bebas"
          value={loading ? "..." : formatPcs(summary.total_free_pcs)}
          description="Stok yang siap dijual dan belum ditahan PO."
        />
        <StatCard
          tone="warning"
          label="Stok Ditahan PO"
          value={loading ? "..." : formatPcs(summary.total_held_pcs)}
          description="Stok yang sudah dialokasikan untuk PO/antrian."
        />
        <StatCard
          label="Total Stok Jadi"
          value={loading ? "..." : formatPcs(summary.total_stock_pcs)}
          description="Stok bebas + stok yang sedang ditahan."
        />
      </div>

      <div style={{ height: 16 }} />

      <div className="da-grid da-grid-3">
        <StatCard
          label="Barang Masuk Freezer"
          value={loading ? "..." : formatPcs(summary.freezer_in_pcs)}
          description="Total hasil produksi yang masuk freezer."
        />
        <StatCard
          label="Produk Aktif"
          value={loading ? "..." : numberValue(summary.product_count).toLocaleString("id-ID")}
          description="Produk yang punya gerak stok atau alokasi."
        />
        <StatCard
          tone="warning"
          label="Nilai Stok Bebas"
          value={loading ? "..." : formatRupiah(summary.total_stock_value)}
          description="Perkiraan modal stok bebas dari HPP batch."
        />
      </div>

      <div style={{ height: 16 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Stok Produk</div>
            <div className="da-big-text">Stok Jadi yang Terbaca</div>
            <p className="da-muted">
              Klik baris untuk melihat detail ringkas stok, alokasi, dan gerak terakhir.
            </p>
          </div>
          <Badge tone="warning">Read Only</Badge>
        </div>

        <DataTable
          columns={columns}
          rows={loading ? [] : rows}
          getRowKey={(row, index) => row.stock_key || row.product_id || row.product_code || index}
          onRowClick={setSelectedRow}
        />
      </Card>

      <Modal
        open={Boolean(selectedRow)}
        title="Detail Stok Jadi"
        subtitle={selectedRow?.product_name || selectedRow?.product_code || ""}
        onClose={() => setSelectedRow(null)}
      >
        {selectedRow ? (
          <div>
            <div className="da-modal-summary">
              <div>
                <div className="da-mini-title">Stok Bebas</div>
                <div className="da-big-text">{formatPcs(selectedRow.free_pcs)}</div>
                <p className="da-muted">
                  Ditahan PO: <strong>{formatPcs(selectedRow.held_pcs)}</strong>
                </p>
              </div>
              <Badge tone={getTone(selectedRow.status)}>{safeText(selectedRow.status)}</Badge>
            </div>

            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-mini-title">Produk</div>
                <p><strong>Produk:</strong> {safeText(selectedRow.product_name)}</p>
                <p><strong>Kode:</strong> {safeText(selectedRow.product_code)}</p>
                <p><strong>Lokasi:</strong> {safeText(selectedRow.location_id)}</p>
              </div>
              <div className="da-detail-box">
                <div className="da-mini-title">Pergerakan</div>
                <p><strong>Masuk:</strong> {formatPcs(selectedRow.in_pcs)}</p>
                <p><strong>Keluar:</strong> {formatPcs(selectedRow.out_pcs)}</p>
                <p><strong>Total stok:</strong> {formatPcs(selectedRow.total_pcs)}</p>
              </div>
              <div className="da-detail-box">
                <div className="da-mini-title">Modal</div>
                <p><strong>Modal/pcs:</strong> {formatRupiah(selectedRow.avg_unit_cost)}</p>
                <p><strong>Nilai stok bebas:</strong> {formatRupiah(selectedRow.stock_value)}</p>
                <p><strong>Gerak terakhir:</strong> {formatDisplayDate(selectedRow.last_movement_date)}</p>
              </div>
              <div className="da-detail-box">
                <div className="da-mini-title">Trace</div>
                <p><strong>Source terakhir:</strong> {safeText(selectedRow.last_source_id)}</p>
                <p><strong>Jumlah gerak:</strong> {numberValue(selectedRow.movement_count).toLocaleString("id-ID")}</p>
                <p><strong>Stok key:</strong> {safeText(selectedRow.stock_key)}</p>
              </div>
            </div>

            <div className="da-payload-preview" style={{ marginTop: 14 }}>
              <div className="da-mini-title">Gerak Stok Terakhir</div>
              {asArray(selectedRow.recent_movements).length === 0 ? (
                <p className="da-muted">Belum ada detail gerak stok.</p>
              ) : (
                asArray(selectedRow.recent_movements).map((movement) => (
                  <div className="da-payload-row" key={movement.movement_id || `${movement.source_id}-${movement.direction}`}>
                    <span>{formatDisplayDate(movement.movement_date)} · {safeText(movement.direction)}</span>
                    <strong>{formatPcs(movement.qty_pcs || movement.qty)} · {safeText(movement.source_id)}</strong>
                  </div>
                ))
              )}
            </div>

            <div className="da-modal-note" style={{ marginTop: 14 }}>
              Stok jadi harus tetap bisa ditelusuri dari Produksi/Adukan sampai Order/Kasir dan alokasi PO.
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
