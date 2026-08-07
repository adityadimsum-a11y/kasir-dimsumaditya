import { useEffect, useMemo, useState } from "react";
import { getOwnerControlBootstrap } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
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

  if (
    text.includes("AMAN") ||
    text.includes("SEHAT") ||
    text.includes("LUNAS") ||
    text.includes("READY") ||
    text.includes("TERHUBUNG")
  ) {
    return "success";
  }

  if (
    text.includes("PERLU") ||
    text.includes("BELUM") ||
    text.includes("WARNING") ||
    text.includes("KURANG") ||
    text.includes("OPEN") ||
    text.includes("JATUH")
  ) {
    return "warning";
  }

  if (
    text.includes("BAHAYA") ||
    text.includes("ERROR") ||
    text.includes("MINUS") ||
    text.includes("GAGAL")
  ) {
    return "danger";
  }

  return "default";
}

function normalizeSummary(data) {
  return data?.summary || {};
}

function getHealthTone(health) {
  return getToneByStatus(health?.status || "Aman");
}

function getRadar(summary) {
  const hutang = numberValue(summary?.obligations?.hutang_remaining);
  const ready = numberValue(summary?.stock?.ready_pcs);
  const sisaAyam = numberValue(summary?.chicken?.remaining_kg);
  const uangBelumDibagi = numberValue(summary?.amplop?.unallocated);
  const poKurang = numberValue(summary?.po?.shortage_qty);
  const requestPending = numberValue(summary?.branch?.request_pending_count);
  const setoranPending = numberValue(summary?.branch?.deposit_pending);
  const kewajibanOwner = numberValue(summary?.owner_obligations?.due_this_month);
  const payrollBelumDibayar = numberValue(summary?.payroll?.unpaid_total);

  return [
    {
      key: "hutang",
      title: "Sisa Hutang Nana",
      value: formatRupiah(hutang),
      rawValue: hutang,
      status: hutang > 0 ? "Perlu Dipantau" : "Aman",
      priority: hutang > 0 ? "warning" : "success",
      description: "Pastikan jadwal bayar ayam tidak putus dari uang masuk aktual.",
      nextAction: "Cek Hutang Nana dan pembayaran supplier sebelum alokasi besar lain.",
    },
    {
      key: "stok",
      title: "Stok Ready",
      value: formatNumber(ready, "pcs"),
      rawValue: ready,
      status: ready > 0 ? "Ready" : "Kosong",
      priority: ready > 0 ? "success" : "warning",
      description: "Stok jadi bebas untuk kasir/order. Bukan stok PO yang ditahan.",
      nextAction: "Cek Stok Jadi dan PO agar barang ready tidak bentrok dengan order tertahan.",
    },
    {
      key: "ayam",
      title: "Sisa Ayam Mentah",
      value: formatNumber(sisaAyam, "kg"),
      rawValue: sisaAyam,
      status: sisaAyam > 0 ? "Masih Ada" : "Kosong",
      priority: sisaAyam > 0 ? "success" : "warning",
      description: "Sisa ayam dari lot aktif yang belum dipakai adukan.",
      nextAction: "Cek DROP Ayam, lot aktif, dan Produksi/Adukan.",
    },
    {
      key: "amplop",
      title: "Belum Dibagi 4 Amplop",
      value: formatRupiah(uangBelumDibagi),
      rawValue: uangBelumDibagi,
      status: uangBelumDibagi > 0 ? "Perlu Dibagi" : "Aman",
      priority: uangBelumDibagi > 0 ? "warning" : "success",
      description: "Hanya dari uang masuk aktual yang sudah punya sumber mutasi.",
      nextAction: "Cek 4 Amplop setelah uang masuk dan mutasi dompet jelas sumbernya.",
    },
    {
      key: "po",
      title: "Kekurangan PO",
      value: formatNumber(poKurang, "pcs"),
      rawValue: poKurang,
      status: poKurang > 0 ? "Perlu Produksi" : "Aman",
      priority: poKurang > 0 ? "warning" : "success",
      description: "PO customer yang belum cukup stoknya harus masuk radar produksi.",
      nextAction: "Buka Antrian PO dan Produksi/Adukan.",
    },
    {
      key: "request",
      title: "Request Cabang Pending",
      value: formatNumber(requestPending),
      rawValue: requestPending,
      status: requestPending > 0 ? "Perlu Approve" : "Aman",
      priority: requestPending > 0 ? "warning" : "success",
      description: "Permintaan barang cabang dipisah dari PO customer.",
      nextAction: "Buka Request & DO atau Setoran Cabang sesuai sumbernya.",
    },
    {
      key: "setoran",
      title: "Setoran Pending",
      value: formatRupiah(setoranPending),
      rawValue: setoranPending,
      status: setoranPending > 0 ? "Perlu Approve" : "Aman",
      priority: setoranPending > 0 ? "warning" : "success",
      description: "Setoran belum menjadi uang pusat sebelum owner/Tangerang approve.",
      nextAction: "Buka Validasi Setoran Cabang untuk cek rincian.",
    },
    {
      key: "kewajiban-owner",
      title: "Kewajiban Owner Bulan Ini",
      value: formatRupiah(kewajibanOwner),
      rawValue: kewajibanOwner,
      status: kewajibanOwner > 0 ? "Jatuh Tempo" : "Aman",
      priority: kewajibanOwner > 0 ? "warning" : "success",
      description: "Cicilan/tagihan owner dibayar lewat Kewajiban Owner supaya masuk KASOUT dan Mutasi Dompet.",
      nextAction: "Buka Kewajiban Owner sebelum closing owner.",
    },
    {
      key: "payroll",
      title: "Payroll Belum Dibayar",
      value: formatRupiah(payrollBelumDibayar),
      rawValue: payrollBelumDibayar,
      status: payrollBelumDibayar > 0 ? "Perlu Bayar" : "Aman",
      priority: payrollBelumDibayar > 0 ? "warning" : "success",
      description: "Payroll closing baru jadi uang keluar setelah dibayar dari dompet.",
      nextAction: "Buka HRD/Payroll hanya untuk owner/Tangerang.",
    },
  ];
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
      title: "Kewajiban Owner",
      value: formatRupiah(summary?.owner_obligations?.total_remaining || 0),
      description: "Cicilan/tagihan owner → KASOUT → Mutasi Dompet → Arsip.",
      status: `${formatNumber(summary?.owner_obligations?.active_count || 0)} aktif`,
    },
    {
      title: "HRD / Payroll",
      value: formatRupiah(summary?.payroll?.unpaid_total || 0),
      description: "Payroll closing → Bayar Gaji → KASOUT → Mutasi Dompet.",
      status: `${formatNumber(summary?.payroll?.draft_count || 0)} draft`,
    },
    {
      title: "4 Amplop",
      value: formatRupiah(summary?.amplop?.allocated_total || 0),
      description: "Pembagian hanya dari uang masuk aktual yang bersumber jelas.",
      status: `${formatRupiah(summary?.amplop?.unallocated || 0)} belum dibagi`,
    },
  ];
}

