import { useEffect, useMemo, useState } from "react";
import { getSalesFlowControl } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";

function numberValue(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAuthRequired(result) {
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  const message = String(result?.message || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || message.includes("AUTH_REQUIRED");
}

export default function SalesFlowPanel({
  session,
  onSessionExpired,
  compact = false,
  refreshKey = 0,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const locationId =
    session?.user?.location_id || session?.user?.location_code || "";

  const load = async () => {
    setLoading(true);
    setError("");

    const result = await getSalesFlowControl(session?.sessionToken || "", {
      location_id: locationId,
    });

    setLoading(false);

    if (!result?.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setData(null);
      setError(result?.message || "Kontrol penjualan belum dapat dibaca.");
      return;
    }

    setData(result.data || {});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionToken, locationId, refreshKey]);

  const summary = data?.summary || {};
  const blockers = Array.isArray(data?.blockers) ? data.blockers : [];
  const ready = data?.health?.ready === true && blockers.length === 0;

  const cards = useMemo(
    () => [
      ["Order Resmi", numberValue(summary.sales_orders)],
      ["PO Aktif", numberValue(summary.open_po)],
      ["Uang Masuk", formatRupiah(numberValue(summary.payment_total))],
      ["Piutang", formatRupiah(numberValue(summary.receivable_open))],
      ["HPP Keluar", formatRupiah(numberValue(summary.cogs_total))],
      ["Margin Kotor", formatRupiah(numberValue(summary.gross_margin))],
    ],
    [summary]
  );

  return (
    <Card>
      <div className="da-section-heading">
        <div>
          <div className="da-mini-title">BENANG MERAH PENJUALAN</div>
          <h3 style={{ margin: "4px 0" }}>
            PO → Order → Invoice → Uang Masuk/Piutang → Stok & HPP
          </h3>
          <p className="da-muted" style={{ margin: 0 }}>
            PO belum menjadi omzet. Penjualan resmi dan HPP baru tercatat pada
            tahap yang benar.
          </p>
        </div>
        <div className="da-form-actions" style={{ margin: 0 }}>
          <Badge tone={ready ? "success" : "warning"}>
            {ready ? "Sales Trace Ready" : "Perlu Cek"}
          </Badge>
          <Button variant="ghost" onClick={load} disabled={loading}>
            {loading ? "Memuat..." : "Refresh Trace"}
          </Button>
        </div>
      </div>

      {error ? <div className="da-form-warning">{error}</div> : null}

      {!compact ? (
        <>
          <div className="da-stat-grid" style={{ marginTop: 14 }}>
            {cards.map(([label, value]) => (
              <div className="da-stat-card" key={label}>
                <div className="da-stat-label">{label}</div>
                <div className="da-stat-value">{value}</div>
              </div>
            ))}
          </div>

          {blockers.length > 0 ? (
            <div className="da-form-warning" style={{ marginTop: 14 }}>
              <strong>{blockers.length} blocker integritas:</strong>
              {blockers.map((item) => (
                <div key={item.code}>
                  • {item.label}: {numberValue(item.count)} baris
                </div>
              ))}
            </div>
          ) : data ? (
            <div className="da-form-success" style={{ marginTop: 14 }}>
              Invoice, payment/piutang, wallet, HPP, jurnal, arsip, dan audit
              tidak menemukan kabel yang putus.
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
