import { useEffect, useMemo, useState } from "react";
import { getMoneyInBootstrap } from "../../lib/api/actions";
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

function getStatusTone(status) {
  const value = String(status || "").toUpperCase();
  if (value.includes("LUNAS") || value.includes("PAID") || value.includes("POSTED") || value.includes("SETTLED")) return "success";
  if (value.includes("VOID") || value.includes("BATAL") || value.includes("CANCEL")) return "danger";
  if (value.includes("BELUM") || value.includes("PIUTANG") || value.includes("OPEN") || value.includes("PARTIAL")) return "warning";
  return "warning";
}

function normalizePayment(row) {
  return {
    ...row,
    payment_id: row.payment_id || row.pay_id || row.id || row.transaction_id || "",
    payment_date: row.payment_date || row.date || row.created_at || row.paid_at || "",
    source_id: row.invoice_id || row.order_id || row.source_id || row.ref_id || "",
    order_id: row.order_id || "",
    invoice_id: row.invoice_id || "",
    customer_name: row.customer_name || row.name || row.customer || "UMUM",
    method: row.payment_method || row.method || row.wallet_name || row.wallet_code || "-",
    wallet_name: row.wallet_name || row.wallet_code || row.wallet_id || row.method || "-",
    amount: numberValue(row.amount || row.payment_amount || row.paid_amount || row.nominal || 0),
    status: row.status || row.payment_status || "Tercatat",
  };
}

function normalizeReceivable(row) {
  return {
    ...row,
    receivable_id: row.receivable_id || row.piutang_id || row.id || "",
    receivable_date: row.receivable_date || row.invoice_date || row.order_date || row.date || row.created_at || "",
    invoice_id: row.invoice_id || row.source_invoice_id || "",
    order_id: row.order_id || row.source_order_id || "",
    customer_name: row.customer_name || row.name || row.customer || "UMUM",
    original_amount: numberValue(row.original_amount || row.amount || row.total_amount || row.invoice_amount || 0),
    paid_amount: numberValue(row.paid_amount || row.amount_paid || row.total_paid || 0),
    remaining_amount: numberValue(row.remaining_amount || row.outstanding_amount || row.sisa_tagihan || row.balance || 0),
    due_date: row.due_date || row.jatuh_tempo || "",
    status: row.status || row.receivable_status || row.payment_status || "Open",
  };
}

function normalizeWalletMutation(row) {
  return {
    ...row,
    mutation_id: row.mutation_id || row.wallet_mutation_id || row.id || "",
    date: row.mutation_date || row.date || row.created_at || "",
    wallet_name: row.wallet_name || row.wallet_code || row.wallet_id || "Dompet",
    source_id: row.source_id || row.ref_id || row.payment_id || row.order_id || "",
    direction: row.direction || row.mutation_type || "IN",
    amount: numberValue(row.amount || row.nominal || row.debit || row.credit || 0),
    status: row.status || "Tercatat",
  };
}

function buildSummary(data) {
  const summary = data?.summary || {};
  return {
    uang_masuk_actual: numberValue(summary.uang_masuk_actual),
    payment_count: numberValue(summary.payment_count),
    piutang_open: numberValue(summary.piutang_open),
    receivable_count: numberValue(summary.receivable_count),
    wallet_in_count: numberValue(summary.wallet_in_count),
    today_uang_masuk: numberValue(summary.today_uang_masuk),
  };
}

