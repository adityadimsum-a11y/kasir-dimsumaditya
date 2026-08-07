import { useMemo, useState } from "react";
import { Copy, FileText, Printer, RefreshCw } from "lucide-react";
import { recordOperationalPrint } from "../../lib/api/actions";
import { printOperationalDetail } from "../../lib/print/operationalPrint.js";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import DataTable from "../ui/DataTable";
import Modal from "../ui/Modal";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import {
  asArray,
  getToneByStatus,
  moduleLabel,
  safeText,
} from "../../lib/archive/universalDetail";

function copyText(value) {
  const text = String(value || "").trim();
  if (!text) return;
  navigator.clipboard?.writeText(text).catch(() => {});
}

function meaningfulFields(fields = {}) {
  return Object.entries(fields || {})
    .filter(([key, value]) => {
      if (value === null || value === undefined || String(value).trim() === "") return false;
      const normalized = String(key).toLowerCase();
      return ![
        "raw",
        "payload",
        "metadata",
        "created_by_user_id",
        "updated_by_user_id",
      ].includes(normalized);
    })
    .slice(0, 36);
}

function filterTimeline(rows, type) {
  const keys = {
    money: ["WALLET", "PAYMENT", "CASH", "KAS", "SUPPLIER", "PAYABLE", "RECEIVABLE", "ENVELOPE", "OBLIGATION", "PAYROLL"],
    stock: ["STOCK", "CHICKEN", "DROP", "PRODUCTION", "ADUKAN", "DELIVERY", "RECEIVE", "INVENTORY", "ORDER"],
  };
  const wanted = keys[type] || [];
  return rows.filter((row) => {
    const haystack = `${row.source_module || ""} ${row.source_label || ""} ${row.title || ""} ${row.description || ""}`.toUpperCase();
    return wanted.some((key) => haystack.includes(key));
  });
}

