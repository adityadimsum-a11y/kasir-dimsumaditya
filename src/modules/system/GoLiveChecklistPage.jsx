import { useEffect, useMemo, useState } from "react";
import { getGoLiveControlBootstrap } from "../../lib/api/actions";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import { openFocusRoute } from "../../lib/navigation/focusRouter";
import GoLiveFirstCyclePanel from "./GoLiveFirstCyclePanel";

const asArray = (value) => (Array.isArray(value) ? value : []);
const safeText = (value, fallback = "-") => String(value || "").trim() || fallback;
const numberValue = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const authRequired = (result) => {
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || message.includes("AUTH_REQUIRED") || (message.includes("SESSION") && message.includes("TIDAK AKTIF"));
};

const stageLabel = (stage) => {
  const labels = {
    OPENING_DATA: "Siapkan Data Awal",
    READY_TO_ACTIVATE: "Siap Diaktifkan",
    CASHIER_LIVE: "Kasir Live",
    FIRST_ORDER_DONE: "Order Pertama Selesai",
    FIRST_CLOSING_DONE: "Closing Pertama Selesai",
    LIVE_CYCLE_COMPLETE: "Siklus Live Lengkap",
  };
  return labels[String(stage || "").toUpperCase()] || safeText(stage, "Belum Siap");
};

const stageTone = (row) => {
  if (row?.cycle_complete) return "success";
  if (row?.cashier_live || row?.ready_for_activation) return "warning";
  return "danger";
};

const stepTone = (step) => {
  if (!step?.applicable) return "default";
  return step?.ready ? "success" : "warning";
};

const migrationLabel = (key) => String(key || "").replace(/^0+/, "").replace(/_/g, " ");

