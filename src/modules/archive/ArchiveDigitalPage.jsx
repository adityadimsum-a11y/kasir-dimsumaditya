import { useEffect, useMemo, useState } from "react";
import {
  getArchiveUniversalBootstrap,
  getArchiveUniversalDetail,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.error?.code || result?.code || "").toUpperCase();

  return (
    code.includes("AUTH_REQUIRED") ||
    message.includes("AUTH_REQUIRED") ||
    (message.includes("SESSION") && message.includes("TIDAK AKTIF"))
  );
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getToneByStatus(status) {
  const text = String(status || "").toUpperCase();
  if (text.includes("LUNAS") || text.includes("POSTED") || text.includes("CLOSED") || text.includes("APPROVED") || text.includes("SELESAI")) return "success";
  if (text.includes("BELUM") || text.includes("OPEN") || text.includes("PARTIAL") || text.includes("DRAFT") || text.includes("PENDING")) return "warning";
  if (text.includes("VOID") || text.includes("CANCEL") || text.includes("REJECT") || text.includes("ERROR")) return "danger";
  return "default";
}

function moduleLabel(value) {
  return safeText(String(value || "").replaceAll("_", " "));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function buildColumns(onOpen) {
  return [
    { key: "date", label: "Tanggal", render: (row) => formatDate(row.date) },
    { key: "source_module", label: "Modul", render: (row) => moduleLabel(row.source_label || row.source_module) },
    { key: "source_id", label: "ID", render: (row) => <strong>{safeText(row.source_id)}</strong> },
    { key: "title", label: "Keterangan", render: (row) => safeText(row.title || row.description) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
    { key: "status", label: "Status", render: (row) => <Badge tone={getToneByStatus(row.status)}>{safeText(row.status, "Tercatat")}</Badge> },
    { key: "action", label: "Aksi", render: (row) => <Button variant="ghost" onClick={(event) => { event.stopPropagation(); onOpen(row); }}>Detail</Button> },
  ];
}

function RawFields({ fields = {} }) {
  const entries = Object.entries(fields || {}).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    return String(value).trim() !== "";
  });

  if (!entries.length) {
    return <p className="da-muted">Belum ada field mentah yang terbaca.</p>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
      {entries.slice(0, 80).map(([key, value]) => (
        <div key={key} className="da-card" style={{ padding: 12, boxShadow: "none" }}>
          <div className="da-mini-title">{key}</div>
          <div style={{ marginTop: 6, fontWeight: 750, overflowWrap: "anywhere" }}>{String(value)}</div>
        </div>
      ))}
    </div>
  );
}

function DetailModal({ detail, loading, onClose, onOpenRelated }) {
  const main = detail?.main || {};
  const timeline = asArray(detail?.timeline || detail?.related_records);
  const audit = asArray(detail?.audit_trail);
  const relationIds = asArray(detail?.relation_ids);

  return (
    <Modal
      open={Boolean(detail) || loading}
      title={loading ? "Membuka Arsip..." : `Detail Arsip ${safeText(main.source_id || main.id)}`}
      subtitle={loading ? "Mohon tunggu sebentar." : moduleLabel(main.source_label || main.source_module)}
      onClose={onClose}
    >
      {loading ? (
        <p className="da-muted">Sedang membaca rantai transaksi dan ID terkait...</p>
      ) : (
        <>
          <div className="da-modal-summary">
            <div>
              <div className="da-mini-title">Transaksi Utama</div>
              <div className="da-big-text">{safeText(main.title || main.description)}</div>
              <p className="da-muted">{safeText(main.source_id)} · {formatDate(main.date)}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <Badge tone={getToneByStatus(main.status)}>{safeText(main.status, "Tercatat")}</Badge>
              <div style={{ marginTop: 12, fontWeight: 900 }}>{formatRupiah(main.amount || 0)}</div>
            </div>
          </div>

          <div className="da-modal-note">
            Arsip ini dibuka lazy saat ID diklik. Rantai detail dibatasi ringan agar cepat; kalau perlu data paling fresh, klik Refresh Detail / Refresh Data.
          </div>

          <Card style={{ marginBottom: 14 }}>
            <div className="da-mini-title">ID yang Terhubung</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {relationIds.length ? relationIds.slice(0, 40).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="da-button da-button-ghost"
                  style={{ padding: "7px 10px", fontSize: 12 }}
                  onClick={() => onOpenRelated(id)}
                >
                  {id}
                </button>
              )) : <span className="da-muted">Belum ada ID terkait.</span>}
            </div>
          </Card>

          <Card style={{ marginBottom: 14 }}>
            <div className="da-mini-title">Timeline / Rantai Terkait</div>
            <div style={{ marginTop: 12 }}>
              <DataTable
                columns={[
                  { key: "date", label: "Tanggal", render: (row) => formatDate(row.date) },
                  { key: "source_module", label: "Modul", render: (row) => moduleLabel(row.source_label || row.source_module) },
                  { key: "source_id", label: "ID", render: (row) => <strong>{safeText(row.source_id)}</strong> },
                  { key: "title", label: "Keterangan", render: (row) => safeText(row.title) },
                  { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
                  { key: "status", label: "Status", render: (row) => <Badge tone={getToneByStatus(row.status)}>{safeText(row.status, "Tercatat")}</Badge> },
                ]}
                rows={timeline}
                getRowKey={(row, index) => `${row.source_module}-${row.source_id}-${index}`}
                onRowClick={(row) => onOpenRelated(row.source_id, row.source_module)}
              />
            </div>
          </Card>

          <Card style={{ marginBottom: 14 }}>
            <div className="da-mini-title">Field Transaksi Mentah</div>
            <div style={{ marginTop: 12 }}>
              <RawFields fields={main.raw || main.record || {}} />
            </div>
          </Card>

          <Card>
            <div className="da-mini-title">Audit / Jejak Edit</div>
            <div style={{ marginTop: 12 }}>
              <DataTable
                columns={[
                  { key: "created_at", label: "Waktu", render: (row) => formatDate(row.created_at || row.timestamp || row.date) },
                  { key: "action", label: "Aksi", render: (row) => safeText(row.action || row.event || row.activity) },
                  { key: "user", label: "User", render: (row) => safeText(row.user_name || row.user || row.created_by) },
                  { key: "note", label: "Catatan", render: (row) => safeText(row.note || row.description || row.message) },
                ]}
                rows={audit}
                getRowKey={(row, index) => `${row.audit_id || row.id || index}`}
              />
            </div>
          </Card>
        </>
      )}
    </Modal>
  );
}