function timelineColumns() {
  return [
    { key: "date", label: "Tanggal", render: (row) => formatDate(row.date || row.created_at) },
    { key: "source_module", label: "Modul", render: (row) => moduleLabel(row.source_label || row.source_module) },
    { key: "source_id", label: "ID", render: (row) => <strong>{safeText(row.source_id || row.id)}</strong> },
    { key: "title", label: "Keterangan", render: (row) => safeText(row.title || row.description) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
    { key: "status", label: "Status", render: (row) => <Badge tone={getToneByStatus(row.status)}>{safeText(row.status, "Tercatat")}</Badge> },
  ];
}

export default function UniversalTransactionDetailModal({
  open,
  loading,
  detail,
  activeId,
  activeModule,
  onClose,
  onRefresh,
  onOpenArchive,
  onOpenId,
  sessionToken = "",
  onSessionExpired,
}) {
  const [tab, setTab] = useState("summary");
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");

  const main = detail?.main || {};
  const timeline = asArray(detail?.timeline || detail?.related_records);
  const audit = asArray(detail?.audit_trail);
  const relationIds = asArray(detail?.relation_ids);
  const displayId = safeText(main.source_id || main.id || activeId);
  const displayModule = moduleLabel(main.source_label || main.source_module || activeModule || "Arsip Digital");
  const raw = main.raw || main.record || main;
  const fields = useMemo(() => meaningfulFields(raw), [raw]);
  const moneyTimeline = useMemo(() => filterTimeline(timeline, "money"), [timeline]);
  const stockTimeline = useMemo(() => filterTimeline(timeline, "stock"), [timeline]);

  const summaryRows = useMemo(() => [
    { label: "ID Transaksi", value: displayId },
    { label: "Modul", value: displayModule },
    { label: "Tanggal", value: formatDate(main.date || main.created_at) },
    { label: "Nominal", value: formatRupiah(main.amount || 0) || "Rp 0" },
    { label: "Status", value: safeText(main.status, "Tercatat") },
    { label: "Rantai Terkait", value: `${timeline.length} jejak` },
  ], [displayId, displayModule, main, timeline.length]);

  async function handleOperationalPrint() {
    setPrintError("");
    if (!displayId || !sessionToken) {
      setPrintError("Sesi atau ID transaksi tidak tersedia untuk mencatat jejak cetak.");
      return;
    }

    setPrinting(true);
    try {
      const operationId = `OP-PRINT-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      const result = await recordOperationalPrint(sessionToken, {
        transaction_id: displayId,
        source_module: main.source_module || activeModule || "",
        print_type: "OPERATIONAL_DOCUMENT",
        template_version: "ERP-OPERATIONS-V2",
        copies: 1,
        operation_id: operationId,
        request_id: operationId,
        idempotency_key: operationId,
      });

      const code = String(result?.error?.code || result?.code || "").toUpperCase();
      if (["AUTH_REQUIRED", "UNAUTHORIZED", "SESSION_EXPIRED"].includes(code)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setPrintError(result?.message || "Jejak cetak tidak dapat dicatat.");
        return;
      }

      printOperationalDetail({
        detail,
        activeId: displayId,
        activeModule: main.source_module || activeModule,
        printLogId: result?.data?.print_log_id || result?.data?.print_no || "",
      });
    } catch (error) {
      setPrintError(error?.message || "Dokumen gagal dibuka untuk dicetak.");
    } finally {
      setPrinting(false);
    }
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      size="xl"
      title={loading ? "Membuka detail transaksi..." : displayId}
      subtitle={loading ? "Membaca Arsip Digital dan rantai ID terkait." : displayModule}
      onClose={onClose}
    >
      {loading ? (
        <Card tone="warning">
          <Badge tone="warning">Membuka Detail</Badge>
          <p className="da-muted" style={{ marginTop: 12 }}>
            Sistem sedang membuka ID <strong>{safeText(activeId)}</strong>. Detail bersifat baca, tidak mengubah transaksi.
          </p>
        </Card>
      ) : (
        <div className="da-transaction-detail-v2">
          <section className="da-transaction-hero-v2">
            <div className="da-transaction-hero-copy">
              <div className="da-page-kicker">ARSIP TRANSAKSI</div>
              <h2>{safeText(main.title || main.description || displayId)}</h2>
              <p>{displayId} · {formatDate(main.date || main.created_at)}</p>
            </div>
            <div className="da-transaction-hero-value">
              <Badge tone={getToneByStatus(main.status)}>{safeText(main.status, "Tercatat")}</Badge>
              <strong>{formatRupiah(main.amount || 0) || "Rp 0"}</strong>
              <button type="button" className="da-id-copy-button" onClick={() => copyText(displayId)}>
                <Copy size={14} /> Copy ID
              </button>
            </div>
          </section>

          {printError ? <div className="da-form-error">{printError}</div> : null}

          <div className="da-transaction-toolbar-v2">
            <Button type="button" variant="secondary" onClick={onRefresh}><RefreshCw size={15} /> Refresh</Button>
            <Button type="button" onClick={handleOperationalPrint} disabled={printing || !displayId}><Printer size={15} /> {printing ? "Mencatat Cetak..." : "Cetak Dokumen"}</Button>
            <Button type="button" variant="secondary" onClick={onOpenArchive}><FileText size={15} /> Buka Arsip</Button>
          </div>

          <div className="da-transaction-tabs-v2" role="tablist">
            {[
              ["summary", "Ringkasan"],
              ["chain", `Rantai Transaksi (${timeline.length})`],
              ["money", `Uang & Jurnal (${moneyTimeline.length})`],
              ["stock", `Stok / HPP (${stockTimeline.length})`],
              ["docs", `Dokumen (${relationIds.length})`],
              ["audit", `Audit (${audit.length})`],
            ].map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          {tab === "summary" ? (
            <div className="da-transaction-summary-layout-v2">
              <Card title="Ringkasan Cepat" description="Informasi utama transaksi dan status saat ini.">
                <div className="da-transaction-summary-grid-v2">
                  {summaryRows.map((row) => (
                    <div key={row.label} className="da-transaction-summary-item-v2">
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Detail Operasional" description="Field transaksi yang tersimpan pada sumber utama.">
                <div className="da-transaction-field-grid-v2">
                  {fields.length ? fields.map(([key, value]) => (
                    <div key={key} className="da-transaction-field-v2">
                      <span>{String(key).replaceAll("_", " ")}</span>
                      <strong>{typeof value === "object" ? JSON.stringify(value) : String(value)}</strong>
                    </div>
                  )) : <p className="da-muted">Belum ada detail tambahan.</p>}
                </div>
              </Card>
            </div>
          ) : null}

          {tab === "chain" ? (
            <Card title="Benang Merah Transaksi" description="Klik baris untuk membuka ID terkait tanpa kehilangan konteks transaksi ini.">
              <DataTable columns={timelineColumns()} rows={timeline} getRowKey={(row, index) => `${row.source_module || "MOD"}-${row.source_id || row.id || index}-${index}`} onRowClick={(row) => onOpenId?.(row.source_id || row.id || row.transaction_id, row.source_module)} />
            </Card>
          ) : null}

          {tab === "money" ? (
            <Card title="Uang, Pembayaran & Jurnal" description="Jejak yang berkaitan dengan dompet, pembayaran, hutang/piutang, payroll, kewajiban, dan 4 Amplop.">
              <DataTable columns={timelineColumns()} rows={moneyTimeline} getRowKey={(row, index) => `money-${row.source_id || row.id || index}-${index}`} onRowClick={(row) => onOpenId?.(row.source_id || row.id || row.transaction_id, row.source_module)} />
            </Card>
          ) : null}

          {tab === "stock" ? (
            <Card title="Stok, Produksi & HPP" description="Jejak yang berkaitan dengan DROP, lot, produksi, inventory, order, dan distribusi.">
              <DataTable columns={timelineColumns()} rows={stockTimeline} getRowKey={(row, index) => `stock-${row.source_id || row.id || index}-${index}`} onRowClick={(row) => onOpenId?.(row.source_id || row.id || row.transaction_id, row.source_module)} />
            </Card>
          ) : null}

          {tab === "docs" ? (
            <div className="da-transaction-summary-layout-v2">
              <Card title="ID & Dokumen Terkait" description="Semua ID yang dapat ditelusuri dari transaksi ini.">
                <div className="da-related-id-grid-v2">
                  {relationIds.length ? relationIds.slice(0, 100).map((id) => (
                    <button key={id} type="button" onClick={() => onOpenId?.(id, "")}>{id}</button>
                  )) : <p className="da-muted">Belum ada ID terkait.</p>}
                </div>
              </Card>
              <Card title="Pencetakan" description="Cetak dari arsip membuat Print Log dan Audit, tidak mengubah ledger.">
                <div className="da-print-preview-card-v2">
                  <div><span>Dokumen</span><strong>{displayModule}</strong></div>
                  <div><span>ID</span><strong>{displayId}</strong></div>
                  <Button onClick={handleOperationalPrint} disabled={printing}>{printing ? "Mencatat Cetak..." : "Preview & Cetak"}</Button>
                </div>
              </Card>
            </div>
          ) : null}

          {tab === "audit" ? (
            <Card title="Audit Trail" description="Jejak sistem, approval, revisi, print, dan perubahan yang tercatat.">
              <DataTable
                columns={[
                  { key: "created_at", label: "Waktu", render: (row) => formatDate(row.created_at || row.date) },
                  { key: "action", label: "Aksi", render: (row) => safeText(row.action || row.event || row.status) },
                  { key: "actor", label: "Pengguna", render: (row) => safeText(row.actor_name || row.username || row.created_by || row.user_id) },
                  { key: "reason", label: "Catatan", render: (row) => safeText(row.reason || row.description || row.notes || row.message) },
                ]}
                rows={audit}
                getRowKey={(row, index) => row.audit_id || row.id || `audit-${index}`}
              />
            </Card>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
