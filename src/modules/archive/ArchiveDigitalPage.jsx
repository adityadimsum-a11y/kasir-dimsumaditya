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
import PageHeader from "../../components/ui/PageHeader";
import UniversalTransactionDetailModal from "../../components/archive/UniversalTransactionDetailModal";

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || code.includes("UNAUTHORIZED") || code.includes("SESSION_EXPIRED") || (message.includes("SESSION") && message.includes("TIDAK AKTIF"));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "-") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function moduleLabel(value) {
  return safeText(String(value || "").replaceAll("_", " "));
}

function number(value) {
  const out = Number(value || 0);
  return Number.isFinite(out) ? out : 0;
}

function formatNumber(value) {
  return number(value).toLocaleString("id-ID");
}

function getToneByStatus(status) {
  const text = String(status || "").toUpperCase();
  if (text.includes("LUNAS") || text.includes("POSTED") || text.includes("CLOSED") || text.includes("APPROVED") || text.includes("SELESAI") || text.includes("ACTIVE")) return "success";
  if (text.includes("BELUM") || text.includes("OPEN") || text.includes("PARTIAL") || text.includes("DRAFT") || text.includes("PENDING")) return "warning";
  if (text.includes("VOID") || text.includes("CANCEL") || text.includes("REJECT") || text.includes("ERROR")) return "danger";
  return "default";
}

