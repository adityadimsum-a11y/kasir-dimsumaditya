import { useEffect, useMemo, useState } from "react";
import { getLegacyBootstrap, pingBackend } from "../../lib/api/actions";
import { buildBootstrapSummary } from "../../lib/bootstrap/summary";
import { formatRupiah } from "../../lib/format/money";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";

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

function safeText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

function getMoneyValue(row) {
  return (
    row?.remaining_amount ||
    row?.outstanding_amount ||
    row?.total_amount ||
    row?.amount ||
    row?.original_amount ||
    0
  );
}

function MiniInfo({ label, value, description }) {
  return (
    <div className="da-mini-info">
      <div className="da-mini-info-label">{label}</div>
      <div className="da-mini-info-value">{value}</div>
      {description ? <div className="da-mini-info-desc">{description}</div> : null}
    </div>
  );
}

function FlowCard({ number, title, description, status = "Siap dipasang" }) {
  return (
    <div className="da-flow-card">
      <div className="da-flow-number">{number}</div>
      <div>
        <div className="da-flow-title">{title}</div>
        <div className="da-flow-desc">{description}</div>
        <div className="da-flow-status">{status}</div>
      </div>
    </div>
  );
}

function buildActionItems(summary) {
  return [
    {
      key: "hutang-nana",
      tone: "warning",
      title: "Pantau Sisa Hutang",
      value: summary.money.totalHutangTerbukaLabel,
      description:
        "Ada hutang supplier terbuka. Nanti card ini menjadi pintu cepat ke detail Hutang Nana.",
    },
    {
      key: "drop-ayam",
      tone: summary.counts.dropAyam > 0 ? "success" : "danger",
      title: "DROP Ayam Belum Aktif",
      value: `${summary.counts.dropAyam} drop`,
      description:
        "Belum ada DROP Ayam terbaca di bootstrap. Modul ini akan jadi awal nyawa usaha.",
    },
    {
      key: "produksi",
      tone: summary.counts.produksi > 0 ? "success" : "warning",
      title: "Produksi / Adukan",
      value: `${summary.counts.produksi} batch`,
      description:
        "Produksi akan menghubungkan ayam dipakai, barang masuk freezer, dan stok jadi.",
    },
    {
      key: "arsip",
      tone: "success",
      title: "Arsip & Audit",
      value: `${summary.counts.searchIndex} index`,
      description:
        "Search index sudah terbaca. Ini dasar semua transaksi bisa dicari dan diklik.",
    },
  ];
}

function getSupportRows(actionKey, bootstrap) {
  const data = bootstrap || {};

  if (actionKey === "hutang-nana") {
    return asArray(data.payables).slice(0, 8).map((row, index) => ({
      no: index + 1,
      id: safeText(row.payable_id || row.id || row.transaction_id),
      name: safeText(row.supplier_name || row.supplier_id || row.vendor_name),
      amount: formatRupiah(getMoneyValue(row)),
      status: safeText(row.status || row.payable_status),
    }));
  }

  if (actionKey === "drop-ayam") {
    return asArray(data.purchases).slice(0, 8).map((row, index) => ({
      no: index + 1,
      id: safeText(row.purchase_id || row.id || row.transaction_id),
      name: safeText(row.supplier_name || row.supplier_id || "Supplier"),
      amount: formatRupiah(getMoneyValue(row)),
      status: safeText(row.status || row.payment_status),
    }));
  }

  if (actionKey === "produksi") {
    return asArray(data.production_batches).slice(0, 8).map((row, index) => ({
      no: index + 1,
      id: safeText(row.production_id || row.batch_id || row.id),
      name: safeText(row.product_name || row.location_name || "Produksi"),
      amount: safeText(row.actual_output_pcs || row.output_pcs || row.qty),
      status: safeText(row.status || "Tercatat"),
    }));
  }

  if (actionKey === "arsip") {
    return asArray(data.search_index || data.archives).slice(0, 8).map((row, index) => ({
      no: index + 1,
      id: safeText(row.archive_id || row.ref_id || row.transaction_id || row.id),
      name: safeText(row.title || row.module || row.type || "Arsip"),
      amount: safeText(row.created_at || row.timestamp || row.date),
      status: safeText(row.status || "Index"),
    }));
  }

  return [];
}

function ActionCenterCard({ item, onClick }) {
  return (
    <button type="button" className="da-action-card" onClick={() => onClick(item)}>
      <div className="da-action-card-top">
        <Badge tone={item.tone}>{item.title}</Badge>
        <span className="da-action-arrow">›</span>
      </div>
      <div className="da-action-value">{item.value}</div>
      <div className="da-action-desc">{item.description}</div>
    </button>
  );
}