function getPrioritySummary(radar) {
  const warnings = radar.filter((item) => item.priority === "warning" && item.rawValue > 0);
  const danger = radar.filter((item) => item.priority === "danger" && item.rawValue > 0);

  if (danger.length > 0) {
    return {
      tone: "danger",
      label: `${danger.length} bahaya`,
      text: "Ada alarm penting yang harus dicek dari modul sumber.",
    };
  }

  if (warnings.length > 0) {
    return {
      tone: "warning",
      label: `${warnings.length} pantauan`,
      text: "Ada beberapa hal yang perlu dipantau owner sebelum keputusan kas/stok.",
    };
  }

  return {
    tone: "success",
    label: "Aman",
    text: "Tidak ada alarm besar. Tetap cek transaksi terbaru dan arsip.",
  };
}

function FlowCard({ index, item }) {
  return (
    <div className="da-owner-flow-card">
      <div className="da-owner-flow-number">{index}</div>
      <div>
        <div className="da-owner-flow-title">{item.title}</div>
        <div className="da-owner-flow-desc">{item.description}</div>
        <div className="da-owner-flow-status">
          <strong>{item.value}</strong>
          <span>{item.status}</span>
        </div>
      </div>
    </div>
  );
}

function RadarCard({ item, onClick }) {
  return (
    <button
      type="button"
      className={`da-owner-radar-card da-owner-radar-card-${item.priority || "default"}`}
      onClick={() => onClick(item)}
    >
      <div className="da-owner-radar-top">
        <Badge tone={getToneByStatus(item.status)}>{item.status}</Badge>
        <span className="da-owner-radar-arrow">›</span>
      </div>

      <div className="da-owner-radar-title">{item.title}</div>
      <div className="da-owner-radar-value">{item.value}</div>
      <div className="da-owner-radar-desc">{item.description}</div>
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
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge tone={getToneByStatus(row.status)}>
          {row.status || "Tercatat"}
        </Badge>
      ),
    },
  ];
}


