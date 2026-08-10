import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Gauge,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { getGoLiveControlBootstrap } from "../../lib/api/actions";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Tabs from "../../components/ui/Tabs";
import { openFocusRoute } from "../../lib/navigation/focusRouter";
import GoLiveFirstCyclePanel from "./GoLiveFirstCyclePanel";
import "../../styles/golive-control.css";

const asArray = (value) => (Array.isArray(value) ? value : []);
const safeText = (value, fallback = "-") => String(value || "").trim() || fallback;
const numberValue = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const clampPercent = (value) => Math.max(0, Math.min(100, numberValue(value)));

const authRequired = (result) => {
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || code.includes("UNAUTHORIZED") || message.includes("AUTH_REQUIRED") || (message.includes("SESSION") && message.includes("TIDAK AKTIF"));
};

const stageLabel = (stage) => {
  const labels = {
    OPENING_DATA: "Siapkan Data Awal",
    READY_TO_ACTIVATE: "Siap Diaktifkan",
    READY_FOR_PRODUCTION: "Siap Produksi",
    CASHIER_LIVE: "Kasir Live",
    FIRST_PRODUCTION_DONE: "Produksi Pertama Selesai",
    FIRST_ORDER_DONE: "Order Pertama Selesai",
    FIRST_CLOSING_DONE: "Closing Pertama Selesai",
    LIVE_CYCLE_COMPLETE: "Siklus Operasional Lengkap",
  };
  return labels[String(stage || "").toUpperCase()] || safeText(stage, "Belum Siap");
};

const stepTone = (step) => {
  if (!step?.applicable) return "default";
  return step?.ready ? "success" : "warning";
};

