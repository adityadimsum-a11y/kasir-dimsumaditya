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

function getToneByStatus(status) {
  const text = String(status || "").toUpperCase();
  if (text.includes("AMAN") || text.includes("SEHAT") || text.includes("LUNAS") || text.includes("READY")) return "success";
  if (text.includes("PERLU") || text.includes("BELUM") || text.includes("WARNING") || text.includes("KURANG")) return "warning";
  if (text.includes("BAHAYA") || text.includes("ERROR") || text.includes("MINUS")) return "danger";
  return "default";
}

function normalizeSummary(data) {
  return data?.summary || {};
}

function getRadar(summary) {
  const hutang = numberValue(summary?.obligations?.hutang_remaining);
  const ready = numberValue(summary?.stock?.ready_pcs);
  const sisaAyam = numberValue(summary?.chicken?.remaining_kg);
  const uangBelumDibagi = numberValue(summary?.amplop?.unallocated);
  const poKurang = numberValue(summary?.po?.shortage_qty);
  const requestPending = numberValue(summary?.branch?.request_pending_count);
  const setoranPending = numberValue(summary?.branch?.deposit_pending);

  const items = [
    {
      key: "hutang",
      title: "Sisa Hutang Nana",
      value: formatRupiah(hutang),
      status: hutang > 0 ? "Perlu Dipantau" : "Aman",
      description: "Pastikan jadwal bayar ayam tidak putus dari uang masuk aktual.",
    },
    {
      key: "stok",
      title: "Stok Ready",
      value: formatNumber(ready, "pcs"),
      status: ready > 0 ? "Ready" : "Kosong",
      description: "Stok jadi bebas untuk kasir/order. Bukan stok PO yang ditahan.",
    },
    {
      key: "ayam",
      title: "Sisa Ayam Mentah",
      value: formatNumber(sisaAyam, "kg"),
      status: sisaAyam > 0 ? "Masih Ada" : "Kosong",
      description: "Sisa ayam dari lot aktif yang belum dipakai adukan.",
    },
    {
      key: "amplop",
      title: "Belum Dibagi 4 Amplop",
      value: formatRupiah(uangBelumDibagi),
      status: uangBelumDibagi > 0 ? "Perlu Dibagi" : "Aman",
      description: "Hanya dari uang masuk aktual yang sudah punya sumber mutasi.",
    },
    {
      key: "po",
      title: "Kekurangan PO",
      value: formatNumber(poKurang, "pcs"),
      status: poKurang > 0 ? "Perlu Produksi" : "Aman",
      description: "PO customer yang belum cukup stoknya harus masuk radar produksi.",
    },
    {
      key: "request",
      title: "Request Cabang Pending",
      value: formatNumber(requestPending),
      status: requestPending > 0 ? "Perlu Approve" : "Aman",
      description: "Permintaan barang cabang dipisah dari PO customer.",
    },
    {
      key: "setoran",
      title: "Setoran Pending",
      value: formatRupiah(setoranPending),
      status: setoranPending > 0 ? "Perlu Approve" : "Aman",
      description: "Setoran belum menjadi uang pusat sebelum owner/Tangerang approve.",
    },
  ];

  return items;
}

function getBenangMerah(summary) {
  return [
    {
      title: "DROP Ayam",
      value: formatRupiah(summary?.chicken?.total_drop_amount || 0),
      description: `${formatNumber(summary?.chicken?.total_drop_kg || 0, "kg")} ayam masuk dari nota aktual.`,
      status: `${formatNumber(summary?.chicken?.drops_count || 0)} nota`,
    },
    {
      title: "Stok Ayam / Lot",
      value: formatNumber(summary?.chicken?.remaining_kg || 0, "kg"),
      description: `${formatNumber(summary?.chicken?.used_kg || 0, "kg")} sudah dipakai produksi.`,
      status: `${formatNumber(summary?.chicken?.active_lots_count || 0)} lot aktif`,
    },
    {
      title: "Produksi / Adukan",
      value: formatNumber(summary?.production?.output_pcs || 0, "pcs"),
      description: `${formatNumber(summary?.production?.total_adukan || 0)} adukan sudah diproses.`,
      status: `${formatNumber(summary?.production?.batches_count || 0)} batch`,
    },
    {
      title: "Stok Jadi Ready",
      value: formatNumber(summary?.stock?.ready_pcs || 0, "pcs"),
      description: "Barang siap jual dari gerak stok produk jadi.",
      status: formatRupiah(summary?.stock?.stock_value || 0),
    },
    {
      title: "PO Customer",
      value: formatNumber(summary?.po?.po_qty || 0, "pcs"),
      description: "PO menahan stok/kebutuhan. Belum jadi invoice dan bukan uang masuk.",
      status: `${formatNumber(summary?.po?.shortage_qty || 0, "pcs")} kurang`,
    },
    {
      title: "Kasir / Order",
      value: formatRupiah(summary?.sales?.invoice_total || 0),
      description: "Order dari stok ready, lalu invoice/payment/piutang.",
      status: `${formatNumber(summary?.sales?.orders_count || 0)} order`,
    },
    {
      title: "Uang Masuk",
      value: formatRupiah(summary?.wallet?.money_in || 0),
      description: "Uang aktual yang sudah masuk dompet/bank.",
      status: `${formatNumber(summary?.wallet?.mutation_count || 0)} mutasi`,
    },
    {
      title: "Setoran Cabang",
      value: formatRupiah(summary?.branch?.deposit_pending || 0),
      description: "Pending belum menjadi uang pusat sampai owner approve.",
      status: `${formatNumber(summary?.branch?.deposit_count || 0)} setoran`,
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
      description: "Pembagian hanya dari uang masuk aktual yang bersumber jelas.",
      status: `${formatRupiah(summary?.amplop?.unallocated || 0)} belum dibagi`,
    },
  ];
}