function RadarDetailOverlay({ item, onClose, onOpenSource }) {
  if (!item) return null;

  return (
    <div className="da-radar-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="da-radar-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="da-radar-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="da-radar-modal-close"
          aria-label="Tutup detail radar"
          onClick={onClose}
        >
          ×
        </button>

        <div className="da-radar-modal-head">
          <div>
            <div className="da-page-kicker">RADAR OWNER</div>
            <h2 id="da-radar-modal-title">{item.title}</h2>
            <p>{item.description}</p>
          </div>

          <Badge tone={getToneByStatus(item.status)}>{item.status}</Badge>
        </div>

        <div className="da-radar-modal-summary">
          <div className="da-radar-modal-stat">
            <span>Status</span>
            <strong>{item.status || "-"}</strong>
          </div>

          <div className="da-radar-modal-stat">
            <span>Nilai</span>
            <strong>{item.value || "-"}</strong>
          </div>
        </div>

        <div className="da-radar-modal-action">
          <div className="da-page-kicker">ARAH TINDAKAN</div>
          <p>{item.nextAction || "Buka modul sumber agar rantai ID tetap rapi."}</p>
        </div>

        <div className="da-radar-modal-note">
          Papan Pantau hanya memberi alarm cepat. Untuk input, pembayaran, approval, atau koreksi, buka modul sumbernya agar tidak ada angka yatim.
        </div>

        <div className="da-radar-modal-footer">
          <button type="button" className="da-button da-button-ghost" onClick={onClose}>
            Tutup
          </button>
          <button type="button" className="da-button da-button-primary" onClick={() => onOpenSource?.(item)}>
            Buka Modul Sumber
          </button>
        </div>
      </section>
    </div>
  );
}