function resultColumns(onOpen) {
  return [
    { key: "date", label: "Tanggal", render: (row) => formatDate(row.date || row.created_at) },
    { key: "source_module", label: "Modul", render: (row) => moduleLabel(row.source_label || row.source_module) },
    { key: "source_id", label: "ID Transaksi", render: (row) => <strong>{safeText(row.source_id)}</strong> },
    { key: "title", label: "Keterangan", render: (row) => safeText(row.title || row.description) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
    { key: "status", label: "Status", render: (row) => <Badge tone={getToneByStatus(row.status)}>{safeText(row.status, "Tercatat")}</Badge> },
    { key: "action", label: "Aksi", render: (row) => <Button variant="ghost" onClick={(event) => { event.stopPropagation(); onOpen(row); }}>Buka</Button> },
  ];
}

const EMPTY_FILTERS = {
  query: "",
  module: "",
  status: "",
  date_from: "",
  date_to: "",
  limit: 25,
  offset: 0,
};

export default function ArchiveDigitalPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeDetailId, setActiveDetailId] = useState("");
  const [activeDetailModule, setActiveDetailModule] = useState("");

  const sessionToken = session?.sessionToken || session?.session_token || "";
  const results = useMemo(() => asArray(data?.results || data?.recent_records), [data]);
  const modules = useMemo(() => asArray(data?.module_stats), [data]);
  const statusStats = useMemo(() => asArray(data?.status_stats), [data]);
  const summary = data?.summary || {};
  const pagination = data?.pagination || {};
  const total = number(pagination.total ?? summary.total_records);
  const limit = Math.max(1, number(pagination.limit || filters.limit || 25));
  const offset = Math.max(0, number(pagination.offset || filters.offset || 0));
  const pageStart = total ? offset + 1 : 0;
  const pageEnd = Math.min(total, offset + results.length);
  const canPrevious = offset > 0;
  const canNext = offset + limit < total;

  async function loadData(nextFilters = filters) {
    if (!sessionToken) return;
    setLoading(true);
    setError("");
    try {
      const result = await getArchiveUniversalBootstrap(sessionToken, nextFilters);
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Arsip Digital belum dapat dibaca.");
        setData(null);
        return;
      }
      setData(result.data || {});
    } catch (err) {
      setError(err?.message || "Arsip Digital belum dapat dibaca.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let savedQuery = "";
    if (typeof window !== "undefined") {
      savedQuery = String(window.sessionStorage.getItem("da:global-search-query") || "").trim();
      if (savedQuery) window.sessionStorage.removeItem("da:global-search-query");
    }
    const initial = savedQuery ? { ...EMPTY_FILTERS, query: savedQuery } : EMPTY_FILTERS;
    setFilters(initial);
    loadData(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  function updateFilter(field, value) {
    setFilters((old) => ({ ...old, [field]: value, offset: 0 }));
  }

  function submitSearch(event) {
    event.preventDefault();
    loadData({ ...filters, offset: 0 });
  }

  function resetSearch() {
    setFilters(EMPTY_FILTERS);
    loadData(EMPTY_FILTERS);
  }

  function chooseModule(module) {
    const next = { ...filters, module, offset: 0 };
    setFilters(next);
    loadData(next);
  }

  function changePage(nextOffset) {
    const next = { ...filters, offset: Math.max(0, nextOffset) };
    setFilters(next);
    loadData(next);
  }

  async function openDetail(rowOrId, moduleName = "") {
    const sourceId = typeof rowOrId === "string" ? rowOrId : rowOrId?.source_id;
    const sourceModule = typeof rowOrId === "string" ? moduleName : rowOrId?.source_module;
    if (!sourceId || !sessionToken) return;

    setActiveDetailId(sourceId);
    setActiveDetailModule(sourceModule || "");
    setDetailLoading(true);
    setDetail(null);
    try {
      const result = await getArchiveUniversalDetail(sessionToken, {
        source_id: sourceId,
        source_module: sourceModule || "",
      });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setDetail({
          main: {
            source_id: sourceId,
            source_module: sourceModule || "ARSIP",
            title: result?.message || "Detail arsip belum dapat dibaca.",
            status: "PERLU DICEK",
            amount: 0,
          },
          timeline: [],
          relation_ids: [],
          audit_trail: [],
          attachments: [],
        });
        return;
      }
      setDetail(result.data || {});
    } catch (err) {
      setDetail({
        main: {
          source_id: sourceId,
          source_module: sourceModule || "ARSIP",
          title: err?.message || "Detail arsip belum dapat dibaca.",
          status: "PERLU DICEK",
          amount: 0,
        },
        timeline: [],
        relation_ids: [],
        audit_trail: [],
        attachments: [],
      });
    } finally {
      setDetailLoading(false);
    }
  }

  const topModules = modules.slice(0, 8);

  return (
    <div className="da-page da-report16-page">
      <PageHeader
        eyebrow="LAPORAN & ARSIP · PUSAT DOKUMEN"
        title="Arsip Digital"
        description="Cari transaksi, buka dokumen sumber, telusuri hubungan ID, cetak, dan audit dari satu ruang kerja."
        actions={(
          <Button variant="secondary" onClick={() => loadData(filters)} disabled={loading}>
            {loading ? "Memuat..." : "Perbarui"}
          </Button>
        )}
      />

      {error ? <div className="da-form-error">{error}</div> : null}

      <section className="da-archive16-hero">
        <div className="da-archive16-hero-main">
          <span>ARSIP TRANSAKSI</span>
          <strong>{formatNumber(total)}</strong>
          <p>{filters.query || filters.module || filters.status || filters.date_from || filters.date_to ? "Hasil sesuai filter aktif" : "Dokumen transaksi yang dapat ditelusuri"}</p>
        </div>
        <div className="da-archive16-hero-metrics">
          <div><span>Modul terbaca</span><strong>{formatNumber(summary.modules_count ?? modules.length)}</strong></div>
          <div><span>Ditampilkan</span><strong>{formatNumber(results.length)}</strong></div>
          <div><span>Perlu ID</span><strong>{formatNumber(summary.rows_without_transaction_id || 0)}</strong></div>
        </div>
      </section>

      <Card className="da-archive16-search-card">
        <form className="da-archive16-filter-grid" onSubmit={submitSearch}>
          <label className="da-field da-archive16-query">
            <span>Cari arsip</span>
            <input
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder="Customer, supplier, produk, order, DROP, HUT, ID transaksi..."
            />
          </label>
          <label className="da-field">
            <span>Modul</span>
            <select value={filters.module} onChange={(event) => updateFilter("module", event.target.value)}>
              <option value="">Semua modul</option>
              {modules.map((item) => (
                <option key={item.source_module} value={item.source_module}>
                  {moduleLabel(item.source_label || item.source_module)} ({formatNumber(item.count)})
                </option>
              ))}
            </select>
          </label>
          <label className="da-field">
            <span>Status</span>
            <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              <option value="">Semua status</option>
              {statusStats.map((item) => (
                <option key={item.status} value={item.status}>{safeText(item.status, "Tercatat")} ({formatNumber(item.count)})</option>
              ))}
            </select>
          </label>
          <label className="da-field">
            <span>Dari</span>
            <input type="date" value={filters.date_from} onChange={(event) => updateFilter("date_from", event.target.value)} />
          </label>
          <label className="da-field">
            <span>Sampai</span>
            <input type="date" value={filters.date_to} onChange={(event) => updateFilter("date_to", event.target.value)} />
          </label>
          <div className="da-archive16-filter-actions">
            <Button type="submit" disabled={loading}>{loading ? "Mencari..." : "Cari"}</Button>
            <Button type="button" variant="secondary" onClick={resetSearch}>Reset</Button>
          </div>
        </form>

        {topModules.length ? (
          <div className="da-archive16-module-chips" aria-label="Modul arsip">
            <button type="button" className={!filters.module ? "active" : ""} onClick={() => chooseModule("")}>Semua</button>
            {topModules.map((item) => (
              <button key={item.source_module} type="button" className={filters.module === item.source_module ? "active" : ""} onClick={() => chooseModule(item.source_module)}>
                <span>{moduleLabel(item.source_label || item.source_module)}</span>
                <strong>{formatNumber(item.count)}</strong>
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      <div className="da-archive16-workspace">
        <Card
          className="da-archive16-results"
          title="Dokumen Transaksi"
          description={total ? `${formatNumber(pageStart)}–${formatNumber(pageEnd)} dari ${formatNumber(total)} arsip` : "Belum ada arsip yang sesuai filter."}
        >
          <DataTable
            columns={resultColumns(openDetail)}
            rows={results}
            getRowKey={(row, index) => `${row.source_module}-${row.source_id}-${index}`}
            onRowClick={openDetail}
          />
          <div className="da-archive16-pagination">
            <span>{total ? `Halaman ${Math.floor(offset / limit) + 1} dari ${Math.max(1, Math.ceil(total / limit))}` : "0 arsip"}</span>
            <div>
              <Button variant="secondary" disabled={!canPrevious || loading} onClick={() => changePage(offset - limit)}>Sebelumnya</Button>
              <Button variant="secondary" disabled={!canNext || loading} onClick={() => changePage(offset + limit)}>Berikutnya</Button>
            </div>
          </div>
        </Card>

        <aside className="da-archive16-side">
          <Card title="Cara Kerja" description="Detail arsip selalu dibuka sebagai popup agar halaman utama tetap ringkas.">
            <div className="da-archive16-process">
              <div><span>01</span><strong>Cari</strong><small>Nama, ID, produk, supplier.</small></div>
              <div><span>02</span><strong>Buka Detail</strong><small>Ringkasan dan transaksi sumber.</small></div>
              <div><span>03</span><strong>Telusuri</strong><small>ID terkait, uang, stok/HPP.</small></div>
              <div><span>04</span><strong>Cetak & Audit</strong><small>Jejak cetak dan audit tetap tercatat.</small></div>
            </div>
          </Card>
          {number(summary.rows_without_transaction_id) > 0 ? (
            <Card tone="warning" title="Perlu Perapihan ID" description={`${formatNumber(summary.rows_without_transaction_id)} baris arsip belum mempunyai ID transaksi resmi.`} />
          ) : (
            <Card tone="success" title="Integritas ID" description="Tidak ada arsip tanpa ID transaksi pada scope pencarian ini." />
          )}
        </aside>
      </div>

      <UniversalTransactionDetailModal
        open={Boolean(activeDetailId) || detailLoading}
        loading={detailLoading}
        detail={detail}
        activeId={activeDetailId}
        activeModule={activeDetailModule}
        onClose={() => {
          setDetail(null);
          setDetailLoading(false);
          setActiveDetailId("");
          setActiveDetailModule("");
        }}
        onRefresh={() => openDetail(activeDetailId, activeDetailModule)}
        onOpenId={openDetail}
        sessionToken={sessionToken}
        onSessionExpired={onSessionExpired}
      />
    </div>
  );
}