export default function PapanPusatPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [ping, setPing] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");
  const [selectedAction, setSelectedAction] = useState(null);

  const summary = useMemo(() => {
    return buildBootstrapSummary(bootstrap);
  }, [bootstrap]);

  const actionItems = useMemo(() => {
    return buildActionItems(summary);
  }, [summary]);

  const supportRows = useMemo(() => {
    return getSupportRows(selectedAction?.key, bootstrap);
  }, [selectedAction, bootstrap]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const pingResult = await pingBackend();
    setPing(pingResult);

    const bootstrapResult = await getLegacyBootstrap(session?.sessionToken, {
      source: "frontend_foundation_part_1a_4_action_center",
    });

    if (!bootstrapResult.success) {
      if (isAuthRequired(bootstrapResult)) {
        onSessionExpired?.();
        return;
      }

      setError(bootstrapResult.message || "Gagal membaca data dari backend.");
      setBootstrap(null);
      setLoading(false);
      return;
    }

    setBootstrap(bootstrapResult.data || {});
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionToken]);

  const backendStatus = loading ? "Mengecek..." : error ? "Perlu Dicek" : "Terhubung";

  const dataRows = [
    ["Lokasi", summary.counts.lokasi],
    ["Produk", summary.counts.produk],
    ["Customer", summary.counts.customer],
    ["Supplier", summary.counts.supplier],
    ["Dompet", summary.counts.dompet],
    ["DROP Ayam", summary.counts.dropAyam],
    ["Lot Ayam", summary.counts.lotAyam],
    ["Produksi / Adukan", summary.counts.produksi],
    ["Gerak Stok", summary.counts.stokGerak],
    ["Order", summary.counts.order],
    ["Invoice", summary.counts.invoice],
    ["Payment", summary.counts.payment],
    ["Piutang", summary.counts.piutang],
    ["Hutang", summary.counts.hutang],
    ["Kas Keluar", summary.counts.kasKeluar],
    ["Setoran Cabang", summary.counts.setoranCabang],
    ["Arsip", summary.counts.arsip],
    ["Search Index", summary.counts.searchIndex],
  ];

  return (
    <div>
      <PageHeader
        title="Papan Pantau"
        description="Pusat pantau owner untuk melihat kondisi data hidup: uang masuk, hutang, stok, produksi, dan arsip."
        badge="Live Backend"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Mesin usaha</div>
          <div className="da-dashboard-banner-title">Backend {backendStatus}</div>
          <div className="da-dashboard-banner-desc">
            Papan ini hanya membaca data dari Apps Script dan Google Sheet. Belum
            membuat transaksi apa pun.
          </div>
        </div>

        <div className="da-dashboard-banner-actions">
          <Badge tone={ping?.success ? "success" : "danger"}>
            {ping?.success ? "Ping aktif" : "Ping belum aktif"}
          </Badge>

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

      <div className="da-filter-row">
        <select className="da-select" defaultValue="today">
          <option value="today">Hari ini</option>
          <option value="month">Bulan ini</option>
          <option value="all">Semua data</option>
        </select>

        <select className="da-select" defaultValue="all">
          <option value="all">Semua lokasi</option>
          <option value="TGR">Tangerang HO</option>
          <option value="PML">Produksi Pemalang</option>
          <option value="CBN">Resto Cibinong</option>
        </select>

        <Badge tone="warning">Read Only</Badge>
      </div>

      <div className="da-grid da-grid-3">
        <StatCard
          tone="primary"
          label="Uang Masuk Aktual"
          value={loading ? "..." : summary.money.totalUangMasukLabel}
          description="Hanya dari payment backend. Bukan dari PO, stok, atau piutang."
        />

        <StatCard
          label="Sisa Piutang"
          value={loading ? "..." : summary.money.totalPiutangTerbukaLabel}
          description="Tagihan customer yang belum lunas menurut data backend."
        />

        <StatCard
          tone="warning"
          label="Sisa Hutang"
          value={loading ? "..." : summary.money.totalHutangTerbukaLabel}
          description="Hutang terbuka, termasuk hutang supplier jika sudah tercatat."
        />
      </div>

      <div style={{ height: 16 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Owner Action Center</div>
            <div className="da-big-text">Yang Perlu Dipantau</div>
            <p className="da-muted">
              Klik kartu untuk membuka detail popup tengah. Tahap ini masih read-only.
            </p>
          </div>

          <Badge tone="warning">Modal Foundation</Badge>
        </div>

        <div className="da-action-grid">
          {actionItems.map((item) => (
            <ActionCenterCard
              key={item.key}
              item={item}
              onClick={setSelectedAction}
            />
          ))}
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <div className="da-dashboard-split">
        <Card>
          <div className="da-section-heading">
            <div>
              <div className="da-mini-title">Nyawa Usaha</div>
              <div className="da-big-text">Rantai Transaksi</div>
            </div>
            <Badge tone="success">Traceable</Badge>
          </div>

          <div className="da-flow-grid">
            <FlowCard
              number="1"
              title="DROP Ayam"
              description="Ayam masuk, nota supplier, harga aktual, dan hutang Nana."
              status={`${summary.counts.dropAyam} drop terbaca`}
            />

            <FlowCard
              number="2"
              title="Lot Harga Aktual"
              description="Harga ayam terkunci per nota/drop agar transaksi lama tidak berubah."
              status={`${summary.counts.lotAyam} lot terbaca`}
            />

            <FlowCard
              number="3"
              title="Produksi / Adukan"
              description="Ayam dipakai produksi, barang jadi masuk freezer, stok siap jual."
              status={`${summary.counts.produksi} batch terbaca`}
            />

            <FlowCard
              number="4"
              title="Kasir / Order"
              description="Order memotong stok nyata, lalu membuat invoice dan payment."
              status={`${summary.counts.order} order terbaca`}
            />

            <FlowCard
              number="5"
              title="Hutang Nana"
              description="Pantau sisa nota ayam berjalan dan hutang lama supplier."
              status={`${summary.counts.hutang} hutang terbaca`}
            />

            <FlowCard
              number="6"
              title="Arsip & Audit"
              description="Semua transaksi wajib punya ID, audit, arsip, dan bisa diklik."
              status={`${summary.counts.searchIndex} index arsip`}
            />
          </div>
        </Card>

        <Card>
          <div className="da-section-heading">
            <div>
              <div className="da-mini-title">Kesehatan Data</div>
              <div className="da-big-text">Yang Sudah Terbaca</div>
            </div>
          </div>

          <div className="da-health-list">
            <MiniInfo
              label="Master Produk"
              value={loading ? "..." : summary.counts.produk}
              description="Produk aktif sebagai dasar order dan stok."
            />

            <MiniInfo
              label="Customer"
              value={loading ? "..." : summary.counts.customer}
              description="Pelanggan dan potensi harga khusus."
            />

            <MiniInfo
              label="Dompet"
              value={loading ? "..." : summary.counts.dompet}
              description="Cash, BCA, BRI, dan dompet cabang."
            />

            <MiniInfo
              label="Arsip Digital"
              value={loading ? "..." : summary.counts.arsip}
              description="Riwayat transaksi yang sudah masuk arsip."
            />
          </div>
        </Card>
      </div>

      <div style={{ height: 16 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Bootstrap Reader</div>
            <div className="da-big-text">Data Hidup yang Terbaca</div>
            <p className="da-muted">
              Ringkasan jumlah baris dari Google Sheet lewat Apps Script.
              Ini tetap read-only dan belum membuat transaksi.
            </p>
          </div>

          <Badge tone="warning">Read Only</Badge>
        </div>

        <div className="da-table-card">
          <table className="da-table">
            <thead>
              <tr>
                <th>Area Data</th>
                <th style={{ textAlign: "right" }}>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {dataRows.map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td style={{ textAlign: "right", fontWeight: 800 }}>
                    {loading ? "..." : value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={Boolean(selectedAction)}
        title={selectedAction?.title}
        subtitle="Detail popup tengah — read-only foundation"
        onClose={() => setSelectedAction(null)}
      >
        <div className="da-modal-summary">
          <div>
            <div className="da-mini-title">Nilai Ringkas</div>
            <div className="da-big-text">{selectedAction?.value}</div>
            <p className="da-muted">{selectedAction?.description}</p>
          </div>

          <Badge tone={selectedAction?.tone || "warning"}>Read Only</Badge>
        </div>

        <div className="da-modal-note">
          Tahap ini belum membuka halaman transaksi penuh. Popup ini menjadi pola
          dasar detail transaksi ERP: klik kartu / baris → lihat detail tengah →
          nanti bisa lanjut ke arsip, audit, print, atau tindakan sesuai izin.
        </div>

        <div className="da-table-card">
          <table className="da-table">
            <thead>
              <tr>
                <th>No</th>
                <th>ID / Sumber</th>
                <th>Nama</th>
                <th>Nilai / Qty</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {supportRows.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <span className="da-muted">
                      Belum ada baris pendukung yang terbaca untuk area ini.
                    </span>
                  </td>
                </tr>
              ) : (
                supportRows.map((row) => (
                  <tr key={`${row.no}-${row.id}`}>
                    <td>{row.no}</td>
                    <td style={{ fontWeight: 800 }}>{row.id}</td>
                    <td>{row.name}</td>
                    <td>{row.amount}</td>
                    <td>
                      <Badge tone="warning">{row.status}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
