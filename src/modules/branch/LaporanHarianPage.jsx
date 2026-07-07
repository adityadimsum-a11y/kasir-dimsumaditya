import { useEffect, useMemo, useState } from "react";
import { getDailyReportBootstrap } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";

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

function todayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function normalizeRow(row) {
  return {
    ...row,
    id: row.id || row.source_id || row.transaction_id || row.payment_id || row.invoice_id || row.order_id || row.mutation_id || "",
    date: row.date || row.transaction_date || row.created_at || "",
    module: row.module || row.source_module || "Transaksi",
    description: row.description || row.keterangan || row.notes || row.customer_name || row.supplier_name || "-",
    method: row.method || row.payment_method || row.wallet_name || row.dompet || "-",
    amount: numberValue(row.amount || row.nominal || row.total_amount || row.remaining_amount || 0),
    status: row.status || row.payment_status || row.transaction_status || "Tercatat",
  };
}

function normalizeCategory(row) {
  const rows = asArray(row.rows || row.items || row.transactions).map(normalizeRow);
  return {
    key: row.key || row.category_key || "category",
    title: row.title || row.label || row.name || "Kategori",
    description: row.description || "",
    amount: numberValue(row.amount || row.total || row.nominal || 0),
    count: numberValue(row.count || rows.length || 0),
    tone: row.tone || "default",
    rows,
  };
}

function normalizeBootstrap(payload) {
  const data = payload?.data || payload || {};
  const summary = data.summary || {};

  return {
    summary: {
      report_date: summary.report_date || data.report_date || "",
      location_code: summary.location_code || data.location_code || "",
      location_name: summary.location_name || data.location_name || "",
      total_cash_in: numberValue(summary.total_cash_in || 0),
      total_transfer_in: numberValue(summary.total_transfer_in || 0),
      total_cash_out: numberValue(summary.total_cash_out || 0),
      total_transfer_out: numberValue(summary.total_transfer_out || 0),
      total_income: numberValue(summary.total_income || 0),
      total_expense: numberValue(summary.total_expense || 0),
      total_receivable: numberValue(summary.total_receivable || 0),
      total_payable: numberValue(summary.total_payable || 0),
      estimated_cash_to_deposit: numberValue(summary.estimated_cash_to_deposit || 0),
      transaction_count: numberValue(summary.transaction_count || 0),
      category_count: numberValue(summary.category_count || 0),
      warnings_count: numberValue(summary.warnings_count || 0),
    },
    categories: asArray(data.categories || data.category_summaries).map(normalizeCategory),
    recent_transactions: asArray(data.recent_transactions || data.transactions).map(normalizeRow),
    warnings: asArray(data.warnings),
  };
}

function badgeTone(status) {
  const text = String(status || "").toLowerCase();
  if (text.includes("lunas") || text.includes("posted") || text.includes("tercatat")) return "success";
  if (text.includes("belum") || text.includes("open") || text.includes("pending")) return "warning";
  if (text.includes("batal") || text.includes("void")) return "danger";
  return "default";
}

function categoryTone(category) {
  const key = String(category.key || "").toLowerCase();
  if (key.includes("masuk") || key.includes("income")) return "success";
  if (key.includes("keluar") || key.includes("expense")) return "warning";
  if (key.includes("piutang") || key.includes("hutang")) return "warning";
  return "default";
}