export default function UangMasukPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("payments");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedReceivable, setSelectedReceivable] = useState(null);

  const summary = useMemo(() => buildSummary(bootstrap), [bootstrap]);

  const payments = useMemo(() => {
    return asArray(bootstrap?.payments).map(normalizePayment);
  }, [bootstrap]);

  const receivables = useMemo(() => {
    return asArray(bootstrap?.receivables).map(normalizeReceivable);
  }, [bootstrap]);

  const walletMutations = useMemo(() => {
    return asArray(bootstrap?.wallet_mutations).map(normalizeWalletMutation);
  }, [bootstrap]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getMoneyInBootstrap(session?.sessionToken, {
      source: "frontend_part_4b_uang_masuk_piutang_monitor",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal membaca data Uang Masuk.");
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

  const paymentColumns = [
    {
      key: "payment_date",
      label: "Tanggal",
      render: (row) => formatDisplayDate(row.payment_date),
    },
    {
      key: "payment_id",
      label: "Payment ID",
      render: (row) => <strong>{safeText(row.payment_id)}</strong>,
    },
    {
      key: "customer_name",
      label: "Customer",
      render: (row) => safeText(row.customer_name),
    },
    {
      key: "amount",
      label: "Uang Masuk",
      render: (row) => formatRupiah(row.amount),
    },
    {
      key: "wallet_name",
      label: "Dompet",
      render: (row) => safeText(row.wallet_name || row.method),
    },
    {
      key: "source_id",
      label: "Sumber",
      render: (row) => safeText(row.source_id),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <Badge tone={getStatusTone(row.status)}>{safeText(row.status)}</Badge>,
    },
  ];

  const receivableColumns = [
    {
      key: "receivable_date",
      label: "Tanggal",
      render: (row) => formatDisplayDate(row.receivable_date),
    },
    {
      key: "receivable_id",
      label: "Piutang ID",
      render: (row) => <strong>{safeText(row.receivable_id)}</strong>,
    },
    {
      key: "customer_name",
      label: "Customer",
      render: (row) => safeText(row.customer_name),
    },
    {
      key: "original_amount",
      label: "Tagihan",
      render: (row) => formatRupiah(row.original_amount),
    },
    {
      key: "paid_amount",
      label: "Sudah Dibayar",
      render: (row) => formatRupiah(row.paid_amount),
    },
    {
      key: "remaining_amount",
      label: "Sisa",
      render: (row) => formatRupiah(row.remaining_amount),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <Badge tone={getStatusTone(row.status)}>{safeText(row.status)}</Badge>,
    },
  ];

  const walletColumns = [
    {
      key: "date",
      label: "Tanggal",
      render: (row) => formatDisplayDate(row.date),
    },
    {
      key: "mutation_id",
      label: "Mutasi ID",
      render: (row) => <strong>{safeText(row.mutation_id)}</strong>,
    },
    {
      key: "wallet_name",
      label: "Dompet",
      render: (row) => safeText(row.wallet_name),
    },
    {
      key: "amount",
      label: "Nominal",
      render: (row) => formatRupiah(row.amount),
    },
    {
      key: "source_id",
      label: "Sumber",
      render: (row) => safeText(row.source_id),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <Badge tone={getStatusTone(row.status)}>{safeText(row.status)}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Uang Masuk"
        description="Pantau pembayaran aktual dari customer. Piutang tetap terpisah sampai benar-benar dibayar."
        badge="Read Only"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Uang aktual</div>
          <div className="da-dashboard-banner-title">Order → Payment → Dompet</div>
          <div className="da-dashboard-banner-desc">
            Halaman ini membaca uang yang benar-benar masuk. 4 Amplop nanti hanya boleh mengambil dari uang masuk aktual, bukan PO, piutang, atau stok.
          </div>
        </div>

        <div className="da-dashboard-banner-actions">
          <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Dicek" : "Terhubung"}</Badge>
          <Button variant="ghost" onClick={loadData} disabled={loading}>
            {loading ? "Membaca..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="da-login-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      <div className="da-grid da-grid-3">
        <StatCard
          tone="primary"
          label="Uang Masuk Aktual"
          value={loading ? "..." : formatRupiah(summary.uang_masuk_actual)}
          description="Total pembayaran yang benar-benar masuk."
        />
        <StatCard
          label="Uang Masuk Hari Ini"
          value={loading ? "..." : formatRupiah(summary.today_uang_masuk)}
          description="Pembayaran aktual tanggal hari ini."
        />
        <StatCard
          tone="warning"
          label="Sisa Piutang"
          value={loading ? "..." : formatRupiah(summary.piutang_open)}
          description="Tagihan customer yang belum lunas."
        />
      </div>

      <div style={{ height: 16 }} />

      <div className="da-grid da-grid-3">
        <StatCard
          label="Jumlah Payment"
          value={loading ? "..." : summary.payment_count}
          description="Jumlah pembayaran yang terbaca."
        />
        <StatCard
          label="Piutang Aktif"
          value={loading ? "..." : summary.receivable_count}
          description="Jumlah catatan piutang aktif."
        />
        <StatCard
          label="Mutasi Dompet Masuk"
          value={loading ? "..." : summary.wallet_in_count}
          description="Mutasi dompet masuk yang terkait pembayaran."
        />
      </div>

      <div style={{ height: 18 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Pantau Uang</div>
            <div className="da-big-text">Pembayaran & Piutang</div>
            <p className="da-muted">
              Tab ini read-only dulu. Input pembayaran piutang susulan nanti dipasang setelah pola uang masuk dan dompet terbaca rapi.
            </p>
          </div>
          <Badge tone="warning">Live Data</Badge>
        </div>

        <div className="da-tabs">
          <button
            type="button"
            className={activeTab === "payments" ? "da-tab active" : "da-tab"}
            onClick={() => setActiveTab("payments")}
          >
            Uang Masuk
          </button>
          <button
            type="button"
            className={activeTab === "receivables" ? "da-tab active" : "da-tab"}
            onClick={() => setActiveTab("receivables")}
          >
            Piutang
          </button>
          <button
            type="button"
            className={activeTab === "wallets" ? "da-tab active" : "da-tab"}
            onClick={() => setActiveTab("wallets")}
          >
            Mutasi Dompet
          </button>
        </div>

        {activeTab === "payments" ? (
          <DataTable
            columns={paymentColumns}
            rows={loading ? [] : payments}
            getRowKey={(row, index) => row.payment_id || index}
            onRowClick={setSelectedPayment}
          />
        ) : null}

        {activeTab === "receivables" ? (
          <DataTable
            columns={receivableColumns}
            rows={loading ? [] : receivables}
            getRowKey={(row, index) => row.receivable_id || index}
            onRowClick={setSelectedReceivable}
          />
        ) : null}

        {activeTab === "wallets" ? (
          <DataTable
            columns={walletColumns}
            rows={loading ? [] : walletMutations}
            getRowKey={(row, index) => row.mutation_id || index}
          />
        ) : null}
      </Card>

      <Modal
        open={Boolean(selectedPayment)}
        title="Detail Uang Masuk"
        subtitle={selectedPayment?.payment_id || ""}
        onClose={() => setSelectedPayment(null)}
      >
        {selectedPayment ? (
          <div>
            <div className="da-modal-summary">
              <div>
                <div className="da-mini-title">Uang Masuk Aktual</div>
                <div className="da-big-text">{formatRupiah(selectedPayment.amount)}</div>
                <p className="da-muted">Customer: <strong>{safeText(selectedPayment.customer_name)}</strong></p>
              </div>
              <Badge tone={getStatusTone(selectedPayment.status)}>{safeText(selectedPayment.status)}</Badge>
            </div>

            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-mini-title">Pembayaran</div>
                <p><strong>ID:</strong> {safeText(selectedPayment.payment_id)}</p>
                <p><strong>Tanggal:</strong> {formatDisplayDate(selectedPayment.payment_date)}</p>
                <p><strong>Metode:</strong> {safeText(selectedPayment.method)}</p>
                <p><strong>Dompet:</strong> {safeText(selectedPayment.wallet_name)}</p>
              </div>
              <div className="da-detail-box">
                <div className="da-mini-title">Rantai Transaksi</div>
                <p><strong>Order:</strong> {safeText(selectedPayment.order_id)}</p>
                <p><strong>Invoice:</strong> {safeText(selectedPayment.invoice_id)}</p>
                <p><strong>Sumber:</strong> {safeText(selectedPayment.source_id)}</p>
                <p><strong>Catatan:</strong> Uang ini bisa menjadi sumber 4 Amplop.</p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(selectedReceivable)}
        title="Detail Piutang"
        subtitle={selectedReceivable?.receivable_id || ""}
        onClose={() => setSelectedReceivable(null)}
      >
        {selectedReceivable ? (
          <div>
            <div className="da-modal-summary">
              <div>
                <div className="da-mini-title">Sisa Tagihan</div>
                <div className="da-big-text">{formatRupiah(selectedReceivable.remaining_amount)}</div>
                <p className="da-muted">Customer: <strong>{safeText(selectedReceivable.customer_name)}</strong></p>
              </div>
              <Badge tone={getStatusTone(selectedReceivable.status)}>{safeText(selectedReceivable.status)}</Badge>
            </div>

            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-mini-title">Piutang</div>
                <p><strong>ID:</strong> {safeText(selectedReceivable.receivable_id)}</p>
                <p><strong>Tanggal:</strong> {formatDisplayDate(selectedReceivable.receivable_date)}</p>
                <p><strong>Tagihan awal:</strong> {formatRupiah(selectedReceivable.original_amount)}</p>
                <p><strong>Sudah dibayar:</strong> {formatRupiah(selectedReceivable.paid_amount)}</p>
              </div>
              <div className="da-detail-box">
                <div className="da-mini-title">Rantai Transaksi</div>
                <p><strong>Order:</strong> {safeText(selectedReceivable.order_id)}</p>
                <p><strong>Invoice:</strong> {safeText(selectedReceivable.invoice_id)}</p>
                <p><strong>Jatuh tempo:</strong> {formatDisplayDate(selectedReceivable.due_date)}</p>
                <p><strong>Catatan:</strong> Belum masuk 4 Amplop sampai dibayar.</p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
