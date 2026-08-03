import { useEffect, useMemo, useState } from "react";
import {
  getFinanceLockBootstrap,
  getFinanceTraceDetail,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function isAuthRequired(result) {
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  const message = String(result?.message || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || code.includes("SESSION") || (message.includes("SESSION") && message.includes("AKTIF"));
}

function toneForDirection(direction) {
  return String(direction || "").toUpperCase() === "IN" ? "success" : "warning";
}

export default function FinanceLockPanel({ session, onSessionExpired, compact = false }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({});
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const summary = data.summary || {};
  const checks = data.checks || {};
  const traceRows = useMemo(() => asArray(data.trace_rows), [data.trace_rows]);

  async function loadData() {
    setLoading(true);
    setError("");
    const result = await getFinanceLockBootstrap(session?.sessionToken, {
      limit: compact ? 30 : 100,
      source: "package_4_finance_lock_panel",
    });
    if (!result?.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setError(result?.message || "Finance Lock belum dapat dibaca.");
      setData({});
      setLoading(false);
      return;
    }
    setData(result.data || {});
    setLoading(false);
  }

  useEffect(() => {
    if (session?.sessionToken) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionToken]);

  async function openTrace(row) {
    const transactionId = row.source_id || row.mutation_id;
    if (!transactionId) return;
    setDetailLoading(true);
    setDetail({ transaction_id: transactionId });
    const result = await getFinanceTraceDetail(session?.sessionToken, {
      transaction_id: transactionId,
      source: "package_4_finance_trace_detail",
    });
    if (!result?.success) {
      setDetail({ transaction_id: transactionId, error: result?.message || "Detail belum tersedia." });
      setDetailLoading(false);
      return;
    }
    setDetail({ transaction_id: transactionId, ...(result.data || {}) });
    setDetailLoading(false);
  }

  const checkRows = Object.entries(checks).map(([code, value]) => ({
    code,
    count: Number(value || 0),
    status: Number(value || 0) === 0 ? "AMAN" : "PERLU CEK",
  }));

  const traceColumns = [
    { key: "mutation_date", label: "Tanggal", render: (row) => formatDate(row.mutation_date || row.created_at) },
    { key: "mutation_id", label: "Mutasi ID", render: (row) => <strong>{safeText(row.mutation_id)}</strong> },
    { key: "wallet_name", label: "Dompet", render: (row) => safeText(row.wallet_name || row.wallet_code) },
    { key: "direction", label: "Arah", render: (row) => <Badge tone={toneForDirection(row.direction)}>{safeText(row.direction)}</Badge> },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
    { key: "source_module", label: "Sumber", render: (row) => `${safeText(row.source_module)} · ${safeText(row.source_id)}` },
    { key: "trace", label: "Jejak", render: (row) => <Button variant="ghost" onClick={(event) => { event.stopPropagation(); openTrace(row); }}>Detail</Button> },
  ];

  const main = detail?.archive || detail?.main || {};
  const related = useMemo(() => {
    const outgoing = asArray(detail?.links?.outgoing).map((row) => ({
      ...row,
      date: row.linked_transaction_date || row.created_at,
      source_module: row.linked_module,
      source_id: row.to_transaction_id,
      title: row.linked_title || row.relationship_type,
      amount: row.linked_amount,
    }));
    const incoming = asArray(detail?.links?.incoming).map((row) => ({
      ...row,
      date: row.linked_transaction_date || row.created_at,
      source_module: row.linked_module,
      source_id: row.from_transaction_id,
      title: row.linked_title || row.relationship_type,
      amount: row.linked_amount,
    }));
    return [...incoming, ...outgoing];
  }, [detail]);
  const audit = asArray(detail?.timeline || detail?.audit_trail);

  return (
    <>
      <Card style={{ marginTop: 18 }}>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">PACKAGE 4 · OWNER ONLY</div>
            <div className="da-big-text">Finance Lock & Full Trace</div>
            <p className="da-muted">Wallet adalah saldo fisik tunggal. Transfer antar-dompet tidak dihitung sebagai uang masuk baru. 4 Amplop hanya ledger alokasi.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Badge tone={summary.lock_ready ? "success" : "danger"}>{loading ? "Membaca..." : summary.lock_ready ? "FINANCE LOCK READY" : `${summary.blocker_total || 0} BLOCKER`}</Badge>
            <Button variant="ghost" onClick={loadData} disabled={loading}>{loading ? "Membaca..." : "Refresh Finance"}</Button>
          </div>
        </div>

        {error ? <div className="da-login-error" style={{ marginTop: 12 }}>{error}</div> : null}

        <div className="da-grid da-grid-3" style={{ marginTop: 16 }}>
          <StatCard tone="primary" label="Saldo Dompet Aktual" value={formatRupiah(summary.wallet_balance || 0)} description={`${summary.wallet_count || 0} dompet aktif.`} />
          <StatCard label="Uang Masuk Eksternal" value={formatRupiah(summary.actual_money_in || 0)} description="Transfer dompet dan setoran internal dikecualikan." />
          <StatCard tone="warning" label="Uang Keluar Aktual" value={formatRupiah(summary.actual_money_out || 0)} description="Belanja, hutang, kewajiban, payroll, dan sumber resmi." />
          <StatCard label="Perpindahan Internal" value={formatRupiah(summary.internal_transfer_total || 0)} description="Transfer dompet dan setoran cabang; netral bagi total usaha." />
          <StatCard tone="warning" label="Siap Dibagi 4 Amplop" value={formatRupiah(summary.unallocated_actual_income || 0)} description="Hanya Wallet IN yang sudah berada di pusat/Tangerang." />
          <StatCard tone={summary.blocker_total ? "danger" : "success"} label="Integritas Keuangan" value={summary.blocker_total || 0} description="Jumlah jejak yang putus atau tidak seimbang." />
        </div>

        {!compact ? (
          <>
            <div style={{ height: 18 }} />
            <div className="da-mini-title">Pemeriksaan Finance Lock</div>
            <DataTable
              columns={[
                { key: "code", label: "Pemeriksaan", render: (row) => safeText(row.code).replaceAll("_", " ") },
                { key: "count", label: "Jumlah" },
                { key: "status", label: "Status", render: (row) => <Badge tone={row.count === 0 ? "success" : "danger"}>{row.status}</Badge> },
              ]}
              rows={checkRows}
              getRowKey={(row) => row.code}
            />

            <div style={{ height: 18 }} />
            <div className="da-mini-title">Jejak Keuangan Terbaru</div>
            <DataTable columns={traceColumns} rows={traceRows} getRowKey={(row, index) => row.mutation_id || index} onRowClick={openTrace} />
          </>
        ) : null}
      </Card>

      <Modal open={Boolean(detail)} title="Jejak Transaksi Keuangan" subtitle={detail?.transaction_id || ""} onClose={() => setDetail(null)}>
        {detailLoading ? <p className="da-muted">Membaca Arsip dan Audit...</p> : detail?.error ? <div className="da-login-error">{detail.error}</div> : (
          <>
            <div className="da-modal-summary">
              <div>
                <div className="da-mini-title">Transaksi Utama</div>
                <div className="da-big-text">{safeText(main.title || main.transaction_type || main.module)}</div>
                <p className="da-muted">{safeText(main.transaction_id || main.source_key || detail?.transaction_id)}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <Badge tone="success">{safeText(main.status, "TERCATAT")}</Badge>
                <div style={{ marginTop: 10, fontWeight: 900 }}>{formatRupiah(main.amount || 0)}</div>
              </div>
            </div>
            <div className="da-mini-title">Rantai ID Terkait</div>
            <DataTable
              columns={[
                { key: "date", label: "Tanggal", render: (row) => formatDate(row.date || row.created_at) },
                { key: "source_module", label: "Modul", render: (row) => safeText(row.source_module || row.module) },
                { key: "source_id", label: "ID", render: (row) => <strong>{safeText(row.source_id || row.transaction_id)}</strong> },
                { key: "title", label: "Keterangan", render: (row) => safeText(row.title || row.description) },
                { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
              ]}
              rows={related}
              getRowKey={(row, index) => `${row.source_id || row.transaction_id || index}-${index}`}
            />
            <div style={{ height: 14 }} />
            <div className="da-mini-title">Audit</div>
            <DataTable
              columns={[
                { key: "timestamp", label: "Waktu", render: (row) => formatDate(row.timestamp || row.created_at) },
                { key: "action", label: "Aksi", render: (row) => safeText(row.action) },
                { key: "username", label: "User", render: (row) => safeText(row.username || row.user_id) },
                { key: "notes", label: "Catatan", render: (row) => safeText(row.notes || row.reason || row.message) },
              ]}
              rows={audit}
              getRowKey={(row, index) => row.audit_id || index}
            />
          </>
        )}
      </Modal>
    </>
  );
}
