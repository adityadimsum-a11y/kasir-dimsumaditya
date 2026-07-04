import { useEffect, useMemo, useState } from "react";
import { getLegacyBootstrap, pingBackend } from "../../lib/api/actions";
import { buildBootstrapSummary } from "../../lib/bootstrap/summary";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "")
    .toUpperCase();

  const code = String(result?.error?.code || result?.code || "").toUpperCase();

  return (
    code.includes("AUTH_REQUIRED") ||
    message.includes("AUTH_REQUIRED") ||
    message.includes("SESSION") && message.includes("TIDAK AKTIF")
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

export default function PapanPusatPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [ping, setPing] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    return buildBootstrapSummary(bootstrap);
  }, [bootstrap]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const pingResult = await pingBackend();
    setPing(pingResult);

    const bootstrapResult = await getLegacyBootstrap(session?.sessionToken, {
      source: "frontend_foundation_part_1a_3_dashboard_polish",
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
          <div className="da-dashboard-banner-title">
            Backend {backendStatus}
          </div>
          <div className="da-dashboard-banner-desc">
            Papan ini hanya membaca data dari Apps Script dan Google Sheet.
            Belum membuat transaksi apa pun.
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
    </div>
  );
}
