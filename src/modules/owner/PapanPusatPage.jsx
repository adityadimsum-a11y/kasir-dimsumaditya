import { useEffect, useMemo, useState } from "react";
import { getLegacyBootstrap, pingBackend } from "../../lib/api/actions";
import { buildBootstrapSummary } from "../../lib/bootstrap/summary";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";

export default function PapanPusatPage({ session }) {
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
      source: "frontend_foundation_part_1a_2",
    });

    if (!bootstrapResult.success) {
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

  const backendStatus = loading
    ? "Mengecek..."
    : error
      ? "Perlu Dicek"
      : "Terhubung";

  const rows = [
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
        description="Tes koneksi backend dan baca data hidup dari Google Sheet. Tahap ini hanya membaca data, belum membuat transaksi."
        badge="Live Backend Test"
      />

      <div className="da-backend-panel">
        <Card>
          <div className="da-backend-status">
            <div>
              <div className="da-mini-title">Status Mesin Backend</div>
              <div className="da-big-text">{backendStatus}</div>
              <p className="da-muted">
                Action yang dites: <strong>legacyBridgePing</strong> dan{" "}
                <strong>getLegacyBootstrap</strong>.
              </p>
            </div>

            <Badge tone={ping?.success ? "success" : "danger"}>
              {ping?.success ? "Ping aktif" : "Ping belum aktif"}
            </Badge>
          </div>

          {error ? (
            <div className="da-login-error" style={{ marginTop: 14 }}>
              {error}
            </div>
          ) : null}

          <div style={{ marginTop: 16 }}>
            <Button variant="ghost" onClick={loadData} disabled={loading}>
              {loading ? "Membaca data..." : "Refresh Data"}
            </Button>
          </div>
        </Card>

        <div className="da-grid da-grid-3">
          <StatCard
            tone="primary"
            label="Uang Masuk Aktual"
            value={loading ? "..." : summary.money.totalUangMasukLabel}
            description="Dibaca dari payment backend. Bukan dari PO, stok, atau piutang."
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

        <div className="da-grid da-grid-3">
          <StatCard
            label="DROP Ayam"
            value={loading ? "..." : summary.counts.dropAyam}
            description="Jumlah nota/drop ayam yang terbaca dari backend."
          />

          <StatCard
            label="Lot Ayam"
            value={loading ? "..." : summary.counts.lotAyam}
            description="Lot harga aktual ayam yang terkunci per nota/drop."
          />

          <StatCard
            label="Produksi / Adukan"
            value={loading ? "..." : summary.counts.produksi}
            description="Batch produksi/adukan yang sudah tercatat."
          />
        </div>

        <Card>
          <div className="da-page-header" style={{ marginBottom: 8 }}>
            <div>
              <div className="da-mini-title">Bootstrap Reader</div>
              <div className="da-big-text">Data Hidup yang Terbaca</div>
              <p className="da-muted">
                Ini ringkasan jumlah baris dari Google Sheet lewat Apps Script.
                Belum ada dummy permanen dan belum membuat transaksi.
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
                {rows.map(([label, value]) => (
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
    </div>
  );
}