const DETAIL_COLUMNS = [
  { key: "date", label: "Tanggal", render: (row) => formatDisplayDate(row.date) },
  { key: "module", label: "Modul" },
  { key: "id", label: "ID", render: (row) => <strong>{safeText(row.id)}</strong> },
  { key: "description", label: "Keterangan" },
  { key: "method", label: "Metode/Dompet" },
  { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
  { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{safeText(row.status, "Tercatat")}</Badge> },
];

export default function LaporanHarianPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({
    report_date: todayInputValue(),
    location_code: session?.user?.location_code || session?.user?.location_id || "TGR",
  });
  const [bootstrap, setBootstrap] = useState(() => normalizeBootstrap({}));
  const [activeCategory, setActiveCategory] = useState(null);

  const sessionToken = session?.sessionToken || "";

  const netCash = useMemo(() => {
    return bootstrap.summary.total_income - bootstrap.summary.total_expense;
  }, [bootstrap.summary.total_income, bootstrap.summary.total_expense]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getDailyReportBootstrap(sessionToken, filter);

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      if (!result?.success) {
        setError(result?.message || "Gagal menarik transaksi laporan harian.");
        return;
      }

      setBootstrap(normalizeBootstrap(result.data || result));
    } catch (err) {
      setError(err?.message || "Gagal membaca laporan harian.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryCards = bootstrap.categories;

  return (
    <div className="da-page-stack">
      <PageHeader
        title="Laporan Harian"
        description="Tarik transaksi hari ini dari order, uang masuk, kas keluar, piutang, hutang, produksi, dan stok. Admin tidak perlu input ulang detail transaksi."
        badge="Auto Pull"
      />

      <Card>
        <div className="da-card-header-row">
          <div>
            <div className="da-section-kicker">Laporan Cabang</div>
            <h2>Tarik Transaksi Hari Ini</h2>
            <p className="da-muted">
              Gerbang 1 menampilkan ringkasan. Klik kategori untuk membuka Gerbang 2 berisi baris transaksi sumber.
            </p>
          </div>
          <div className="da-card-actions">
            <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Dicek" : "Terhubung"}</Badge>
            <Button variant="ghost" onClick={loadData} disabled={loading}>
              {loading ? "Menarik..." : "Refresh Data"}
            </Button>
          </div>
        </div>

        <div className="da-detail-grid" style={{ marginTop: 16 }}>
          <label className="da-detail-box">
            <strong>Tanggal Laporan</strong>
            <input
              type="date"
              value={filter.report_date}
              onChange={(event) => setFilter((current) => ({ ...current, report_date: event.target.value }))}
              style={{
                width: "100%",
                marginTop: 10,
                border: "1px solid var(--da-color-border)",
                borderRadius: 12,
                padding: "10px 12px",
                fontWeight: 800,
              }}
            />
          </label>

          <label className="da-detail-box">
            <strong>Lokasi / Cabang</strong>
            <input
              type="text"
              value={filter.location_code}
              onChange={(event) => setFilter((current) => ({ ...current, location_code: event.target.value }))}
              placeholder="TGR / PML / CBN"
              style={{
                width: "100%",
                marginTop: 10,
                border: "1px solid var(--da-color-border)",
                borderRadius: 12,
                padding: "10px 12px",
                fontWeight: 800,
              }}
            />
            <p>{safeText(bootstrap.summary.location_name, "Lokasi mengikuti akun jika dikosongkan.")}</p>
          </label>
        </div>

        <div className="da-form-actions">
          <Button variant="primary" onClick={loadData} disabled={loading}>
            {loading ? "Menarik Transaksi..." : "Tarik Transaksi Hari Ini"}
          </Button>
        </div>

        {error ? <div className="da-form-warning">{error}</div> : null}
      </Card>

      <div className="da-grid da-grid-3">
        <StatCard
          label="Uang Masuk Aktual"
          value={formatRupiah(bootstrap.summary.total_income)}
          description="Cash + transfer masuk dari transaksi aktual."
          tone="success"
        />
        <StatCard
          label="Uang Keluar"
          value={formatRupiah(bootstrap.summary.total_expense)}
          description="Cash/transfer keluar dari belanja, hutang, dan mutasi OUT."
          tone="warning"
        />
        <StatCard
          label="Estimasi Setoran"
          value={formatRupiah(bootstrap.summary.estimated_cash_to_deposit || netCash)}
          description="Estimasi uang yang perlu dicek owner/Tangerang."
          tone="default"
        />
        <StatCard
          label="Piutang Terbuka"
          value={formatRupiah(bootstrap.summary.total_receivable)}
          description="Sisa tagihan customer yang belum lunas."
        />
        <StatCard
          label="Hutang Terbuka"
          value={formatRupiah(bootstrap.summary.total_payable)}
          description="Sisa kewajiban yang masih perlu dipantau."
          tone="warning"
        />
        <StatCard
          label="Transaksi Tertarik"
          value={bootstrap.summary.transaction_count}
          description="Jumlah baris sumber dari modul hidup."
        />
      </div>

      <Card>
        <div className="da-card-header-row">
          <div>
            <div className="da-section-kicker">Gerbang 1</div>
            <h2>Ringkasan Kategori Harian</h2>
            <p className="da-muted">Klik kartu untuk melihat transaksi pendukung per kategori.</p>
          </div>
          <Badge tone="warning">Read Only</Badge>
        </div>

        <div className="da-action-grid" style={{ marginTop: 16 }}>
          {categoryCards.length === 0 ? (
            <div className="da-muted">Belum ada transaksi untuk tanggal/lokasi ini.</div>
          ) : (
            categoryCards.map((category) => (
              <button
                type="button"
                key={category.key}
                className="da-action-card"
                onClick={() => setActiveCategory(category)}
              >
                <div className="da-action-card-top">
                  <Badge tone={categoryTone(category)}>{category.count} baris</Badge>
                  <span className="da-action-arrow">›</span>
                </div>
                <div className="da-action-value">{category.title}</div>
                <div className="da-action-desc">{category.description || formatRupiah(category.amount)}</div>
                <strong style={{ display: "block", marginTop: 8 }}>{formatRupiah(category.amount)}</strong>
              </button>
            ))
          )}
        </div>
      </Card>

      {bootstrap.warnings.length ? (
        <Card>
          <div className="da-section-kicker">Catatan Cek</div>
          <h2>Yang Perlu Diperhatikan</h2>
          <div className="da-grid" style={{ marginTop: 12 }}>
            {bootstrap.warnings.map((warning, index) => (
              <div className="da-form-warning" key={`${warning}-${index}`}>{warning}</div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="da-card-header-row">
          <div>
            <div className="da-section-kicker">Gerbang 2 Cepat</div>
            <h2>Transaksi Terbaru Hari Ini</h2>
            <p className="da-muted">Baris ini hanya ringkasan. Detail lengkap tetap lewat Arsip Digital/ID transaksi.</p>
          </div>
          <Badge tone="success">Live Data</Badge>
        </div>

        <DataTable
          columns={DETAIL_COLUMNS}
          rows={bootstrap.recent_transactions.slice(0, 30)}
          getRowKey={(row, index) => `${row.module}-${row.id}-${index}`}
        />
      </Card>

      <Modal
        open={Boolean(activeCategory)}
        title={activeCategory ? activeCategory.title : "Detail Kategori"}
        subtitle={activeCategory ? `${activeCategory.count} transaksi · ${formatRupiah(activeCategory.amount)}` : ""}
        onClose={() => setActiveCategory(null)}
      >
        <div className="da-detail-grid" style={{ marginBottom: 16 }}>
          <div className="da-detail-box">
            <strong>Total Kategori</strong>
            <p style={{ fontSize: 22, fontWeight: 900, color: "var(--da-color-heading)" }}>{formatRupiah(activeCategory?.amount || 0)}</p>
          </div>
          <div className="da-detail-box">
            <strong>Jumlah Baris</strong>
            <p style={{ fontSize: 22, fontWeight: 900, color: "var(--da-color-heading)" }}>{activeCategory?.count || 0}</p>
          </div>
        </div>

        <DataTable
          columns={DETAIL_COLUMNS}
          rows={activeCategory?.rows || []}
          getRowKey={(row, index) => `${row.module}-${row.id}-${index}`}
        />
      </Modal>
    </div>
  );
}
