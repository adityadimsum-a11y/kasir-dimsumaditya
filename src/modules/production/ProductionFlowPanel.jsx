import { useEffect, useMemo, useState } from "react";
import { Factory, PackageCheck, PackageOpen, RefreshCw, Snowflake } from "lucide-react";
import { getProductionFlowBootstrap } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
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

const steps = [
  { label: "Pembelian Ayam", icon: PackageOpen },
  { label: "Stok Bahan", icon: PackageCheck },
  { label: "Produksi", icon: Factory },
  { label: "Masuk Freezer", icon: Snowflake },
  { label: "Stok Siap Jual", icon: PackageCheck },
];

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
      setError(result.message || "Data alur produksi belum dapat dimuat.");
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

  const cards = useMemo(() => [
    ["Sisa Ayam", formatNumber(summary.raw_remaining_kg, " kg")],
    ["Total Adukan", formatNumber(summary.total_adukan)],
    ["Masuk Freezer", formatNumber(summary.freezer_in_pcs, " pcs")],
    ["Stok Jadi", formatNumber(summary.finished_stock_pcs, " pcs")],
    ["Nilai Stok", formatRupiah(summary.finished_stock_value || 0)],
  ], [summary]);

  return (
    <Card className={`da-prod-flow-v6 ${compact ? "is-compact" : ""}`.trim()}>
      <div className="da-prod-flow-v6-head">
        <div>
          <span className="da-prod-flow-v6-eyebrow">Alur Produksi</span>
          <strong>Pembelian bahan sampai stok siap jual</strong>
        </div>
        <div className="da-prod-flow-v6-actions">
          <span className={`da-prod-flow-v6-status ${error ? "is-error" : blockers.length ? "is-warning" : "is-ready"}`}>
            {loading ? "Memuat" : error ? "Perlu diperbarui" : blockers.length ? `${blockers.length} perlu perhatian` : "Operasional normal"}
          </span>
          <Button variant="ghost" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} /> {loading ? "Memuat" : "Perbarui"}
          </Button>
        </div>
      </div>

      <div className="da-prod-flow-v6-steps">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div className="da-prod-flow-v6-step" key={step.label}>
              <span className="da-prod-flow-v6-step-icon"><Icon size={15} /></span>
              <div><small>{String(index + 1).padStart(2, "0")}</small><strong>{step.label}</strong></div>
            </div>
          );
        })}
      </div>

      {!compact ? (
        <>
          <div className="da-prod-flow-v6-metrics">
            {cards.map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{loading ? "..." : value}</strong></div>
            ))}
          </div>
          {traces.length > 0 ? (
            <div className="da-prod-flow-v6-recent">
              {traces.slice(0, 6).map((row) => (
                <div key={row.production_id}>
                  <span>{row.production_date || "-"}</span>
                  <strong>{row.production_id || "Produksi"}</strong>
                  <small>{formatNumber(row.actual_pcs, " pcs")}</small>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {error ? <div className="da-prod-flow-v6-error">Data ringkasan produksi belum dapat dimuat. Silakan klik Perbarui.</div> : null}
    </Card>
  );
}