export default function PapanPusatPage({ session, onSessionExpired, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedRadar, setSelectedRadar] = useState(null);

  const summary = useMemo(() => normalizeSummary(data), [data]);
  const radar = useMemo(() => getRadar(summary), [summary]);
  const recent = useMemo(() => asArray(data?.recent_transactions).slice(0, 10), [data]);

  const loadData = async (options = {}) => {
    setLoading(true);
    setError("");

    const result = await getOwnerControlBootstrap(session?.sessionToken, {
      source: "frontend_operations_ui_v2_owner_dashboard",
      view: "fast_dashboard",
      mode: "fast_dashboard",
      limit: 10,
      cache_seconds: 45,
      skip_health: true,
      force_refresh: Boolean(options.forceRefresh),
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal membaca Dashboard Owner.");
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

  const radarSorted = [...radar].sort((a, b) => {
    const score = (item) => item.priority === "danger" ? 3 : item.priority === "warning" ? 2 : 1;
    return score(b) - score(a) || numberValue(b.rawValue) - numberValue(a.rawValue);
  });
  const radarPrimary = radarSorted.slice(0, 6);

  const goToRadarSource = (item) => {
    const map = {
      hutang: "hutang-nana",
      stok: "stok-jadi",
      ayam: "stok-ayam",
      amplop: "empat-amplop",
      po: "antrian-po",
      request: "request-do",
      setoran: "setoran-cabang",
      "kewajiban-owner": "kewajiban-owner",
      payroll: "hrd-payroll",
    };
    const page = map[item?.key];
    if (page) onNavigate?.(page);
  };

  return (
    <div className="da-page da-owner-dashboard da-owner-dashboard-v2">
      <PageHeader
        title="Dashboard Owner"
        description="Pusat kendali harian Dimsum Aditya untuk keputusan uang, penjualan, produksi, stok, hutang, kewajiban, payroll, dan cabang."
        actions={(
          <Button variant="secondary" onClick={() => loadData({ forceRefresh: true })}>
            {loading ? "Memuat..." : "Refresh Data"}
          </Button>
        )}
      />

      {error ? (
        <Card tone="danger" className="da-owner-error-card">
          <Badge tone="danger">Data belum terbaca</Badge>
          <p style={{ marginTop: 10 }}>{error}</p>
        </Card>
      ) : null}

      <div className="da-owner-kpi-strip-v2">
        <StatCard
          tone="success"
          label="Uang Tersedia"
          value={loading ? "..." : formatRupiah(summary?.wallet?.wallet_balance_total || 0)}
          description="Total saldo dompet operasional yang terbaca."
          onClick={() => onNavigate?.("kas-dompet")}
        />
        <StatCard
          label="Penjualan"
          value={loading ? "..." : formatRupiah(summary?.sales?.invoice_total || 0)}
          description={`${formatNumber(summary?.sales?.orders_count || 0)} order tercatat.`}
          onClick={() => onNavigate?.("kasir-order")}
        />
        <StatCard
          tone={summary?.obligations?.hutang_remaining > 0 ? "warning" : "success"}
          label="Hutang Nana"
          value={loading ? "..." : formatRupiah(summary?.obligations?.hutang_remaining || 0)}
          description="Outstanding nota ayam dan hutang lama."
          onClick={() => onNavigate?.("hutang-nana")}
        />
        <StatCard
          label="Stok Ready"
          value={loading ? "..." : formatNumber(summary?.stock?.ready_pcs || 0, "pcs")}
          description="Stok jadi bebas yang siap dijual."
          onClick={() => onNavigate?.("stok-jadi")}
        />
        <StatCard
          tone={summary?.owner_obligations?.due_this_month > 0 ? "warning" : "default"}
          label="Jatuh Tempo"
          value={loading ? "..." : formatRupiah(summary?.owner_obligations?.due_this_month || 0)}
          description="Kewajiban owner bulan berjalan."
          onClick={() => onNavigate?.("kewajiban-owner")}
        />
        <StatCard
          tone={summary?.payroll?.unpaid_total > 0 ? "warning" : "default"}
          label="Payroll"
          value={loading ? "..." : formatRupiah(summary?.payroll?.unpaid_total || 0)}
          description="Payroll closing yang belum dibayar."
          onClick={() => onNavigate?.("hrd-payroll")}
        />
      </div>

      <div className="da-owner-command-grid-v2">
        <Card
          className="da-owner-action-center-v2"
          title="Yang Perlu Ditindak"
          description="Prioritas owner hari ini. Klik kartu untuk melihat ringkasan sebelum membuka modul sumber."
          action={<Badge tone={radarPrimary.some((item) => item.priority === "warning" || item.priority === "danger") ? "warning" : "success"}>Action Center</Badge>}
        >
          <div className="da-owner-action-grid-v2">
            {radarPrimary.map((item) => (
              <RadarCard key={item.key} item={item} onClick={setSelectedRadar} />
            ))}
          </div>
        </Card>

        <Card
          className="da-owner-money-position-v2"
          title="Posisi Uang"
          description="Ringkasan arus uang dan kewajiban yang memerlukan perhatian owner."
          action={<Button variant="secondary" onClick={() => onNavigate?.("owner-control")}>Owner Control</Button>}
        >
          <div className="da-owner-mini-list da-owner-mini-list-v2">
            <div><span>Saldo Dompet</span><strong>{formatRupiah(summary?.wallet?.wallet_balance_total || 0)}</strong></div>
            <div><span>Uang Masuk</span><strong>{formatRupiah(summary?.wallet?.money_in || 0)}</strong></div>
            <div><span>Uang Keluar</span><strong>{formatRupiah(summary?.wallet?.money_out || 0)}</strong></div>
            <div><span>Piutang Terbuka</span><strong>{formatRupiah(summary?.sales?.receivable_open || 0)}</strong></div>
            <div><span>Hutang Nana</span><strong>{formatRupiah(summary?.obligations?.hutang_remaining || 0)}</strong></div>
            <div><span>Belum Dibagi 4 Amplop</span><strong>{formatRupiah(summary?.amplop?.unallocated || 0)}</strong></div>
          </div>
        </Card>
      </div>

      <div className="da-owner-business-grid-v2">
        <Card
          title="Produksi & Stok"
          description="Posisi bahan utama sampai barang jadi siap jual."
          action={<Button variant="secondary" onClick={() => onNavigate?.("produksi-adukan")}>Buka Produksi</Button>}
        >
          <div className="da-owner-business-metrics-v2">
            <div><span>Ayam Masuk</span><strong>{formatNumber(summary?.chicken?.total_drop_kg || 0, "kg")}</strong></div>
            <div><span>Sisa Ayam</span><strong>{formatNumber(summary?.chicken?.remaining_kg || 0, "kg")}</strong></div>
            <div><span>Hasil Produksi</span><strong>{formatNumber(summary?.production?.output_pcs || 0, "pcs")}</strong></div>
            <div><span>Stok Ready</span><strong>{formatNumber(summary?.stock?.ready_pcs || 0, "pcs")}</strong></div>
          </div>
        </Card>

        <Card
          title="Penjualan & PO"
          description="Order, stok yang ditahan, shortage, dan potensi penagihan."
          action={<Button variant="secondary" onClick={() => onNavigate?.("antrian-po")}>Buka PO</Button>}
        >
          <div className="da-owner-business-metrics-v2">
            <div><span>Order</span><strong>{formatNumber(summary?.sales?.orders_count || 0)}</strong></div>
            <div><span>Nilai Invoice</span><strong>{formatRupiah(summary?.sales?.invoice_total || 0)}</strong></div>
            <div><span>Stok Ditahan PO</span><strong>{formatNumber(summary?.po?.reserved_qty || 0, "pcs")}</strong></div>
            <div><span>Kekurangan PO</span><strong>{formatNumber(summary?.po?.shortage_qty || 0, "pcs")}</strong></div>
          </div>
        </Card>
      </div>

      <Card
        className="da-owner-recent-panel"
        title="Aktivitas Terbaru"
        description="Jejak transaksi terakhir yang masuk ke Arsip Digital."
        action={<Button variant="secondary" onClick={() => onNavigate?.("arsip-digital")}>Buka Arsip</Button>}
      >
        <DataTable
          columns={recentColumns()}
          rows={recent}
          getRowKey={(row, index) => `${row.module}-${row.id}-${index}`}
          onRowClick={() => onNavigate?.("arsip-digital")}
        />
      </Card>

      <RadarDetailOverlay
        item={selectedRadar}
        onClose={() => setSelectedRadar(null)}
        onOpenSource={(item) => { goToRadarSource(item); setSelectedRadar(null); }}
      />
    </div>
  );
}