export default function GoLiveChecklistPage({ session, onSessionExpired }) {
  const token = session?.sessionToken || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const locations = useMemo(() => asArray(data?.locations), [data]);
  const actions = useMemo(() => asArray(data?.next_actions), [data]);
  const missingLocations = useMemo(() => asArray(data?.missing_target_locations), [data]);
  const summary = data?.summary || {};
  const health = data?.health || {};

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getGoLiveControlBootstrap(token, {});
      if (authRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Go-Live Control belum dapat dibaca.");
        setData(null);
        return;
      }
      setData(result.data || {});
    } catch (err) {
      setError(err?.message || "Go-Live Control belum dapat dibaca.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const openPage = (pageKey) => {
    if (!pageKey) return;
    openFocusRoute({ pageKey });
  };

  const locationColumns = [
    {
      key: "location_name",
      label: "Lokasi",
      render: (row) => (
        <div>
          <strong>{safeText(row.location_name)}</strong>
          <div className="da-muted">{safeText(row.location_code)} · {safeText(row.location_type)}</div>
        </div>
      ),
    },
    {
      key: "progress_percent",
      label: "Progress",
      render: (row) => <strong>{numberValue(row.progress_percent)}%</strong>,
    },
    {
      key: "stage",
      label: "Tahap",
      render: (row) => <Badge tone={stageTone(row)}>{stageLabel(row.stage)}</Badge>,
    },
    {
      key: "opening",
      label: "Opening Data",
      render: (row) => (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge tone={row.account_ready ? "success" : "warning"}>Akun {row.active_account_count || 0}</Badge>
          <Badge tone={row.price_ready ? "success" : "warning"}>Harga {row.priced_product_count || 0}</Badge>
          <Badge tone={row.wallet_ready ? "success" : "warning"}>Dompet {row.wallet_count || 0}</Badge>
          <Badge tone={row.stock_ready ? "success" : "warning"}>Stok {numberValue(row.free_stock_pcs)} pcs</Badge>
        </div>
      ),
    },
    {
      key: "first_cycle",
      label: "Siklus Pertama",
      render: (row) => (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge tone={row.first_transfer_complete ? "success" : "default"}>DO {row.receipt_count || 0}</Badge>
          <Badge tone={row.first_order_complete ? "success" : "default"}>Order {row.order_count || 0}</Badge>
          <Badge tone={row.first_closing_complete ? "success" : "default"}>Closing {row.daily_report_count || 0}</Badge>
          <Badge tone={row.first_settlement_complete ? "success" : "default"}>Setoran {row.approved_deposit_count || 0}</Badge>
        </div>
      ),
    },
    {
      key: "action",
      label: "Berikutnya",
      render: (row) => row.next_step ? (
        <Button variant="secondary" onClick={(event) => { event.stopPropagation(); openPage(row.next_step.page_key); }}>
          {safeText(row.next_step.label)}
        </Button>
      ) : <Badge tone="success">Selesai</Badge>,
    },
  ];

  const actionColumns = [
    { key: "scope", label: "Lokasi", render: (row) => <Badge tone="default">{safeText(row.scope, "GLOBAL")}</Badge> },
    { key: "title", label: "Tugas", render: (row) => <strong>{safeText(row.title)}</strong> },
    { key: "detail", label: "Keterangan" },
    {
      key: "action",
      label: "Aksi",
      render: (row) => <Button variant="secondary" onClick={() => openPage(row.page_key)}>{safeText(row.action_label, "Buka")}</Button>,
    },
  ];

  return (
    <main className="da-page">
      <PageHeader
        title="Go-Live Control & Opening Data"
        description="Peta kesiapan lokasi, akun, harga, dompet, STO, Kasir, DO, order, closing, dan setoran pertama. Semua angka bisnis tetap dimasukkan manual dari modul sumber."
        badge={health.ready ? "Control Ready" : "Perlu Dilengkapi"}
        badgeTone={health.ready ? "success" : "warning"}
      />

      {error ? <div className="da-alert da-alert-danger">{error}</div> : null}

      <Card
        title="Pusat Aktivasi Operasional"
        description="Tidak ada seed otomatis. Halaman ini hanya membaca, menyusun prioritas, dan mengarahkan Owner ke modul sumber."
        action={<Button variant="secondary" onClick={loadData} disabled={loading}>{loading ? "Membaca..." : "Refresh Control"}</Button>}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge tone="success">Read Only</Badge>
          <Badge tone="success">PHP/MySQL Single Source</Badge>
          <Badge tone={health.opening_migration_016_applied ? "success" : "warning"}>
            Migration 016 {health.opening_migration_016_applied ? "Aktif" : "Belum Tercatat"}
          </Badge>
          <Badge tone="default">Tanpa Harga/Stok Contoh</Badge>
        </div>
      </Card>

      <div className="da-stat-grid">
        <StatCard label="Progress Go-Live" value={`${numberValue(summary.overall_progress_percent)}%`} description="Rata-rata semua lokasi target." tone="primary" />
        <StatCard label="Lokasi Terbaca" value={summary.location_count || 0} description={`Target ${summary.target_location_count || 0} lokasi.`} />
        <StatCard label="Kasir Live" value={summary.cashier_live_count || 0} description="Lokasi yang aktif dan tetap memenuhi syarat." tone="success" />
        <StatCard label="Siklus Lengkap" value={summary.fully_operational_count || 0} description="Order, closing, dan setoran pertama selesai." tone="success" />
      </div>


      <GoLiveFirstCyclePanel
        session={session}
        onSessionExpired={onSessionExpired}
        onChanged={loadData}
      />

      {missingLocations.length ? (
        <Card title="Lokasi Target yang Belum Dibuat" description="Tambahkan lokasi nyata dari Master Lokasi sebelum akun, dompet, harga, dan stok disiapkan.">
          <div style={{ display: "grid", gap: 10 }}>
            {missingLocations.map((row) => (
              <div key={row.location_code} className="da-soft-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <strong>{row.location_name} · {row.location_code}</strong>
                  <div className="da-muted">Tipe {row.location_type}</div>
                </div>
                <Button variant="secondary" onClick={() => openPage(row.page_key)}>Tambah Lokasi</Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card title="Peta Go-Live per Lokasi" description="Klik baris untuk membuka detail langkah dan blocker lokasi.">
        <DataTable
          columns={locationColumns}
          rows={locations}
          getRowKey={(row) => row.location_id}
          onRowClick={(row) => setSelectedLocation(selectedLocation?.location_id === row.location_id ? null : row)}
        />

        {selectedLocation ? (
          <div className="da-soft-panel" style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <strong>{selectedLocation.location_name}</strong>
                <div className="da-muted">Progress {selectedLocation.progress_percent}% · {stageLabel(selectedLocation.stage)}</div>
              </div>
              {selectedLocation.next_step ? (
                <Button variant="secondary" onClick={() => openPage(selectedLocation.next_step.page_key)}>
                  Buka {selectedLocation.next_step.label}
                </Button>
              ) : null}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 12 }}>
              {asArray(selectedLocation.steps).filter((step) => step.applicable).map((step) => (
                <button
                  key={step.code}
                  type="button"
                  onClick={() => openPage(step.page_key)}
                  className="da-soft-panel"
                  style={{ textAlign: "left", cursor: "pointer", border: "1px solid var(--da-line, #e5e7eb)" }}
                >
                  <Badge tone={stepTone(step)}>{step.ready ? "Selesai" : "Belum"}</Badge>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{step.label}</div>
                </button>
              ))}
            </div>

            {asArray(selectedLocation.blockers).length ? (
              <div style={{ marginTop: 12 }}>
                <strong>Yang masih menghambat:</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                  {asArray(selectedLocation.blockers).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card title="Urutan Kerja Owner" description="Daftar ini otomatis berubah setelah data nyata masuk dari modul sumber.">
        <DataTable columns={actionColumns} rows={actions} getRowKey={(row, index) => `${row.scope}-${row.title}-${index}`} />
      </Card>

      <Card title="Kebijakan Opening Data" description="Pagar pengaman sebelum live operasional.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <div className="da-soft-panel"><strong>STO fisik wajib</strong><div className="da-muted">Stok awal hanya berdasarkan hitungan nyata.</div></div>
          <div className="da-soft-panel"><strong>Saldo awal nyata</strong><div className="da-muted">Kas/rekening mengikuti hitungan fisik dan mutasi bank.</div></div>
          <div className="da-soft-panel"><strong>Harga disetujui Owner</strong><div className="da-muted">Tidak ada fallback atau harga contoh.</div></div>
          <div className="da-soft-panel"><strong>HPP historis terkunci</strong><div className="da-muted">Perubahan harga master tidak mengubah transaksi lama.</div></div>
        </div>
      </Card>

      <Card title="Status Migration Inti" description="Migration 016–020 hanya dibaca. Halaman ini tidak meng-import atau mengubah schema.">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(health.migrations || {}).map(([key, ready]) => (
            <Badge key={key} tone={ready ? "success" : "warning"}>{migrationLabel(key)} · {ready ? "Aktif" : "Belum"}</Badge>
          ))}
        </div>
      </Card>
    </main>
  );
}
