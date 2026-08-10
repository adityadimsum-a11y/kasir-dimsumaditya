import { useEffect, useMemo, useState } from "react";
import {
  createOwnerPeriodClosingRevision,
  createOwnerPeriodClosingSnapshot,
  getArchiveUniversalDetail,
  getOwnerPeriodReportBootstrap,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import UniversalTransactionDetailModal from "../../components/archive/UniversalTransactionDetailModal";
import { printOwnerPeriodReportA4 } from "../../lib/print/reportPrint";

function isAuthRequired(result) {
  const code = String(result?.code || result?.error?.code || "").toUpperCase();
  return code === "UNAUTHORIZED" || code === "SESSION_EXPIRED" || code === "AUTH_REQUIRED";
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function today() {
  return localDateString(new Date());
}

function firstDayThisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function text(value, fallback = "-") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function number(value) {
  const n = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatKg(value) {
  return `${number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg`;
}

function formatPcs(value) {
  return `${number(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })} pcs`;
}

function makeOperationId(prefix = "OP-CLOSE") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

const TABS = [
  ["summary", "Ringkasan"],
  ["money", "Arus Uang"],
  ["position", "Posisi Usaha"],
  ["closing", "Closing & Riwayat"],
];

export default function ClosingOwnerPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [revisionSaving, setRevisionSaving] = useState(false);
  const [revisionDraft, setRevisionDraft] = useState({ revision_type: "CATATAN_REVISI", reason: "" });
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState({});
  const [filters, setFilters] = useState({ date_start: firstDayThisMonth(), date_end: today(), location_id: "ALL" });
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeDetailId, setActiveDetailId] = useState("");
  const [activeDetailModule, setActiveDetailModule] = useState("");

  const sessionToken = session?.sessionToken || session?.session_token || "";
  const summary = data.summary || {};
  const health = data.health || {};
  const sections = data.sections || {};
  const records = Array.isArray(data.recent_records) ? data.recent_records : [];
  const locationOptions = Array.isArray(data.location_options) ? data.location_options : [];
  const periodClosings = Array.isArray(data.period_closings) ? data.period_closings : [];
  const closingRevisions = Array.isArray(data.closing_revisions) ? data.closing_revisions : [];
  const currentClosing = data.current_closing || null;
  const moneyRows = Array.isArray(sections.money_flow) ? sections.money_flow : [];
  const obligationRows = Array.isArray(sections.obligations) ? sections.obligations : [];
  const stockRows = Array.isArray(sections.stock_flow) ? sections.stock_flow : [];
  const actionRows = Array.isArray(sections.action_notes) ? sections.action_notes : [];
  const isLocked = Boolean(health.closing_locked || currentClosing?.closing_id || summary.closing_id);
  const rowsWithoutSource = number(health.rows_without_source || health.wallet_mutations_without_source);
  const netCash = number(summary.money_in_actual) - number(summary.money_out_actual);

  const periodLabel = useMemo(() => `${formatDate(filters.date_start)} – ${formatDate(filters.date_end)}`, [filters.date_start, filters.date_end]);
  const locationLabel = useMemo(() => {
    if (filters.location_id === "ALL") return "Semua Lokasi";
    const found = locationOptions.find((loc) => String(loc.location_id || loc.id || loc.code) === String(filters.location_id));
    return found?.location_name || found?.name || found?.label || filters.location_id;
  }, [filters.location_id, locationOptions]);

  async function loadData(nextFilters = filters) {
    if (!sessionToken) return;
    setLoading(true);
    setError("");
    try {
      const result = await getOwnerPeriodReportBootstrap(sessionToken, nextFilters);
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Laporan Owner belum dapat dibaca.");
        setData({});
        return;
      }
      setData(result.data || {});
    } catch (err) {
      setError(err?.message || "Laporan Owner belum dapat dibaca.");
      setData({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  function updateFilter(field, value) {
    setFilters((old) => ({ ...old, [field]: value }));
  }

  function handlePullPeriod(event) {
    event.preventDefault();
    setSuccess("");
    loadData(filters);
  }

  function requestLockPeriod() {
    setError("");
    setSuccess("");
    if (isLocked) {
      setError("Periode ini sudah mempunyai snapshot closing.");
      return;
    }
    if (rowsWithoutSource > 0) {
      setError("Masih ada mutasi tanpa sumber. Rapikan sumber transaksi sebelum menyimpan snapshot periode.");
      return;
    }
    setLockConfirmOpen(true);
  }

  async function executeLockPeriod() {
    setLocking(true);
    setError("");
    try {
      const result = await createOwnerPeriodClosingSnapshot(sessionToken, { ...filters, operation_id: makeOperationId() });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Snapshot periode belum dapat disimpan.");
        return;
      }
      const closingId = result?.data?.closing?.closing_id || result?.data?.closing_id || "";
      setSuccess(closingId ? `Snapshot periode tersimpan: ${closingId}` : "Snapshot periode berhasil disimpan.");
      setLockConfirmOpen(false);
      await loadData(filters);
    } catch (err) {
      setError(err?.message || "Snapshot periode belum dapat disimpan.");
    } finally {
      setLocking(false);
    }
  }

  async function handleCreateRevision(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!isLocked) {
      setError("Catatan revisi hanya tersedia setelah snapshot periode dikunci.");
      return;
    }
    const reason = text(revisionDraft.reason, "");
    if (!reason || reason === "-") {
      setError("Alasan revisi wajib diisi.");
      return;
    }

    setRevisionSaving(true);
    try {
      const result = await createOwnerPeriodClosingRevision(sessionToken, {
        ...filters,
        closing_id: currentClosing?.closing_id || summary.closing_id || "",
        revision_type: revisionDraft.revision_type,
        reason,
        operation_id: makeOperationId("OP-REV"),
      });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Catatan revisi belum dapat disimpan.");
        return;
      }
      const revisionId = result?.data?.revision?.revision_id || result?.data?.revision_id || "";
      setSuccess(revisionId ? `Catatan revisi tersimpan: ${revisionId}` : "Catatan revisi berhasil disimpan.");
      setRevisionDraft({ revision_type: "CATATAN_REVISI", reason: "" });
      setRevisionOpen(false);
      await loadData(filters);
    } catch (err) {
      setError(err?.message || "Catatan revisi belum dapat disimpan.");
    } finally {
      setRevisionSaving(false);
    }
  }

  async function openArchiveDetail(rowOrId, moduleName = "") {
    const sourceId = typeof rowOrId === "string" ? rowOrId : rowOrId?.source_id || rowOrId?.transaction_id;
    const sourceModule = typeof rowOrId === "string" ? moduleName : rowOrId?.source_module || rowOrId?.module;
    if (!sourceId || !sessionToken) return;
    setActiveDetailId(sourceId);
    setActiveDetailModule(sourceModule || "");
    setDetailLoading(true);
    setDetail(null);
    try {
      const result = await getArchiveUniversalDetail(sessionToken, { source_id: sourceId, source_module: sourceModule || "" });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Detail transaksi belum dapat dibaca dari Arsip Digital.");
        return;
      }
      setDetail(result.data || {});
    } catch (err) {
      setError(err?.message || "Detail transaksi belum dapat dibaca dari Arsip Digital.");
    } finally {
      setDetailLoading(false);
    }
  }

  const closingStatus = isLocked ? "DIKUNCI" : rowsWithoutSource > 0 ? "PERLU DITELUSURI" : "SIAP DIREVIEW";
  const closingTone = isLocked ? "success" : rowsWithoutSource > 0 ? "danger" : "warning";

  return (
    <div className="da-page da-report16-page">
      <PageHeader
        eyebrow="LAPORAN & ARSIP · OWNER"
        title="Laporan Owner"
        description="Ringkas arus uang periode, posisi usaha saat ini, dan simpan snapshot closing tanpa mengubah transaksi sumber."
        actions={(
          <div className="da-report16-header-actions">
            <Button variant="secondary" onClick={() => loadData(filters)} disabled={loading}>{loading ? "Memuat..." : "Perbarui"}</Button>
            <Button variant="secondary" onClick={() => printOwnerPeriodReportA4({ data, periodLabel, locationLabel })}>Cetak A4</Button>
            {isLocked ? (
              <Button onClick={() => setRevisionOpen(true)}>Catat Revisi</Button>
            ) : (
              <Button onClick={requestLockPeriod} disabled={loading || locking}>{locking ? "Menyimpan..." : "Simpan Snapshot"}</Button>
            )}
          </div>
        )}
      />

      {error ? <div className="da-form-error">{error}</div> : null}
      {success ? <div className="da-form-success">{success}</div> : null}

      <Card className="da-report16-filter-card">
        <form className="da-report16-filter-grid" onSubmit={handlePullPeriod}>
          <label className="da-field"><span>Dari</span><input type="date" value={filters.date_start} onChange={(event) => updateFilter("date_start", event.target.value)} /></label>
          <label className="da-field"><span>Sampai</span><input type="date" value={filters.date_end} onChange={(event) => updateFilter("date_end", event.target.value)} /></label>
          <label className="da-field da-report16-location"><span>Lokasi</span><select value={filters.location_id} onChange={(event) => updateFilter("location_id", event.target.value)}><option value="ALL">Semua Lokasi</option>{locationOptions.map((loc) => <option key={loc.location_id || loc.id || loc.code} value={loc.location_id || loc.id || loc.code}>{loc.location_name || loc.name || loc.label || loc.location_id}</option>)}</select></label>
          <Button type="submit" disabled={loading}>{loading ? "Menarik..." : "Terapkan"}</Button>
        </form>
      </Card>

      <section className="da-report16-hero da-print-area">
        <div className="da-report16-hero-main">
          <span>ARUS KAS BERSIH PERIODE</span>
          <strong>{formatRupiah(netCash)}</strong>
          <p>{periodLabel} · {locationLabel}</p>
          <Badge tone={closingTone}>{closingStatus}</Badge>
        </div>
        <div className="da-report16-hero-metrics">
          <div><span>Uang Masuk</span><strong>{formatRupiah(summary.money_in_actual)}</strong></div>
          <div><span>Uang Keluar</span><strong>{formatRupiah(summary.money_out_actual)}</strong></div>
          <div><span>Jejak Sumber</span><strong>{number(summary.records_count).toLocaleString("id-ID")}</strong></div>
          <div><span>Perlu Sumber</span><strong>{rowsWithoutSource.toLocaleString("id-ID")}</strong></div>
        </div>
      </section>

      <div className="da-report16-tabs" role="tablist">
        {TABS.map(([key, label]) => <button key={key} type="button" className={activeTab === key ? "active" : ""} onClick={() => setActiveTab(key)}>{label}</button>)}
      </div>

      <div className="da-report16-tab-body da-print-area">
        {activeTab === "summary" ? (
          <div className="da-report16-summary-grid">
            <Card title="Posisi Usaha" description="Saldo kewajiban dan stok ini adalah posisi saat laporan ditarik, bukan seluruhnya arus periode.">
              <div className="da-report16-position-grid">
                <div><span>Piutang Terbuka</span><strong>{formatRupiah(summary.open_receivables)}</strong></div>
                <div><span>Hutang Nana</span><strong>{formatRupiah(summary.hutang_nana_open)}</strong></div>
                <div><span>Kewajiban Owner</span><strong>{formatRupiah(summary.owner_obligation_remaining)}</strong></div>
                <div><span>Payroll Belum Dibayar</span><strong>{formatRupiah(summary.payroll_unpaid)}</strong></div>
                <div><span>Sisa Ayam</span><strong>{formatKg(summary.chicken_remaining_kg)}</strong></div>
                <div><span>Stok Siap Jual</span><strong>{formatPcs(summary.finished_stock_ready_pcs)}</strong></div>
              </div>
            </Card>
            <Card title="Prioritas Owner" description="Sinyal dari transaksi hidup dan sumber yang dibaca sistem.">
              <div className="da-report16-action-list">
                {actionRows.length ? actionRows.map((row) => (
                  <div key={row.key || row.title}>
                    <Badge tone={row.tone || "default"}>{text(row.priority, "Pantau")}</Badge>
                    <div><strong>{text(row.title)}</strong><p>{text(row.note)}</p></div>
                  </div>
                )) : <div className="da-report16-empty">Belum ada prioritas khusus pada periode ini.</div>}
              </div>
            </Card>
            <Card className="da-report16-recent" title="Transaksi Sumber Terbaru" description="Klik transaksi untuk membuka detail Arsip Digital tanpa meninggalkan laporan.">
              <DataTable
                rows={records.slice(0, 20)}
                getRowKey={(row, index) => row.source_id || index}
                onRowClick={openArchiveDetail}
                columns={[
                  { key: "date", label: "Tanggal", render: (row) => formatDate(row.date || row.created_at) },
                  { key: "source_module", label: "Modul", render: (row) => text(row.source_module) },
                  { key: "source_id", label: "ID", render: (row) => <strong>{text(row.source_id)}</strong> },
                  { key: "title", label: "Keterangan", render: (row) => text(row.title || row.description) },
                  { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
                ]}
              />
            </Card>
          </div>
        ) : null}

        {activeTab === "money" ? (
          <div className="da-report16-two-column">
            <Card title="Arus Uang Periode" description="Penerimaan dan pengeluaran aktual. Perpindahan internal tidak dianggap omzet baru.">
              <DataTable rows={moneyRows} getRowKey={(row, index) => row.id || index} columns={[
                { key: "label", label: "Kategori" },
                { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
                { key: "count", label: "Transaksi" },
                { key: "note", label: "Catatan", render: (row) => text(row.note) },
              ]} />
            </Card>
            <Card title="Ringkasan Kas" description="Angka periode yang benar-benar bergerak pada dompet usaha.">
              <div className="da-report16-cash-card">
                <div><span>Masuk</span><strong>{formatRupiah(summary.money_in_actual)}</strong></div>
                <div><span>Keluar</span><strong>{formatRupiah(summary.money_out_actual)}</strong></div>
                <div className="is-total"><span>Netto</span><strong>{formatRupiah(netCash)}</strong></div>
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === "position" ? (
          <div className="da-report16-two-column">
            <Card title="Kewajiban & Tagihan" description="Posisi outstanding yang masih perlu dipantau saat laporan ditarik.">
              <DataTable rows={obligationRows} getRowKey={(row, index) => row.id || index} columns={[
                { key: "label", label: "Bagian" },
                { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
                { key: "count", label: "Jumlah" },
                { key: "status", label: "Status", render: (row) => <Badge tone={row.tone || "default"}>{text(row.status)}</Badge> },
              ]} />
            </Card>
            <Card title="Persediaan" description="Posisi ayam dan stok jadi berdasarkan layer stok aktif.">
              <DataTable rows={stockRows} getRowKey={(row, index) => row.id || index} columns={[
                { key: "label", label: "Bagian" },
                { key: "qty", label: "Qty", render: (row) => row.unit === "kg" ? formatKg(row.qty) : formatPcs(row.qty) },
                { key: "amount", label: "Nilai", render: (row) => row.amount ? formatRupiah(row.amount) : "-" },
              ]} />
            </Card>
          </div>
        ) : null}

        {activeTab === "closing" ? (
          <div className="da-report16-closing-grid">
            <Card title="Status Closing" description="Snapshot mengunci angka laporan periode; transaksi sumber tetap berada di modul asal.">
              <div className="da-report16-closing-status">
                <div><span>Status</span><strong>{isLocked ? "Periode Dikunci" : "Belum Dikunci"}</strong><Badge tone={closingTone}>{closingStatus}</Badge></div>
                <div><span>Closing ID</span><strong>{text(currentClosing?.closing_id || summary.closing_id)}</strong></div>
                <div><span>Perlu Sumber</span><strong>{rowsWithoutSource.toLocaleString("id-ID")}</strong></div>
              </div>
              <div className="da-report16-card-actions">
                {!isLocked ? <Button onClick={requestLockPeriod} disabled={locking || rowsWithoutSource > 0}>Simpan Snapshot</Button> : <Button onClick={() => setRevisionOpen(true)}>Catat Revisi</Button>}
              </div>
            </Card>
            <Card title="Catatan Revisi" description="Revisi tidak mengubah angka snapshot. Koreksi tetap dilakukan di transaksi sumber.">
              <DataTable rows={closingRevisions} getRowKey={(row, index) => row.revision_id || index} columns={[
                { key: "created_at", label: "Tanggal", render: (row) => formatDate(row.created_at || row.date) },
                { key: "revision_type", label: "Jenis", render: (row) => text(row.revision_type) },
                { key: "reason", label: "Catatan", render: (row) => text(row.reason || row.note) },
                { key: "status", label: "Status", render: (row) => <Badge tone="warning">{text(row.status || "OPEN")}</Badge> },
              ]} />
            </Card>
            <Card className="da-report16-history" title="Riwayat Snapshot" description="Riwayat periode yang sudah disimpan untuk kebutuhan audit.">
              <DataTable rows={periodClosings} getRowKey={(row, index) => row.closing_id || index} columns={[
                { key: "date_start", label: "Periode", render: (row) => `${formatDate(row.date_start)} – ${formatDate(row.date_end)}` },
                { key: "closing_id", label: "Closing ID", render: (row) => <strong>{text(row.closing_id)}</strong> },
                { key: "location_name", label: "Lokasi", render: (row) => text(row.location_name || row.location_id || "Semua Lokasi") },
                { key: "money_in_actual", label: "Uang Masuk", render: (row) => formatRupiah(row.money_in_actual || 0) },
                { key: "status", label: "Status", render: (row) => <Badge tone="success">{text(row.status || "LOCKED")}</Badge> },
              ]} />
            </Card>
          </div>
        ) : null}
      </div>

      <section className="da-report16-print-sheet" aria-hidden="true">
        <header className="da-report16-print-head">
          <div><span>DIMSUM ADITYA</span><h1>Laporan Owner Periode</h1><p>{periodLabel} · {locationLabel}</p></div>
          <div><strong>{isLocked ? "LOCKED" : "DRAFT"}</strong><small>{text(currentClosing?.closing_id || summary.closing_id, "Belum ada Closing ID")}</small></div>
        </header>
        <div className="da-report16-print-kpis">
          <div><span>Uang Masuk</span><strong>{formatRupiah(summary.money_in_actual)}</strong></div>
          <div><span>Uang Keluar</span><strong>{formatRupiah(summary.money_out_actual)}</strong></div>
          <div><span>Arus Bersih</span><strong>{formatRupiah(netCash)}</strong></div>
          <div><span>Jejak Sumber</span><strong>{number(summary.records_count).toLocaleString("id-ID")}</strong></div>
        </div>
        <div className="da-report16-print-grid">
          <div><h2>Posisi Usaha</h2><table><tbody>
            <tr><td>Piutang Terbuka</td><td>{formatRupiah(summary.open_receivables)}</td></tr>
            <tr><td>Hutang Nana</td><td>{formatRupiah(summary.hutang_nana_open)}</td></tr>
            <tr><td>Kewajiban Owner</td><td>{formatRupiah(summary.owner_obligation_remaining)}</td></tr>
            <tr><td>Payroll Belum Dibayar</td><td>{formatRupiah(summary.payroll_unpaid)}</td></tr>
            <tr><td>Sisa Ayam</td><td>{formatKg(summary.chicken_remaining_kg)}</td></tr>
            <tr><td>Stok Siap Jual</td><td>{formatPcs(summary.finished_stock_ready_pcs)}</td></tr>
          </tbody></table></div>
          <div><h2>Arus Uang</h2><table><tbody>{moneyRows.map((row) => <tr key={`print-money-${row.id}`}><td>{row.label}</td><td>{formatRupiah(row.amount)}</td><td>{row.count || 0} trx</td></tr>)}</tbody></table></div>
        </div>
        <div className="da-report16-print-grid">
          <div><h2>Kewajiban</h2><table><tbody>{obligationRows.map((row) => <tr key={`print-obl-${row.id}`}><td>{row.label}</td><td>{formatRupiah(row.amount)}</td><td>{text(row.status)}</td></tr>)}</tbody></table></div>
          <div><h2>Persediaan</h2><table><tbody>{stockRows.map((row) => <tr key={`print-stock-${row.id}`}><td>{row.label}</td><td>{row.unit === "kg" ? formatKg(row.qty) : formatPcs(row.qty)}</td><td>{row.amount ? formatRupiah(row.amount) : "-"}</td></tr>)}</tbody></table></div>
        </div>
        <div className="da-report16-print-recent"><h2>Jejak Transaksi Terbaru</h2><table><thead><tr><th>Tanggal</th><th>Modul</th><th>ID</th><th>Keterangan</th><th>Nominal</th></tr></thead><tbody>{records.slice(0, 30).map((row, index) => <tr key={`print-rec-${row.source_id || index}`}><td>{formatDate(row.date || row.created_at)}</td><td>{text(row.source_module)}</td><td>{text(row.source_id)}</td><td>{text(row.title || row.description)}</td><td>{formatRupiah(row.amount || 0)}</td></tr>)}</tbody></table></div>
        <footer>Dicetak dari ERP Dimsum Aditya · Snapshot laporan tidak membuat transaksi baru.</footer>
      </section>

      <Modal open={lockConfirmOpen} title="Simpan Snapshot Periode" subtitle={`${periodLabel} · ${locationLabel}`} onClose={() => !locking && setLockConfirmOpen(false)} size="md">
        <div className="da-report16-confirm">
          <p>Snapshot akan menyimpan angka laporan periode ini dan mengaktifkan lock closing. Tindakan ini tidak membuat mutasi dompet, jurnal, stok, atau pembagian 4 Amplop baru.</p>
          <div className="da-report16-confirm-grid">
            <div><span>Uang Masuk</span><strong>{formatRupiah(summary.money_in_actual)}</strong></div>
            <div><span>Uang Keluar</span><strong>{formatRupiah(summary.money_out_actual)}</strong></div>
            <div><span>Jejak Sumber</span><strong>{number(summary.records_count).toLocaleString("id-ID")}</strong></div>
            <div><span>Perlu Sumber</span><strong>{rowsWithoutSource.toLocaleString("id-ID")}</strong></div>
          </div>
          <div className="da-report16-modal-actions"><Button variant="secondary" onClick={() => setLockConfirmOpen(false)} disabled={locking}>Batal</Button><Button onClick={executeLockPeriod} disabled={locking}>{locking ? "Menyimpan..." : "Simpan & Kunci Periode"}</Button></div>
        </div>
      </Modal>

      <Modal open={revisionOpen} title="Catat Revisi Closing" subtitle="Catatan audit non-destruktif; koreksi transaksi tetap dilakukan dari modul sumber." onClose={() => !revisionSaving && setRevisionOpen(false)} size="md">
        <form className="da-report16-revision-form" onSubmit={handleCreateRevision}>
          <label className="da-field"><span>Jenis Catatan</span><select value={revisionDraft.revision_type} onChange={(event) => setRevisionDraft((old) => ({ ...old, revision_type: event.target.value }))}><option value="CATATAN_REVISI">Catatan Revisi</option><option value="PERLU_KOREKSI_SUMBER">Perlu Koreksi Sumber</option><option value="BUKA_PANTAUAN">Pantauan Owner</option></select></label>
          <label className="da-field"><span>Alasan / Catatan</span><textarea rows="5" value={revisionDraft.reason} onChange={(event) => setRevisionDraft((old) => ({ ...old, reason: event.target.value }))} placeholder="Jelaskan koreksi yang perlu dilakukan pada transaksi sumber." /></label>
          <div className="da-report16-modal-actions"><Button type="button" variant="secondary" onClick={() => setRevisionOpen(false)} disabled={revisionSaving}>Batal</Button><Button type="submit" disabled={revisionSaving}>{revisionSaving ? "Menyimpan..." : "Simpan Catatan"}</Button></div>
        </form>
      </Modal>

      <UniversalTransactionDetailModal
        open={Boolean(activeDetailId) || detailLoading}
        loading={detailLoading}
        detail={detail}
        activeId={activeDetailId}
        activeModule={activeDetailModule}
        onClose={() => { setDetail(null); setDetailLoading(false); setActiveDetailId(""); setActiveDetailModule(""); }}
        onRefresh={() => openArchiveDetail(activeDetailId, activeDetailModule)}
        onOpenId={openArchiveDetail}
        sessionToken={sessionToken}
        onSessionExpired={onSessionExpired}
      />
    </div>
  );
}
