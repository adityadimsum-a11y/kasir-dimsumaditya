import { useMemo, useState } from "react";
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

function RawFields({ fields = {} }) {
  const entries = Object.entries(fields || {}).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    return String(value).trim() !== "";
  });

  if (!entries.length) {
    return <p className="da-muted">Belum ada data mentah yang terbaca.</p>;
  }

  return (
    <div style={styles.rawGrid}>
      {entries.slice(0, 120).map(([key, value]) => (
        <div key={key} className="da-card" style={styles.rawItem}>
          <div className="da-mini-title">{key}</div>
          <div style={styles.rawValue}>{String(value)}</div>
        </div>
      ))}
    </div>
  );
}

function copyText(value) {
  const text = String(value || "").trim();
  if (!text) return;
  navigator.clipboard?.writeText(text).catch(() => {});
}

function buildSummaryRows(main, timeline) {
  return [
    { label: "ID Transaksi", value: safeText(main.source_id || main.id) },
    { label: "Modul", value: moduleLabel(main.source_label || main.source_module) },
    { label: "Tanggal", value: formatDate(main.date || main.created_at) },
    { label: "Nominal", value: formatRupiah(main.amount || 0) || "Rp 0" },
    { label: "Status", value: safeText(main.status, "Tercatat") },
    { label: "Rantai Terkait", value: `${timeline.length} baris` },
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
  const summaryRows = useMemo(() => buildSummaryRows(main, timeline), [main, timeline]);

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
        template_version: "ERP-V1",
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
      title={loading ? "Membuka detail transaksi..." : `Detail Transaksi ${displayId}`}
      subtitle={loading ? "Membaca Arsip Digital dan rantai ID terkait." : displayModule}
      onClose={onClose}
    >
      {loading ? (
        <Card>
          <Badge tone="warning">Membuka Detail</Badge>
          <p className="da-muted" style={{ marginTop: 12 }}>
            Sistem sedang membuka ID <strong>{safeText(activeId)}</strong>. Ini hanya baca data, tidak mengubah transaksi.
          </p>
        </Card>
      ) : (
        <div style={styles.stack}>
          <section style={styles.hero}>
            <div>
              <div className="da-mini-title">Transaksi Utama</div>
              <div style={styles.heroTitle}>{safeText(main.title || main.description || displayId)}</div>
              <p className="da-muted" style={{ margin: "8px 0 0" }}>
                {displayId} · {formatDate(main.date || main.created_at)}
              </p>
            </div>

            <div style={styles.heroRight}>
              <Badge tone={getToneByStatus(main.status)}>{safeText(main.status, "Tercatat")}</Badge>
              <div style={styles.heroAmount}>{formatRupiah(main.amount || 0) || "Rp 0"}</div>
              <button type="button" className="da-button da-button-ghost" style={styles.copyBtn} onClick={() => copyText(displayId)}>
                Copy ID
              </button>
            </div>
          </section>

          <div style={styles.alertBox}>
            Detail ini bersifat read-only. Perbaikan tetap dilakukan dari modul sumber, sementara Arsip Digital menjadi tempat menelusuri rantai ID: order, invoice, payment, stok, hutang, dompet, payroll, closing, sampai 4 Amplop bila ada sumbernya.
          </div>

          {printError ? <div className="da-form-error">{printError}</div> : null}

          <div className="da-form-actions" style={styles.actions}>
            <Button type="button" variant="secondary" onClick={onRefresh}>Refresh Detail</Button>
            <Button type="button" onClick={handleOperationalPrint} disabled={printing || !displayId}>
              {printing ? "Mencatat Cetak..." : "Cetak Dokumen"}
            </Button>
            <Button type="button" variant="secondary" onClick={onOpenArchive}>Buka di Arsip Digital</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Tutup</Button>
          </div>

          <div style={styles.tabRow}>
            {[
              ["summary", "Ringkasan"],
              ["chain", `Rantai (${timeline.length})`],
              ["ids", `ID Terkait (${relationIds.length})`],
              ["raw", "Data Mentah"],
              ["audit", `Jejak Edit (${audit.length})`],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                style={{ ...styles.tabButton, ...(tab === key ? styles.tabButtonActive : {}) }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "summary" ? (
            <Card>
              <div className="da-mini-title">Ringkasan Cepat</div>
              <div style={styles.summaryGrid}>
                {summaryRows.map((row) => (
                  <div key={row.label} style={styles.summaryItem}>
                    <span style={styles.label}>{row.label}</span>
                    <strong style={styles.value}>{row.value}</strong>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {tab === "chain" ? (
            <Card>
              <div className="da-mini-title">Rantai Transaksi / Benang Merah</div>
              <div style={{ marginTop: 12 }}>
                <DataTable
                  columns={[
                    { key: "date", label: "Tanggal", render: (row) => formatDate(row.date || row.created_at) },
                    { key: "source_module", label: "Modul", render: (row) => moduleLabel(row.source_label || row.source_module) },
                    { key: "source_id", label: "ID", render: (row) => <strong>{safeText(row.source_id || row.id)}</strong> },
                    { key: "title", label: "Keterangan", render: (row) => safeText(row.title || row.description) },
                    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
                    { key: "status", label: "Status", render: (row) => <Badge tone={getToneByStatus(row.status)}>{safeText(row.status, "Tercatat")}</Badge> },
                  ]}
                  rows={timeline}
                  getRowKey={(row, index) => `${row.source_module || "MOD"}-${row.source_id || row.id || index}-${index}`}
                  onRowClick={(row) => onOpenId?.(row.source_id || row.id || row.transaction_id, row.source_module)}
                />
              </div>
            </Card>
          ) : null}

          {tab === "ids" ? (
            <Card>
              <div className="da-mini-title">ID yang Terhubung</div>
              <div style={styles.idWrap}>
                {relationIds.length ? (
                  relationIds.slice(0, 80).map((id) => (
                    <button key={id} type="button" className="da-button da-button-ghost" style={styles.idPill} onClick={() => onOpenId?.(id, "")}>{id}</button>
                  ))
                ) : (
                  <span className="da-muted">Belum ada ID terkait.</span>
                )}
              </div>
            </Card>
          ) : null}

          {tab === "raw" ? (
            <Card>
              <div className="da-mini-title">Data Mentah dari Sumber</div>
              <div style={{ marginTop: 12 }}>
                <RawFields fields={main.raw || main.record || main} />
              </div>
            </Card>
          ) : null}

          {tab === "audit" ? (
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
          ) : null}
        </div>
      )}
    </Modal>
  );
}

const styles = {
  stack: { display: "grid", gap: 14 },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 18,
    background: "#ffffff",
  },
  heroTitle: { marginTop: 8, fontSize: 24, fontWeight: 900, lineHeight: 1.15, color: "#111827" },
  heroRight: { textAlign: "right", minWidth: 160 },
  heroAmount: { marginTop: 12, fontWeight: 900, fontSize: 18, color: "#111827" },
  copyBtn: { marginTop: 10, padding: "7px 10px", fontSize: 12 },
  alertBox: {
    borderRadius: 16,
    padding: "12px 14px",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    fontWeight: 700,
    lineHeight: 1.5,
  },
  actions: { justifyContent: "flex-start", marginTop: 0 },
  tabRow: { display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid #e5e7eb", paddingBottom: 8 },
  tabButton: {
    border: "none",
    background: "transparent",
    color: "#64748b",
    fontWeight: 850,
    padding: "9px 10px",
    borderRadius: 12,
    cursor: "pointer",
  },
  tabButtonActive: { background: "#fee2e2", color: "#b42318" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 12 },
  summaryItem: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f9fafb" },
  label: { display: "block", color: "#64748b", fontSize: 12, fontWeight: 800, marginBottom: 6 },
  value: { display: "block", color: "#111827", overflowWrap: "anywhere" },
  idWrap: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 },
  idPill: { padding: "7px 10px", fontSize: 12 },
  rawGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  rawItem: { padding: 12, boxShadow: "none" },
  rawValue: { marginTop: 6, fontWeight: 750, overflowWrap: "anywhere" },
};
