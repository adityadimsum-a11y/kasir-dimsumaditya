import { useEffect, useMemo, useState } from "react";
import { getOwnerControlBootstrap } from "../../lib/api/actions";
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

function numberValue(value) {
  const clean = String(value ?? "0").replace(/[^0-9.-]/g, "");
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, suffix = "") {
  return `${Number(value || 0).toLocaleString("id-ID")}${suffix ? ` ${suffix}` : ""}`;
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getToneByStatus(status) {
  const text = String(status || "").toUpperCase();
  if (text.includes("AMAN") || text.includes("SEHAT") || text.includes("LUNAS") || text.includes("READY")) return "success";
  if (text.includes("PERLU") || text.includes("BELUM") || text.includes("WARNING") || text.includes("KURANG")) return "warning";
  if (text.includes("BAHAYA") || text.includes("ERROR") || text.includes("MINUS")) return "danger";
  return "default";
}

function ChainStep({ index, title, value, description, status }) {
  return (
    <div className="da-flow-card">
      <div className="da-flow-number">{index}</div>
      <div>
        <div className="da-flow-title">{title}</div>
        <div className="da-flow-desc">{description}</div>
        <div className="da-flow-status">
          <strong>{value}</strong> · {status || "Tercatat"}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ item, onClick }) {
  return (
    <button type="button" className="da-action-card" onClick={() => onClick(item)}>
      <div className="da-action-card-top">
        <Badge tone={getToneByStatus(item.status)}>{item.status || "Pantau"}</Badge>
        <span className="da-action-arrow">›</span>
      </div>
      <div className="da-action-value">{item.title}</div>
      <div className="da-action-desc">{item.description}</div>
      <div className="da-action-desc" style={{ marginTop: 8, fontWeight: 850 }}>
        {item.amount_label || "-"}
      </div>
    </button>
  );
}

function normalizeSummary(data) {
  return data?.summary || {};
}

function buildChain(summary) {
  return [
    {
      title: "DROP Ayam",
      value: formatRupiah(summary?.chicken?.total_drop_amount || 0),
      description: `${formatNumber(summary?.chicken?.total_drop_kg || 0, "kg")} ayam masuk dari nota aktual.`,
      status: `${formatNumber(summary?.chicken?.drops_count || 0)} nota`,
    },
    {
      title: "Lot Ayam Aktif",
      value: formatNumber(summary?.chicken?.remaining_kg || 0, "kg"),
      description: "Sisa ayam harus turun saat produksi/adukan diposting.",
      status: `${formatNumber(summary?.chicken?.active_lots_count || 0)} lot`,
    },
    {
      title: "Produksi / Adukan",
      value: formatNumber(summary?.production?.output_pcs || 0, "pcs"),
      description: `${formatNumber(summary?.production?.total_adukan || 0)} adukan diproses dari lot ayam.`,
      status: `${formatNumber(summary?.production?.batches_count || 0)} batch`,
    },
    {
      title: "Stok Jadi",
      value: formatNumber(summary?.stock?.ready_pcs || 0, "pcs"),
      description: "Barang siap jual dari gerak stok masuk-keluar.",
      status: formatRupiah(summary?.stock?.stock_value || 0),
    },
    {
      title: "Kasir / Order",
      value: formatRupiah(summary?.sales?.invoice_total || 0),
      description: "Invoice dan order dari stok ready.",
      status: `${formatNumber(summary?.sales?.orders_count || 0)} order`,
    },
    {
      title: "Uang Masuk",
      value: formatRupiah(summary?.wallet?.money_in || 0),
      description: "Uang aktual yang sudah masuk dompet/bank.",
      status: `${formatNumber(summary?.wallet?.mutation_count || 0)} mutasi`,
    },
    {
      title: "Hutang Nana",
      value: formatRupiah(summary?.obligations?.hutang_remaining || 0),
      description: "Sisa hutang ayam setelah pembayaran supplier.",
      status: summary?.obligations?.hutang_remaining > 0 ? "Belum Lunas" : "Aman",
    },
    {
      title: "4 Amplop",
      value: formatRupiah(summary?.amplop?.allocated_total || 0),
      description: "Pembagian hanya dari uang masuk aktual.",
      status: `${formatRupiah(summary?.amplop?.unallocated || 0)} belum dibagi`,
    },
  ];
}

function recentColumns() {
  return [
    { key: "date", label: "Tanggal", render: (row) => formatDate(row.date) },
    { key: "module", label: "Modul" },
    { key: "id", label: "ID" },
    { key: "description", label: "Keterangan" },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
    { key: "status", label: "Status", render: (row) => <Badge tone={getToneByStatus(row.status)}>{row.status || "Tercatat"}</Badge> },
  ];
}

export default function OwnerControlPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);

  const summary = useMemo(() => normalizeSummary(data), [data]);
  const chain = useMemo(() => buildChain(summary), [summary]);
  const actions = useMemo(() => asArray(data?.action_queue), [data]);
  const recent = useMemo(() => asArray(data?.recent_transactions), [data]);
  const health = data?.health || {};

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getOwnerControlBootstrap(session?.sessionToken, {
      source: "frontend_part_4g_owner_control",
      limit: 20,
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal membaca Owner Control.");
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

  const selectedSupportRows = asArray(selectedAction?.support_rows);

  return (
    <div className="da-page">
      <PageHeader
        title="Owner Control"
        description="Pusat kendali benang merah: ayam, produksi, stok, order, uang masuk, hutang Nana, dan 4 Amplop. Read-only dulu supaya owner bisa pantau semua kabel utama."
        badge="Live Monitor"
      />

      <Card className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">BENANG MERAH USAHA</div>
          <h2>DROP Ayam → Produksi → Stok → Order → Uang → Hutang Nana → 4 Amplop</h2>
          <p className="da-dashboard-banner-desc">
            Halaman ini tidak membuat transaksi baru. Fungsinya membaca semua sumber hidup dan menampilkan apakah rantai usaha sudah nyambung.
          </p>
        </div>
        <div className="da-dashboard-banner-actions">
          <Badge tone={error ? "danger" : "success"}>{loading ? "Membaca..." : error ? "Perlu Dicek" : "Terhubung"}</Badge>
          <Button variant="ghost" onClick={loadData}>Refresh Data</Button>
        </div>
      </Card>

      {error ? (
        <Card>
          <Badge tone="danger">Error</Badge>
          <p className="da-muted" style={{ marginTop: 12 }}>{error}</p>
        </Card>
      ) : null}

      <div className="da-grid da-grid-3" style={{ marginTop: 16 }}>
        <StatCard
          tone="primary"
          label="Uang Masuk Aktual"
          value={formatRupiah(summary?.wallet?.money_in || 0)}
          description="Dari mutasi dompet/bank IN. Ini bahan 4 Amplop."
        />
        <StatCard
          tone="warning"
          label="Sisa Hutang Nana"
          value={formatRupiah(summary?.obligations?.hutang_remaining || 0)}
          description="Sisa nota ayam yang belum dibayar."
        />
        <StatCard
          label="Stok Ready"
          value={formatNumber(summary?.stock?.ready_pcs || 0, "pcs")}
          description="Stok jadi bebas berdasarkan gerak stok."
        />
        <StatCard
          label="Sisa Ayam"
          value={formatNumber(summary?.chicken?.remaining_kg || 0, "kg")}
          description="Sisa kg dari lot ayam aktif."
        />
        <StatCard
          label="Belum Dibagi 4 Amplop"
          value={formatRupiah(summary?.amplop?.unallocated || 0)}
          description="Uang masuk aktual yang belum masuk catatan 4 Amplop."
        />
        <StatCard
          tone={health?.status === "Perlu Dicek" ? "warning" : "default"}
          label="Kesehatan Kabel"
          value={health?.status || "-"}
          description={health?.message || "Membaca koneksi antar modul."}
        />
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="da-section-heading">
          <div>
            <div className="da-page-kicker">PETA RANTAI USAHA</div>
            <h2 style={{ margin: 0 }}>Alur Nilai yang Harus Bisa Ditelusuri</h2>
            <p className="da-muted" style={{ margin: "6px 0 0" }}>
              Setiap angka di bawah harus punya sumber ID di modul terkait.
            </p>
          </div>
          <Badge tone="warning">Read Only</Badge>
        </div>

        <div className="da-flow-grid">
          {chain.map((item, index) => (
            <ChainStep key={item.title} index={index + 1} {...item} />
          ))}
        </div>
      </Card>

      <div className="da-dashboard-split" style={{ marginTop: 16 }}>
        <Card>
          <div className="da-section-heading">
            <div>
              <div className="da-page-kicker">ACTION CENTER OWNER</div>
              <h2 style={{ margin: 0 }}>Yang Perlu Dipantau</h2>
              <p className="da-muted" style={{ margin: "6px 0 0" }}>
                Klik kartu untuk melihat data pendukungnya.
              </p>
            </div>
            <Badge tone="success">Live Data</Badge>
          </div>

          <div className="da-action-grid">
            {(actions.length ? actions : [
              {
                title: "Belum ada alarm besar",
                description: "Data action center masih kosong dari backend.",
                amount_label: "-",
                status: "Aman",
                support_rows: [],
              },
            ]).map((item, index) => (
              <ActionCard key={`${item.title}-${index}`} item={item} onClick={setSelectedAction} />
            ))}
          </div>
        </Card>

        <Card>
          <div className="da-page-kicker">RINGKASAN CEPAT</div>
          <h2 style={{ margin: "4px 0 12px" }}>Saldo & Pergerakan</h2>
          <div className="da-detail-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="da-detail-box">
              <p>Saldo Dompet</p>
              <strong>{formatRupiah(summary?.wallet?.wallet_balance_total || 0)}</strong>
            </div>
            <div className="da-detail-box">
              <p>Uang Keluar</p>
              <strong>{formatRupiah(summary?.wallet?.money_out || 0)}</strong>
            </div>
            <div className="da-detail-box">
              <p>Piutang Terbuka</p>
              <strong>{formatRupiah(summary?.sales?.receivable_open || 0)}</strong>
            </div>
            <div className="da-detail-box">
              <p>Total Belanja/Kas Keluar</p>
              <strong>{formatRupiah(summary?.obligations?.cash_expense_total || 0)}</strong>
            </div>
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="da-section-heading">
          <div>
            <div className="da-page-kicker">TRANSAKSI TERBARU</div>
            <h2 style={{ margin: 0 }}>Jejak ID Terakhir</h2>
            <p className="da-muted" style={{ margin: "6px 0 0" }}>
              Ini ringkasan saja. Arsip detail universal nanti jadi pintu untuk membuka seluruh rantai ID.
            </p>
          </div>
          <Badge tone="success">Archive Hook</Badge>
        </div>
        <DataTable columns={recentColumns()} rows={recent} getRowKey={(row, index) => `${row.module}-${row.id}-${index}`} />
      </Card>

      <Modal
        open={Boolean(selectedAction)}
        title={selectedAction?.title || "Detail Action"}
        subtitle={selectedAction?.description || "Data pendukung dari backend."}
        onClose={() => setSelectedAction(null)}
      >
        <div className="da-detail-grid">
          <div className="da-detail-box">
            <p>Status</p>
            <strong>{selectedAction?.status || "-"}</strong>
          </div>
          <div className="da-detail-box">
            <p>Nominal</p>
            <strong>{selectedAction?.amount_label || "-"}</strong>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <DataTable
            columns={[
              { key: "date", label: "Tanggal", render: (row) => formatDate(row.date) },
              { key: "id", label: "ID" },
              { key: "name", label: "Nama/Sumber" },
              { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
              { key: "status", label: "Status" },
            ]}
            rows={selectedSupportRows}
            getRowKey={(row, index) => `${row.id}-${index}`}
          />
        </div>
      </Modal>
    </div>
  );
}