function ReadinessItem({ label, value, ready }) {
  return (
    <div className={`system-readiness-pill ${ready ? "is-ready" : "is-pending"}`}>
      {ready ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const TABS = [
  { key: "overview", label: "Ringkasan" },
  { key: "locations", label: "Per Lokasi" },
  { key: "cycle", label: "Siklus Pertama" },
];

export default function GoLiveChecklistPage({ session, onSessionExpired }) {
  const token = session?.sessionToken || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const locations = useMemo(() => asArray(data?.locations), [data]);
  const actions = useMemo(() => asArray(data?.next_actions), [data]);
  const missingLocations = useMemo(() => asArray(data?.missing_target_locations), [data]);
  const summary = data?.summary || {};
  const health = data?.health || {};
  const progress = clampPercent(summary.overall_progress_percent);
  const primaryAction = actions[0] || null;
  const selectedLocation = useMemo(
    () => locations.find((row) => row.location_id === selectedLocationId) || null,
    [locations, selectedLocationId]
  );
  const targetCount = numberValue(summary.target_location_count);
  const fullyOperational = numberValue(summary.fully_operational_count);
  const allOperational = targetCount > 0 && missingLocations.length === 0 && progress >= 100 && fullyOperational >= targetCount;
  const readyLocations = locations.filter((row) => clampPercent(row.progress_percent) >= 100 || row.cycle_complete).length;
  const migrationEntries = Object.entries(health.migrations || {});
  const activeFoundationCount = migrationEntries.filter(([, ready]) => Boolean(ready)).length;

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
        setError(result?.message || "Kesiapan Operasional belum dapat dibaca.");
        setData(null);
        return;
      }
      setData(result.data || {});
    } catch (err) {
      setError(err?.message || "Kesiapan Operasional belum dapat dibaca.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (selectedLocationId && !locations.some((row) => row.location_id === selectedLocationId)) {
      setSelectedLocationId("");
    }
  }, [locations, selectedLocationId]);

  const openPage = (pageKey) => {
    if (!pageKey) return;
    openFocusRoute({ pageKey });
  };

  return (
    <main className="da-page system-control-page system-golive-v17">
      <PageHeader
        eyebrow="Sistem · Owner Control"
        title="Kesiapan Operasional"
        description="Pantau data awal, kesiapan lokasi, dan siklus transaksi pertama sebelum setiap cabang dinyatakan siap beroperasi penuh."
        actions={(
          <div className="da-actions">
            <Button variant="secondary" onClick={loadData} disabled={loading}>
              <RefreshCw size={15} /> {loading ? "Membaca..." : "Perbarui"}
            </Button>
          </div>
        )}
      />

      {error ? <div className="da-alert da-alert-danger">{error}</div> : null}

      <section className="system-golive-hero">
        <div className="system-golive-copy">
          <div className="system-golive-icon"><Gauge size={24} /></div>
          <div>
            <span className="system-eyebrow">Status Aktivasi</span>
            <h2>{allOperational ? "Seluruh lokasi siap operasional" : `${progress}% menuju operasional penuh`}</h2>
            <p>Progress berasal dari akun, harga, dompet dan saldo awal, stok nyata, aktivitas utama, closing, dan setoran sesuai tipe lokasi. Ini bukan indikator kelengkapan kode.</p>
            <div className="system-chip-row">
              <Badge tone={allOperational ? "success" : "warning"}>{allOperational ? "Siap Operasional" : "Belum Siap Penuh"}</Badge>
              <Badge tone="success">Data Nyata</Badge>
              <Badge tone={health.period_write_lock_ready ? "success" : "danger"}>Kunci Periode {health.period_write_lock_ready ? "Aktif" : "Belum"}</Badge>
            </div>
          </div>
        </div>
        <div className="system-golive-progressbox">
          <div className="system-progress-value"><strong>{progress}%</strong><span>{fullyOperational}/{targetCount || locations.length} lokasi GREEN</span></div>
          <div className="system-progress-track"><span style={{ width: `${progress}%` }} /></div>
          {primaryAction ? (
            <button type="button" className="system-next-action" onClick={() => openPage(primaryAction.page_key)}>
              <span><small>Prioritas berikutnya</small><strong>{safeText(primaryAction.title)}</strong><em>{safeText(primaryAction.scope, "GLOBAL")}</em></span>
              <ChevronRight size={18} />
            </button>
          ) : (
            <div className="system-next-action is-done"><span><small>Status</small><strong>Tidak ada pekerjaan pembuka tertunda</strong></span><CheckCircle2 size={18} /></div>
          )}
        </div>
      </section>

      <section className="system-kpi-grid system-kpi-grid-4">
        <StatCard label="Lokasi Terbaca" value={summary.location_count || 0} description={`Target ${targetCount || 0} lokasi.`} />
        <StatCard label="Lokasi Siap" value={readyLocations} description="Opening data/siklus sudah lengkap." tone={readyLocations === targetCount && targetCount ? "success" : "default"} />
        <StatCard label="Kasir Live" value={summary.cashier_live_count || 0} description="Hanya lokasi penjualan yang membutuhkan kasir." />
        <StatCard label="Siklus GREEN" value={fullyOperational} description="Siklus transaksi pertama sudah dikunci." tone={fullyOperational ? "success" : "default"} />
      </section>

      <div className="system-tabs-wrap"><Tabs items={TABS} activeKey={activeTab} onChange={setActiveTab} /></div>

      {activeTab === "overview" ? (
        <div className="system-workspace-grid system-golive-overview">
          <Card title="Prioritas Owner" description="Urutan berikut berubah otomatis setelah data nyata masuk dari modul sumber." action={<Badge tone={actions.length ? "warning" : "success"}>{actions.length} langkah</Badge>}>
            {actions.length ? (
              <div className="system-action-list">
                {actions.slice(0, 6).map((row, index) => (
                  <button type="button" key={`${row.scope}-${row.title}-${index}`} onClick={() => openPage(row.page_key)}>
                    <span className="system-action-no">{index + 1}</span>
                    <span><small>{safeText(row.scope, "GLOBAL")}</small><strong>{safeText(row.title)}</strong><em>{safeText(row.detail)}</em></span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            ) : <div className="system-empty-success"><strong>Tidak ada prioritas opening data yang tertunda.</strong><span>Operasional dapat dilanjutkan sesuai modul sumber.</span></div>}
          </Card>

          <Card title="Pagar Pengaman" description="Aturan yang tidak boleh dilewati sebelum live.">
            <div className="system-rule-list">
              <div><strong>STO fisik wajib</strong><span>Stok awal hanya dari hitungan nyata.</span></div>
              <div><strong>Saldo awal nyata</strong><span>Kas dan rekening mengikuti saldo fisik/bank.</span></div>
              <div><strong>Harga disetujui Owner</strong><span>Tidak ada harga fallback atau contoh.</span></div>
              <div><strong>HPP historis terkunci</strong><span>Harga master baru tidak mengubah transaksi lama.</span></div>
            </div>
            <details className="system-technical-details">
              <summary>Fondasi sistem ({activeFoundationCount}/{migrationEntries.length || 0} aktif)</summary>
              <div className="system-foundation-list">
                {migrationEntries.map(([key, ready]) => (
                  <div key={key}><span>{String(key).replace(/^0+/, "").replace(/_/g, " ")}</span><Badge tone={ready ? "success" : "warning"}>{ready ? "Aktif" : "Belum"}</Badge></div>
                ))}
              </div>
            </details>
          </Card>

          {missingLocations.length ? (
            <Card title="Lokasi Target Belum Lengkap" description="Tambahkan lokasi nyata sebelum menyiapkan akun, dompet, harga, dan stok.">
              <div className="system-location-missing-list">
                {missingLocations.map((row) => (
                  <button key={row.location_code} type="button" onClick={() => openPage(row.page_key)}>
                    <MapPin size={17} /><span><strong>{row.location_name}</strong><small>{row.location_code} · {row.location_type}</small></span><ChevronRight size={17} />
                  </button>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {activeTab === "locations" ? (
        <Card title="Kesiapan per Lokasi" description="Klik lokasi untuk melihat blocker dan langkah berikutnya.">
          <div className="system-location-grid">
            {locations.map((row) => {
              const rowProgress = clampPercent(row.progress_percent);
              const isReady = rowProgress >= 100 || row.cycle_complete;
              return (
                <button key={row.location_id} type="button" className="system-location-card" onClick={() => setSelectedLocationId(row.location_id)}>
                  <div className="system-location-card-head">
                    <span><strong>{safeText(row.location_name)}</strong><small>{safeText(row.location_code)} · {safeText(row.location_type)}</small></span>
                    <Badge tone={isReady ? "success" : "warning"}>{isReady ? "Siap" : `${rowProgress}%`}</Badge>
                  </div>
                  <div className="system-progress-track"><span style={{ width: `${rowProgress}%` }} /></div>
                  <div className="system-readiness-grid">
                    <ReadinessItem label="Akun" value={row.active_account_count || 0} ready={row.account_ready} />
                    <ReadinessItem label="Harga" value={row.price_required === false ? "Tidak wajib" : (row.priced_product_count || 0)} ready={row.price_ready} />
                    <ReadinessItem label="Dompet" value={`${numberValue(row.wallet_opening_count)}/${numberValue(row.wallet_count)}`} ready={row.wallet_ready} />
                    <ReadinessItem label={row.is_production_location ? "Stok Bahan" : "Stok Jadi"} value={row.is_production_location ? `${numberValue(row.raw_stock_qty)} kg` : `${numberValue(row.free_stock_pcs)} pcs`} ready={row.stock_ready} />
                  </div>
                  <div className="system-location-next"><span>{row.next_step ? safeText(row.next_step.label) : "Selesai"}</span><ChevronRight size={17} /></div>
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      {activeTab === "cycle" ? (
        <GoLiveFirstCyclePanel session={session} onSessionExpired={onSessionExpired} onChanged={loadData} />
      ) : null}

      <Modal
        open={Boolean(selectedLocation)}
        title={selectedLocation ? selectedLocation.location_name : "Detail Lokasi"}
        subtitle={selectedLocation ? `${selectedLocation.location_code} · ${stageLabel(selectedLocation.stage)}` : ""}
        onClose={() => setSelectedLocationId("")}
      >
        {selectedLocation ? (
          <div className="system-modal-stack">
            <div className="system-location-modal-summary">
              <div><span>Progress</span><strong>{clampPercent(selectedLocation.progress_percent)}%</strong></div>
              <div><span>Status</span><strong>{stageLabel(selectedLocation.stage)}</strong></div>
              <div><span>Blocker</span><strong>{asArray(selectedLocation.blockers).length}</strong></div>
            </div>
            <div className="system-step-grid">
              {asArray(selectedLocation.steps).filter((step) => step.applicable).map((step) => (
                <button key={step.code} type="button" onClick={() => step.page_key && openPage(step.page_key)}>
                  {step.ready ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                  <span><strong>{step.label}</strong><small>{step.ready ? "Sudah siap" : "Perlu dilengkapi"}</small></span>
                  <Badge tone={stepTone(step)}>{step.ready ? "Siap" : "Belum"}</Badge>
                </button>
              ))}
            </div>
            {asArray(selectedLocation.blockers).length ? (
              <div className="system-modal-warning"><strong>Yang masih menghambat:</strong> {asArray(selectedLocation.blockers).join(" · ")}</div>
            ) : <div className="system-empty-success"><strong>Opening data lokasi ini lengkap.</strong><span>Lanjutkan siklus transaksi pertama bila belum GREEN.</span></div>}
            <div className="da-form-actions system-modal-actions">
              <Button variant="secondary" onClick={() => setSelectedLocationId("")}>Tutup</Button>
              {selectedLocation.next_step ? <Button onClick={() => openPage(selectedLocation.next_step.page_key)}>Buka {selectedLocation.next_step.label}</Button> : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}