export default function ArchiveDigitalPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ query: "", module: "", limit: 20 });
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const results = useMemo(() => asArray(data?.results || data?.recent_records), [data]);
  const modules = useMemo(() => asArray(data?.module_stats), [data]);
  const warnings = useMemo(() => asArray(data?.warnings), [data]);
  const summary = data?.summary || {};

  const loadData = async (nextFilters = filters, options = {}) => {
    setLoading(true);
    setError("");

    const result = await getArchiveUniversalBootstrap(session?.sessionToken, {
      source: "frontend_part_8c_archive_lightweight",
      query: nextFilters.query,
      source_module: nextFilters.module,
      limit: nextFilters.limit || 20,
      skip_health: true,
      cache_seconds: 45,
      force_refresh: Boolean(options.forceRefresh),
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal membaca Arsip Digital.");
      setData(null);
      setLoading(false);
      return;
    }

    setData(result.data || {});
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionToken]);

  const submitSearch = (event) => {
    event.preventDefault();
    loadData(filters);
  };

  const openDetail = async (rowOrId, moduleName = "") => {
    const sourceId = typeof rowOrId === "string" ? rowOrId : rowOrId?.source_id;
    const sourceModule = typeof rowOrId === "string" ? moduleName : rowOrId?.source_module;
    if (!sourceId) return;

    setDetailLoading(true);
    setDetail(null);

    const result = await getArchiveUniversalDetail(session?.sessionToken, {
      source_id: sourceId,
      source_module: sourceModule || "",
      source: "frontend_part_8d_archive_lazy_detail",
      detail_mode: "fast",
      timeline_limit: 35,
      relation_limit: 80,
      audit_limit: 20,
      raw_preview_limit: 80,
      cache_seconds: 60,
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setDetail({
        main: {
          source_id: sourceId,
          source_module: sourceModule || "ARSIP",
          title: result.message || "Detail arsip tidak ditemukan.",
          amount: 0,
          status: "Perlu Dicek",
        },
        timeline: [],
        relation_ids: [sourceId],
        audit_trail: [],
      });
      setDetailLoading(false);
      return;
    }

    setDetail(result.data || {});
    setDetailLoading(false);
  };

  return (
    <div className="da-page">
      <PageHeader
        title="Arsip Digital"
        description="Cari ID transaksi dan buka detail rantainya. Semua angka penting harus bisa ditelusuri dari sumber hidup, bukan angka yatim."
        badge="Universal Detail"
      />

      <Card className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">BUKU ARSIP DIGITAL</div>
          <h2>Search Global → Detail ID → Timeline → Audit</h2>
          <p className="da-dashboard-banner-desc">
            Halaman ini tidak membuat transaksi baru. Fungsinya membuka nota digital dan rantai ID dari modul DROP, produksi, stok, order, uang, hutang, kewajiban owner, HRD/payroll, dan 4 Amplop.
          </p>
        </div>
        <div className="da-dashboard-banner-actions">
          <Badge tone={error ? "danger" : "success"}>{loading ? "Membaca..." : error ? "Perlu Dicek" : "Terhubung"}</Badge>
          <Button variant="ghost" onClick={() => loadData(filters, { forceRefresh: true })}>Refresh Data</Button>
        </div>
      </Card>

      {error ? (
        <Card>
          <Badge tone="danger">Error</Badge>
          <p className="da-muted" style={{ marginTop: 12 }}>{error}</p>
        </Card>
      ) : null}

      <div className="da-grid da-grid-3">
        <StatCard label="Total Arsip Bersih" value={formatNumber(summary.total_records || 0)} description="Hanya transaksi dengan ID asli." />
        <StatCard label="Modul Aktif" value={formatNumber(summary.modules_count || modules.length || 0)} description="Jumlah modul yang punya arsip/ID." />
        <StatCard label="Baris Perlu ID" value={formatNumber(summary.rows_without_transaction_id || 0)} description="Tidak ditampilkan sebagai transaksi normal." tone={(summary.rows_without_transaction_id || 0) ? "warning" : "success"} />
      </div>

      {(summary.rows_without_transaction_id || 0) ? (
        <Card style={{ marginTop: 14 }}>
          <Badge tone="warning">Perlu Rapih ID</Badge>
          <p className="da-muted" style={{ marginTop: 10 }}>
            Ada {formatNumber(summary.rows_without_transaction_id || 0)} baris lama/awal yang belum punya ID transaksi asli, jadi sengaja disembunyikan dari daftar arsip normal. Ini menjaga Arsip Digital tetap bersih dari ID buatan seperti TabOrders-ROW-2.
          </p>
          {warnings.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {warnings.slice(0, 12).map((item) => (
                <span key={item.source_module} className="da-badge da-badge-warning">
                  {moduleLabel(item.source_module)}: {formatNumber(item.count)}
                </span>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ marginTop: 14 }}>
        <div className="da-mini-title">Cari Arsip</div>
        <form className="da-filter-row" onSubmit={submitSearch} style={{ marginTop: 12 }}>
          <input
            className="da-input"
            placeholder="Cari ID, customer, supplier, produk, DROP, HUT, SMIN, ORDER..."
            value={filters.query}
            onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
          />
          <select
            className="da-select"
            value={filters.module}
            onChange={(event) => setFilters((prev) => ({ ...prev, module: event.target.value }))}
          >
            <option value="">Semua Modul</option>
            {modules.map((item) => (
              <option key={item.source_module} value={item.source_module}>
                {moduleLabel(item.source_label || item.source_module)} ({item.count || 0})
              </option>
            ))}
          </select>
          <Button type="submit">Cari</Button>
          <Button type="button" variant="ghost" onClick={() => { const reset = { query: "", module: "", limit: 60 }; setFilters(reset); loadData(reset); }}>Reset</Button>
        </form>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <div className="da-mini-title">Peta Modul Arsip</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 12 }}>
          {modules.length ? modules.map((item) => (
            <button
              key={item.source_module}
              type="button"
              className="da-card"
              style={{ padding: 14, textAlign: "left", boxShadow: "none", cursor: "pointer" }}
              onClick={() => {
                const next = { ...filters, module: item.source_module };
                setFilters(next);
                loadData(next);
              }}
            >
              <div className="da-mini-title">{moduleLabel(item.source_label || item.source_module)}</div>
              <div className="da-big-text">{formatNumber(item.count || 0)}</div>
              <p className="da-muted">Terbaru: {formatDate(item.latest_date)}</p>
            </button>
          )) : <p className="da-muted">Belum ada modul arsip yang terbaca.</p>}
        </div>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <div className="da-mini-title">Arsip / ID Transaksi</div>
        <p className="da-muted" style={{ marginTop: 8, marginBottom: 14 }}>
          Klik baris untuk membuka detail nota digital dan rantai ID terkait.
        </p>
        <DataTable
          columns={buildColumns(openDetail)}
          rows={results}
          getRowKey={(row, index) => `${row.source_module}-${row.source_id}-${index}`}
          onRowClick={openDetail}
        />
      </Card>

      <DetailModal
        detail={detail}
        loading={detailLoading}
        onClose={() => { setDetail(null); setDetailLoading(false); }}
        onOpenRelated={openDetail}
      />
    </div>
  );
}
