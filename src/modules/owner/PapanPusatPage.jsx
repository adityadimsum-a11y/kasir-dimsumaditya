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


function RadarDetailOverlay({ item, onClose }) {
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
        </div>
      </section>
    </div>
  );
}


export default function PapanPusatPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedRadar, setSelectedRadar] = useState(null);

  const summary = useMemo(() => normalizeSummary(data), [data]);
  const radar = useMemo(() => getRadar(summary), [summary]);
  const chain = useMemo(() => getBenangMerah(summary), [summary]);
  const priority = useMemo(() => getPrioritySummary(radar), [radar]);
  const recent = useMemo(() => asArray(data?.recent_transactions).slice(0, 8), [data]);
  const health = data?.health || {};
  const counts = data?.counts || {};

  const loadData = async (options = {}) => {
    setLoading(true);
    setError("");

    const result = await getOwnerControlBootstrap(session?.sessionToken, {
      source: "frontend_part_8c_papan_pantau_fast_dashboard",
      view: "fast_dashboard",
      mode: "fast_dashboard",
      limit: 8,
      cache_seconds: 45,
      skip_health: true,
      force_refresh: Boolean(options.forceRefresh),
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
    <div className="da-page da-owner-dashboard">
      <PageHeader
        title="Papan Pantau"
        description="Ringkasan owner untuk melihat uang, stok, produksi, PO, hutang, kewajiban owner, payroll, setoran, dan 4 Amplop dalam satu dashboard ringan. Read-only, tidak membuat transaksi."
        badge="Live Dashboard"
        badgeTone="warning"
      />

      <Card className="da-owner-hero-card">
        <div className="da-owner-hero-main">
          <div className="da-page-kicker">PUSAT PANTAU HARIAN</div>
          <h2>Owner Summary → Radar Masalah → Benang Merah</h2>
          <p>
            Papan ini memakai data bersih dari Owner Control. Baris kosong/formatting tidak ikut dihitung sebagai transaksi hidup.
          </p>

          <div className="da-owner-hero-actions">
            <Badge tone={error ? "danger" : loading ? "warning" : "success"}>
              {loading ? "Membaca..." : error ? "Perlu Dicek" : "Terhubung"}
            </Badge>
            <Button variant="ghost" onClick={() => loadData({ forceRefresh: true })}>
              Refresh Data
            </Button>
          </div>
        </div>

        <div className="da-owner-hero-status">
          <Badge tone={priority.tone}>{priority.label}</Badge>
          <strong>{priority.text}</strong>
          <span>Kesehatan kabel: {health?.status || "Membaca..."}</span>
        </div>
      </Card>

      {error ? (
        <Card className="da-owner-error-card">
          <Badge tone="danger">Error</Badge>
          <p>{error}</p>
        </Card>
      ) : null}

      <div className="da-grid da-grid-4 da-owner-kpi-grid">
        <StatCard
          tone="default"
          label="Uang Masuk Aktual"
          value={loading ? "..." : formatRupiah(summary?.wallet?.money_in || 0)}
          description="Uang benar-benar masuk dompet/bank. Bahan 4 Amplop."
        />
        <StatCard
          tone={summary?.obligations?.hutang_remaining > 0 ? "warning" : "success"}
          label="Sisa Hutang Nana"
          value={loading ? "..." : formatRupiah(summary?.obligations?.hutang_remaining || 0)}
          description="Sisa nota ayam yang belum dibayar."
        />
        <StatCard
          tone="default"
          label="Stok Ready"
          value={loading ? "..." : formatNumber(summary?.stock?.ready_pcs || 0, "pcs")}
          description="Stok jadi bebas berdasarkan gerak stok."
        />
        <StatCard
          tone="default"
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
          tone={summary?.owner_obligations?.due_this_month > 0 ? "warning" : "default"}
          label="Kewajiban Owner"
          value={loading ? "..." : formatRupiah(summary?.owner_obligations?.due_this_month || 0)}
          description="Jatuh tempo bulan ini dari kewajiban/cicilan owner."
        />
        <StatCard
          tone={summary?.payroll?.unpaid_total > 0 ? "warning" : "default"}
          label="Payroll Belum Dibayar"
          value={loading ? "..." : formatRupiah(summary?.payroll?.unpaid_total || 0)}
          description="Payroll closing yang belum dibayar dari dompet."
        />
        <StatCard
          tone={getHealthTone(health)}
          label="Kesehatan Kabel"
          value={loading ? "..." : health?.status || "-"}
          description={health?.message || "Membaca koneksi antar modul."}
        />
      </div>

      <div className="da-owner-radar-layout">
        <Card className="da-owner-radar-panel">
          <div className="da-section-heading da-owner-section-heading">
            <div>
              <div className="da-page-kicker">RADAR OWNER</div>
              <h2>Yang Perlu Dilihat Cepat</h2>
              <p>
                Klik kartu untuk catatan ringkas. Tindakan tetap dilakukan di modul masing-masing agar rantai ID tetap rapi.
              </p>
            </div>
            <Badge tone="success">Live Data</Badge>
          </div>

          <div className="da-owner-radar-grid">
            {radar.map((item) => (
              <RadarCard key={item.key} item={item} onClick={setSelectedRadar} />
            ))}
          </div>
        </Card>

        <Card className="da-owner-side-panel">
          <div className="da-page-kicker">RINGKASAN OPERASI</div>
          <h2>Saldo & Pergerakan</h2>

          <div className="da-owner-mini-list">
            <div><span>Saldo Dompet</span><strong>{formatRupiah(summary?.wallet?.wallet_balance_total || 0)}</strong></div>
            <div><span>Uang Keluar</span><strong>{formatRupiah(summary?.wallet?.money_out || 0)}</strong></div>
            <div><span>Piutang Terbuka</span><strong>{formatRupiah(summary?.sales?.receivable_open || 0)}</strong></div>
            <div><span>Setoran Pending</span><strong>{formatRupiah(summary?.branch?.deposit_pending || 0)}</strong></div>
            <div><span>Request Cabang</span><strong>{formatNumber(summary?.branch?.request_count || 0)}</strong></div>
            <div><span>Kewajiban Owner</span><strong>{formatRupiah(summary?.owner_obligations?.total_remaining || 0)}</strong></div>
            <div><span>Payroll Belum Dibayar</span><strong>{formatRupiah(summary?.payroll?.unpaid_total || 0)}</strong></div>
            <div><span>Arsip/Jejak Terbaca</span><strong>{formatNumber(counts?.recent_transactions || recent.length || 0)}</strong></div>
          </div>
        </Card>
      </div>

      <Card className="da-owner-flow-panel">
        <div className="da-section-heading da-owner-section-heading">
          <div>
            <div className="da-page-kicker">BENANG MERAH USAHA</div>
            <h2>DROP → Produksi → Stok → Order → Uang → Hutang/Kewajiban → Payroll → 4 Amplop</h2>
            <p>
              Ini peta cepat usaha. Detail lengkap tetap dibuka lewat Owner Control atau Arsip Digital.
            </p>
          </div>
          <Badge tone="warning">Read Only</Badge>
        </div>

        <div className="da-owner-flow-grid">
          {chain.map((item, index) => (
            <FlowCard key={item.title} index={index + 1} item={item} />
          ))}
        </div>
      </Card>

      <Card className="da-owner-recent-panel">
        <div className="da-section-heading da-owner-section-heading">
          <div>
            <div className="da-page-kicker">TRANSAKSI TERBARU</div>
            <h2>Jejak ID Terakhir</h2>
            <p>
              Baris kosong/formatting tidak ikut dihitung. Klik detail lengkap lewat Arsip Digital.
            </p>
          </div>
          <Badge tone="success">Archive Hook</Badge>
        </div>

        <DataTable
          columns={recentColumns()}
          rows={recent}
          getRowKey={(row, index) => `${row.module}-${row.id}-${index}`}
        />
      </Card>

      <RadarDetailOverlay
        item={selectedRadar}
        onClose={() => setSelectedRadar(null)}
      />
    </div>
  );
}
