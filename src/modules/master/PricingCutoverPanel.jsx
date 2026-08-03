import { useEffect, useMemo, useState } from "react";

import { getPricingCutoverReadiness } from "../../lib/api/actions";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import StatCard from "../../components/ui/StatCard";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function isAuthRequired(result) {
  const message = String(
    result?.message || result?.error?.message || ""
  ).toUpperCase();
  const code = String(
    result?.error?.code || result?.code || ""
  ).toUpperCase();

  return (
    code.includes("AUTH_REQUIRED") ||
    message.includes("AUTH_REQUIRED") ||
    (message.includes("SESSION") &&
      (message.includes("TIDAK AKTIF") ||
        message.includes("KADALUWARSA")))
  );
}

function statusLabel(status) {
  switch (String(status || "").toUpperCase()) {
    case "READY_FOR_CONTROLLED_LIVE":
      return "Siap Live Terkontrol";
    case "WAITING_ORDER_STOCK":
      return "Menunggu Stok Ready";
    case "WAITING_OFFICIAL_PRICE":
      return "Menunggu Harga Resmi";
    default:
      return "Pondasi Belum Siap";
  }
}

function statusTone(status) {
  switch (String(status || "").toUpperCase()) {
    case "READY_FOR_CONTROLLED_LIVE":
      return "success";
    case "WAITING_ORDER_STOCK":
    case "WAITING_OFFICIAL_PRICE":
      return "warning";
    default:
      return "danger";
  }
}

function formatQty(value) {
  return `${numberValue(value).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  })} pcs`;
}

export default function PricingCutoverPanel({
  sessionToken,
  onSessionExpired,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [readiness, setReadiness] = useState(null);

  const loadData = async () => {
    if (!sessionToken) return;

    setLoading(true);
    setError("");

    const result = await getPricingCutoverReadiness(sessionToken, {
      price_date: new Date().toISOString().slice(0, 10),
      source: "frontend_part_2e_pricing_cutover_readiness",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setReadiness(null);
      setError(
        result.message ||
          "Gagal membaca kesiapan cutover harga."
      );
      setLoading(false);
      return;
    }

    setReadiness(result.data || {});
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  const counts = readiness?.counts || {};
  const blockers = asArray(readiness?.blockers);
  const matrix = asArray(readiness?.matrix);

  const columns = useMemo(
    () => [
      {
        key: "product",
        label: "Produk",
        render: (row) => (
          <div>
            <strong>{safeText(row.product_name)}</strong>
            <div className="da-muted">
              {safeText(row.product_code, row.product_id)}
            </div>
          </div>
        ),
      },
      {
        key: "location",
        label: "Lokasi",
        render: (row) => (
          <div>
            <strong>{safeText(row.location_name)}</strong>
            <div className="da-muted">
              {safeText(row.location_code, row.location_id)}
            </div>
          </div>
        ),
      },
      {
        key: "price",
        label: "Harga Resmi",
        render: (row) => (
          <div>
            <Badge tone={row.price_ready ? "success" : "warning"}>
              {row.price_ready ? "Rule Siap" : "Belum Ada Rule"}
            </Badge>
            <div className="da-muted" style={{ marginTop: 6 }}>
              {numberValue(row.resolvable_rule_count)} rule Kasir
            </div>
          </div>
        ),
      },
      {
        key: "stock",
        label: "Stok Bebas",
        render: (row) => (
          <div>
            <strong>{formatQty(row.free_qty)}</strong>
            <div className="da-muted">
              Fisik {formatQty(row.physical_qty)} · Reserved {formatQty(row.reserved_qty)}
            </div>
          </div>
        ),
      },
      {
        key: "status",
        label: "Status Kasir",
        render: (row) => (
          <div>
            <Badge tone={statusTone(row.status)}>
              {statusLabel(row.status)}
            </Badge>
            {!row.order_ready && asArray(row.blockers).length > 0 ? (
              <div className="da-muted" style={{ marginTop: 6 }}>
                {row.blockers[0]}
              </div>
            ) : null}
          </div>
        ),
      },
    ],
    []
  );

  const currentStatus = readiness?.status || "FOUNDATION_NOT_READY";
  const readyForPriceEntry = readiness?.ready_for_price_entry === true;
  const readyForOrderLive = readiness?.ready_for_order_live === true;

  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="da-eyebrow">Controlled Pricing Cutover</div>
          <h2 style={{ margin: "4px 0 6px" }}>
            Kesiapan Harga Resmi & Kasir
          </h2>
          <p className="da-muted" style={{ margin: 0 }}>
            Pemeriksaan read-only. Halaman ini tidak membuat rule, tidak
            mengaktifkan harga, dan tidak menciptakan transaksi.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Badge tone={statusTone(currentStatus)}>
            {statusLabel(currentStatus)}
          </Badge>
          <Badge tone="success">Read Only</Badge>
          <Button type="button" onClick={loadData} disabled={loading}>
            {loading ? "Mengecek..." : "Refresh Readiness"}
          </Button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: "#fff1f0",
          }}
        >
          {error}
        </div>
      ) : null}

      <div className="da-stat-grid" style={{ marginTop: 16 }}>
        <StatCard
          label="Pondasi Harga"
          value={readyForPriceEntry ? "SIAP" : "BELUM"}
          tone={readyForPriceEntry ? "success" : "warning"}
          description="Migration 014, 015, Pricing Engine, dan Server Price Lock."
        />
        <StatCard
          label="Rule Harga Aktif"
          value={numberValue(counts.active_valid_price_rules).toLocaleString("id-ID")}
          tone={numberValue(counts.active_valid_price_rules) > 0 ? "success" : "warning"}
          description="Harga resmi yang berlaku pada tanggal pemeriksaan."
        />
        <StatCard
          label="Kombinasi Siap Harga"
          value={`${numberValue(counts.price_ready_combinations).toLocaleString("id-ID")} / ${numberValue(counts.product_location_combinations).toLocaleString("id-ID")}`}
          description="Produk dan lokasi yang sudah dapat di-resolve Kasir."
        />
        <StatCard
          label="Kasir Siap Live"
          value={readyForOrderLive ? "SIAP" : "DIBLOKIR"}
          tone={readyForOrderLive ? "success" : "warning"}
          description="Membutuhkan harga resmi aktif dan stok bebas."
        />
      </div>

      {blockers.length > 0 ? (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 14,
            background: "#fff8e7",
            border: "1px solid #f3d58a",
          }}
        >
          <strong>Yang masih menahan Kasir:</strong>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {blockers.map((item) => (
              <div key={item}>• {item}</div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div>
            <strong>Peta Produk × Lokasi</strong>
            <div className="da-muted">
              Tidak menampilkan atau menebak nominal harga.
            </div>
          </div>
          <Badge tone="default">
            Tanggal {safeText(readiness?.price_date)}
          </Badge>
        </div>

        <DataTable
          columns={columns}
          rows={matrix}
          getRowKey={(row) =>
            `${row.product_id}-${row.location_id}`
          }
        />
      </div>
    </Card>
  );
}