function FlowCard({ index, item }) {
  return (
    <div className="da-flow-card">
      <div className="da-flow-number">{index}</div>
      <div>
        <div className="da-flow-title">{item.title}</div>
        <div className="da-flow-desc">{item.description}</div>
        <div className="da-flow-status"><strong>{item.value}</strong> · {item.status}</div>
      </div>
    </div>
  );
}

function RadarCard({ item, onClick }) {
  return (
    <button type="button" className="da-action-card" onClick={() => onClick(item)}>
      <div className="da-action-card-top">
        <Badge tone={getToneByStatus(item.status)}>{item.status}</Badge>
        <span className="da-action-arrow">›</span>
      </div>
      <div className="da-action-value">{item.title}</div>
      <div className="da-action-desc">{item.description}</div>
      <div className="da-action-desc" style={{ marginTop: 8, fontWeight: 850 }}>{item.value}</div>
    </button>
  );
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

export default function PapanPusatPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedRadar, setSelectedRadar] = useState(null);

  const summary = useMemo(() => normalizeSummary(data), [data]);
  const radar = useMemo(() => getRadar(summary), [summary]);
  const chain = useMemo(() => getBenangMerah(summary), [summary]);
  const recent = useMemo(() => asArray(data?.recent_transactions).slice(0, 8), [data]);
  const health = data?.health || {};
  const counts = data?.counts || {};

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getOwnerControlBootstrap(session?.sessionToken, {
      source: "frontend_part_4w_papan_pantau_refresh_clean",
      limit: 12,
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal membaca Papan Pantau.");
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

  return (
    <div className="da-page">
      <PageHeader
        title="Papan Pantau"
        description="Ringkasan cepat owner untuk melihat uang, stok, produksi, PO, hutang, setoran, dan 4 Amplop dalam satu halaman ringan. Read-only, tidak membuat transaksi."
        badge="Live Dashboard"
      />

      <Card className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">PUSAT PANTAU HARIAN</div>
          <h2>Owner Summary → Radar Masalah → Benang Merah</h2>
          <p className="da-dashboard-banner-desc">
            Papan ini memakai data bersih dari Owner Control, jadi baris kosong/formatting tidak ikut dihitung sebagai transaksi hidup.
          </p>
        </div>
        <div className="da-dashboard-banner-actions">
          <Badge tone={error ? "danger" : "success"}>{loading ? "Membaca..." : error ? "Perlu Dicek" : "Terhubung"}</Badge>
          <Button variant="ghost" onClick={loadData}>Refresh Data</Button>
        </div>
      </Card>

      {error ? (
        <Card style={{ marginTop: 16 }}>
          <Badge tone="danger">Error</Badge>
          <p className="da-muted" style={{ marginTop: 12 }}>{error}</p>
        </Card>
      ) : null}

      <div className="da-grid da-grid-3" style={{ marginTop: 16 }}>
        <StatCard
          tone="primary"
          label="Uang Masuk Aktual"
          value={loading ? "..." : formatRupiah(summary?.wallet?.money_in || 0)}
          description="Uang yang benar-benar masuk dompet/bank. Ini bahan 4 Amplop."
        />
        <StatCard
          tone="warning"
          label="Sisa Hutang Nana"
          value={loading ? "..." : formatRupiah(summary?.obligations?.hutang_remaining || 0)}
          description="Sisa nota ayam yang belum dibayar."
        />
        <StatCard
          label="Stok Ready"
          value={loading ? "..." : formatNumber(summary?.stock?.ready_pcs || 0, "pcs")}
          description="Stok jadi bebas berdasarkan gerak stok."
        />
        <StatCard
          label="Sisa Ayam"
          value={loading ? "..." : formatNumber(summary?.chicken?.remaining_kg || 0, "kg")}
          description="Sisa kg dari lot ayam aktif."
        />
        <StatCard
          label="PO Customer"
          value={loading ? "..." : formatNumber(summary?.po?.po_count || 0)}
          description={`${formatNumber(summary?.po?.reserved_qty || 0, "pcs")} ditahan, ${formatNumber(summary?.po?.shortage_qty || 0, "pcs")} kurang.`}
        />
        <StatCard
          tone={health?.status === "Perlu Dicek" ? "warning" : "default"}
          label="Kesehatan Kabel"
          value={loading ? "..." : health?.status || "-"}
          description={health?.message || "Membaca koneksi antar modul."}
        />
      </div>

      <div className="da-dashboard-split" style={{ marginTop: 16 }}>
        <Card>
          <div className="da-section-heading">
            <div>
              <div className="da-page-kicker">RADAR OWNER</div>
              <h2 style={{ margin: 0 }}>Yang Perlu Dilihat Cepat</h2>
              <p className="da-muted" style={{ margin: "6px 0 0" }}>
                Klik kartu untuk catatan ringkas. Tindakan tetap dilakukan di modul masing-masing.
              </p>
            </div>
            <Badge tone="success">Live Data</Badge>
          </div>

          <div className="da-action-grid">
            {radar.map((item) => (
              <RadarCard key={item.key} item={item} onClick={setSelectedRadar} />
            ))}
          </div>
        </Card>

        <Card>
          <div className="da-page-kicker">RINGKASAN OPERASI</div>
          <h2 style={{ margin: "4px 0 12px" }}>Saldo & Pergerakan</h2>
          <div className="da-detail-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="da-detail-box"><p>Saldo Dompet</p><strong>{formatRupiah(summary?.wallet?.wallet_balance_total || 0)}</strong></div>
            <div className="da-detail-box"><p>Uang Keluar</p><strong>{formatRupiah(summary?.wallet?.money_out || 0)}</strong></div>
            <div className="da-detail-box"><p>Piutang Terbuka</p><strong>{formatRupiah(summary?.sales?.receivable_open || 0)}</strong></div>
            <div className="da-detail-box"><p>Setoran Pending</p><strong>{formatRupiah(summary?.branch?.deposit_pending || 0)}</strong></div>
            <div className="da-detail-box"><p>Request Cabang</p><strong>{formatNumber(summary?.branch?.request_count || 0)}</strong></div>
            <div className="da-detail-box"><p>Arsip/Jejak Terbaca</p><strong>{formatNumber(counts?.recent_transactions || recent.length || 0)}</strong></div>
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="da-section-heading">
          <div>
            <div className="da-page-kicker">BENANG MERAH USAHA</div>
            <h2 style={{ margin: 0 }}>DROP → Produksi → Stok → Order → Uang → Hutang → 4 Amplop</h2>
            <p className="da-muted" style={{ margin: "6px 0 0" }}>
              Ini peta cepat. Detail lengkap tetap dibuka lewat Owner Control atau Arsip Digital.
            </p>
          </div>
          <Badge tone="warning">Read Only</Badge>
        </div>

        <div className="da-flow-grid">
          {chain.map((item, index) => (
            <FlowCard key={item.title} index={index + 1} item={item} />
          ))}
        </div>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div className="da-section-heading">
          <div>
            <div className="da-page-kicker">TRANSAKSI TERBARU</div>
            <h2 style={{ margin: 0 }}>Jejak ID Terakhir</h2>
            <p className="da-muted" style={{ margin: "6px 0 0" }}>
              Baris kosong/formatting tidak ikut dihitung. Klik detail lengkap lewat Arsip Digital.
            </p>
          </div>
          <Badge tone="success">Archive Hook</Badge>
        </div>
        <DataTable columns={recentColumns()} rows={recent} getRowKey={(row, index) => `${row.module}-${row.id}-${index}`} />
      </Card>

      <Modal
        open={Boolean(selectedRadar)}
        title={selectedRadar?.title || "Radar Owner"}
        subtitle={selectedRadar?.description || "Catatan ringkas dari Papan Pantau."}
        onClose={() => setSelectedRadar(null)}
      >
        <div className="da-detail-grid">
          <div className="da-detail-box"><p>Status</p><strong>{selectedRadar?.status || "-"}</strong></div>
          <div className="da-detail-box"><p>Nilai</p><strong>{selectedRadar?.value || "-"}</strong></div>
        </div>
        <div className="da-modal-note" style={{ marginTop: 16 }}>
          Papan Pantau hanya memberi alarm cepat. Untuk input, pembayaran, approval, atau koreksi, buka modul sumbernya agar rantai ID tetap rapi dan tidak ada angka yatim.
        </div>
      </Modal>
    </div>
  );
}
