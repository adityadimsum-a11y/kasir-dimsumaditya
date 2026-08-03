import { useEffect, useMemo, useState } from "react";
import { getProductionFlowBootstrap } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";

function numberValue(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, suffix = "") {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(numberValue(value))}${suffix}`;
}

function isAuthRequired(result) {
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  const message = String(result?.message || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || (message.includes("SESSION") && message.includes("TIDAK AKTIF"));
}

export default function ProductionFlowPanel({ session, onSessionExpired, compact = false }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const summary = data?.summary || {};
  const blockers = Array.isArray(data?.blockers) ? data.blockers : [];
  const traces = Array.isArray(data?.recent_traces) ? data.recent_traces : [];

  const loadData = async () => {
    setLoading(true);
    setError("");
    const result = await getProductionFlowBootstrap(session?.sessionToken, {
      location_id: session?.user?.location_id || "",
      limit: compact ? 5 : 12,
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setError(result.message || "Gagal membaca rantai Nyawa Produksi.");
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
  }, [session?.sessionToken, session?.user?.location_id]);

  const statusTone = error ? "danger" : blockers.length > 0 ? "warning" : "success";
  const statusText = loading
    ? "Membaca..."
    : error
      ? "Perlu Cek"
      : blockers.length > 0
        ? `${blockers.length} blocker`
        : "Rantai Utuh";

  const cards = useMemo(() => [
    ["Sisa Ayam", formatNumber(summary.raw_remaining_kg, " kg")],
    ["Total Adukan", formatNumber(summary.total_adukan)],
    ["Masuk Freezer", formatNumber(summary.freezer_in_pcs, " pcs")],
    ["Stok Jadi", formatNumber(summary.finished_stock_pcs, " pcs")],
    ["Nilai Stok Jadi", formatRupiah(summary.finished_stock_value || 0)],
  ], [summary]);

  return (
    <Card style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div className="da-page-kicker">NYAWA PRODUKSI — PHP/MYSQL SINGLE SOURCE</div>
          <h2 style={{ margin: "4px 0 6px" }}>DROP → Lot Ayam → Adukan → Freezer → Stok Jadi</h2>
          <p className="da-muted" style={{ margin: 0 }}>
            HPP mengikuti harga lot saat produksi. Produksi tidak memotong dompet; pembayaran supplier berjalan dari DROP/Hutang Nana.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Badge tone={statusTone}>{statusText}</Badge>
          <Button variant="ghost" onClick={loadData} disabled={loading}>
            Refresh Rantai
          </Button>
        </div>
      </div>

      {error ? <div className="da-login-error" style={{ marginTop: 14 }}>{error}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10, marginTop: 16 }}>
        {cards.map(([label, value]) => (
          <div key={label} style={{ border: "1px solid var(--da-border, #e5e7eb)", borderRadius: 14, padding: 12, background: "#fff" }}>
            <div className="da-page-kicker">{label}</div>
            <strong style={{ display: "block", marginTop: 5, fontSize: 19 }}>{loading ? "..." : value}</strong>
          </div>
        ))}
      </div>

      {blockers.length > 0 ? (
        <div className="da-login-error" style={{ marginTop: 14 }}>
          <strong>Rantai yang harus diperiksa:</strong>
          {blockers.map((item) => (
            <div key={item.code} style={{ marginTop: 5 }}>
              {item.label}: <strong>{numberValue(item.count).toLocaleString("id-ID")}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {!compact && traces.length > 0 ? (
        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table className="da-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Produksi ID</th>
                <th>Lot / DROP</th>
                <th>Adukan</th>
                <th>Hasil</th>
                <th>Modal Batch</th>
                <th>Integritas</th>
              </tr>
            </thead>
            <tbody>
              {traces.map((row) => (
                <tr key={row.production_id}>
                  <td>{row.production_date || "-"}</td>
                  <td><strong>{row.production_id || "-"}</strong></td>
                  <td>{row.chicken_lot_id || "-"}<br /><small>{row.purchase_id || row.invoice_no || ""}</small></td>
                  <td>{formatNumber(row.adukan_qty)}</td>
                  <td>{formatNumber(row.actual_pcs, " pcs")}</td>
                  <td>{formatRupiah(row.total_batch_cost || 0)}</td>
                  <td><Badge tone={String(row.integrity_status || "PASS").toUpperCase() === "PASS" ? "success" : "warning"}>{row.integrity_status || "PASS"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
