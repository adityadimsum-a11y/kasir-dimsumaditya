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
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
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

function ReadinessItem({ label, value, ready }) {
  return (
    <div className={`golive-readiness-item ${ready ? "is-ready" : "is-pending"}`}>
      {ready ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function GoLiveChecklistPage({ session, onSessionExpired }) {
  const token = session?.sessionToken || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState("");

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
    <main className="da-page golive-page">
      <PageHeader
        title="Go-Live & Data Awal"
        description="Pusat kendali untuk memastikan lokasi, akun, harga, dompet, stok awal, kasir, dan siklus transaksi pertama siap sebelum operasional penuh."
        badge={health.ready ? "Control Ready" : "Perlu Dilengkapi"}
        badgeTone={health.ready ? "success" : "warning"}
      />

      {error ? <div className="da-alert da-alert-danger">{error}</div> : null}

      <section className="golive-command-card">
        <div className="golive-command-main">
          <div className="golive-command-icon"><Gauge size={25} /></div>
          <div className="golive-command-copy">
            <div className="golive-eyebrow">Pusat Aktivasi Operasional</div>
            <h2>{progress >= 100 ? "Semua lokasi siap dioperasikan" : `${100 - progress}% lagi menuju operasional penuh`}</h2>
            <p>Semua angka tetap berasal dari transaksi dan opening data nyata. Halaman ini tidak membuat seed harga, saldo, stok, maupun transaksi contoh.</p>
            <div className="golive-status-row">
              <Badge tone="success">Read Only</Badge>
              <Badge tone="success">PHP/MySQL Single Source</Badge>
              <Badge tone={health.opening_migration_016_applied ? "success" : "warning"}>
                Migration 016 {health.opening_migration_016_applied ? "Aktif" : "Belum"}
              </Badge>
              <Badge tone="default">Tanpa Data Contoh</Badge>
            </div>
          </div>
        </div>

        <div className="golive-command-side">
          <div className="golive-progress-head">
            <span>Progress keseluruhan</span>
            <strong>{progress}%</strong>
          </div>
          <div className="golive-progress-track" aria-label={`Progress Go-Live ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          {primaryAction ? (
            <button type="button" className="golive-next-action" onClick={() => openPage(primaryAction.page_key)}>
              <span>
                <small>Prioritas berikutnya</small>
                <strong>{safeText(primaryAction.title)}</strong>
                <em>{safeText(primaryAction.scope, "GLOBAL")}</em>
              </span>
              <ChevronRight size={20} />
            </button>
          ) : (
            <div className="golive-next-action is-complete">
              <span>
                <small>Status</small>
                <strong>Tidak ada tugas pembuka tertunda</strong>
              </span>
              <CheckCircle2 size={20} />
            </div>
          )}
          <Button variant="secondary" onClick={loadData} disabled={loading} className="golive-refresh-button">
            <RefreshCw size={15} /> {loading ? "Membaca..." : "Refresh Control"}
          </Button>
        </div>
      </section>

      <div className="golive-kpi-grid">
        <StatCard label="Progress Go-Live" value={`${progress}%`} description="Rata-rata seluruh lokasi target." tone="primary" />
        <StatCard label="Lokasi Terbaca" value={summary.location_count || 0} description={`Target ${summary.target_location_count || 0} lokasi.`} />
        <StatCard label="Kasir Live" value={summary.cashier_live_count || 0} description="Lokasi aktif yang memenuhi syarat." tone="success" />
        <StatCard label="Siklus Lengkap" value={summary.fully_operational_count || 0} description="Order, closing, dan setoran pertama selesai." tone="success" />
      </div>

      {missingLocations.length ? (
        <Card className="golive-warning-card" title="Lokasi target belum lengkap" description="Tambahkan lokasi nyata sebelum menyiapkan akun, dompet, harga, dan stok.">
          <div className="golive-missing-grid">
            {missingLocations.map((row) => (
              <button key={row.location_code} type="button" className="golive-missing-item" onClick={() => openPage(row.page_key)}>
                <MapPin size={18} />
                <span><strong>{row.location_name}</strong><small>{row.location_code} · {row.location_type}</small></span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="golive-location-section" title="Kesiapan per Lokasi" description="Ringkasan opening data dan langkah berikutnya. Klik kartu untuk melihat detail blocker.">
        <div className="golive-location-grid">
          {locations.map((row) => {
            const rowProgress = clampPercent(row.progress_percent);
            const active = selectedLocationId === row.location_id;
            return (
              <button
                key={row.location_id}
                type="button"
                className={`golive-location-card ${active ? "is-active" : ""}`}
                onClick={() => setSelectedLocationId(active ? "" : row.location_id)}
              >
                <div className="golive-location-card-head">
                  <div>
                    <span className="golive-location-code">{safeText(row.location_code)}</span>
                    <strong>{safeText(row.location_name)}</strong>
                    <small>{safeText(row.location_type)}</small>
                  </div>
                  <Badge tone={stageTone(row)}>{stageLabel(row.stage)}</Badge>
                </div>

                <div className="golive-location-progress">
                  <div><span>Progress</span><strong>{rowProgress}%</strong></div>
                  <div className="golive-progress-track"><span style={{ width: `${rowProgress}%` }} /></div>
                </div>

                <div className="golive-readiness-grid">
                  <ReadinessItem label="Akun" value={row.active_account_count || 0} ready={row.account_ready} />
                  <ReadinessItem label="Harga" value={row.priced_product_count || 0} ready={row.price_ready} />
                  <ReadinessItem label="Dompet" value={row.wallet_count || 0} ready={row.wallet_ready} />
                  <ReadinessItem label="Stok" value={`${numberValue(row.free_stock_pcs)} pcs`} ready={row.stock_ready} />
                </div>

                <div className="golive-location-next">
                  <span>{row.next_step ? safeText(row.next_step.label) : "Selesai"}</span>
                  <ChevronRight size={17} />
                </div>
              </button>
            );
          })}
        </div>

        {selectedLocation ? (
          <div className="golive-location-detail">
            <div className="golive-location-detail-head">
              <div>
                <span className="golive-eyebrow">Detail Lokasi</span>
                <h3>{selectedLocation.location_name}</h3>
                <p>{selectedLocation.location_code} · Progress {clampPercent(selectedLocation.progress_percent)}% · {stageLabel(selectedLocation.stage)}</p>
              </div>
              <div className="golive-detail-actions">
                {selectedLocation.next_step ? (
                  <Button variant="secondary" onClick={() => openPage(selectedLocation.next_step.page_key)}>
                    Buka {selectedLocation.next_step.label}
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => setSelectedLocationId("")}>Tutup</Button>
              </div>
            </div>

            <div className="golive-step-grid">
              {asArray(selectedLocation.steps).filter((step) => step.applicable).map((step) => (
                <button key={step.code} type="button" className={`golive-step-card ${step.ready ? "is-ready" : "is-pending"}`} onClick={() => openPage(step.page_key)}>
                  {step.ready ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                  <span><strong>{step.label}</strong><small>{step.ready ? "Sudah siap" : "Perlu dilengkapi"}</small></span>
                  <Badge tone={stepTone(step)}>{step.ready ? "Siap" : "Belum"}</Badge>
                </button>
              ))}
            </div>

            {asArray(selectedLocation.blockers).length ? (
              <div className="golive-blocker-box">
                <AlertTriangle size={20} />
                <div>
                  <strong>Yang masih menghambat</strong>
                  <ul>{asArray(selectedLocation.blockers).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                </div>
              </div>
            ) : (
              <div className="golive-ready-box"><CheckCircle2 size={20} /><span>Opening data lokasi ini sudah lengkap.</span></div>
            )}
          </div>
        ) : null}
      </Card>

      <GoLiveFirstCyclePanel session={session} onSessionExpired={onSessionExpired} onChanged={loadData} />

      <Card className="golive-owner-actions" title="Urutan Kerja Owner" description="Prioritas otomatis berubah setelah data nyata masuk dari modul sumber.">
        {actions.length ? (
          <div className="golive-action-list">
            {actions.map((row, index) => (
              <div className="golive-action-item" key={`${row.scope}-${row.title}-${index}`}>
                <span className="golive-action-number">{index + 1}</span>
                <div className="golive-action-copy">
                  <div><Badge tone="default">{safeText(row.scope, "GLOBAL")}</Badge></div>
                  <strong>{safeText(row.title)}</strong>
                  <p>{safeText(row.detail)}</p>
                </div>
                <Button variant="secondary" onClick={() => openPage(row.page_key)}>{safeText(row.action_label, "Buka Modul")}</Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="golive-ready-box"><CheckCircle2 size={20} /><span>Tidak ada pekerjaan opening data yang tertunda.</span></div>
        )}
      </Card>

      <div className="golive-footer-grid">
        <Card className="golive-policy-card" title="Pagar Pengaman Opening Data" description="Aturan yang tidak boleh dilewati sebelum live.">
          <div className="golive-policy-list">
            <div><ShieldCheck size={18} /><span><strong>STO fisik wajib</strong><small>Stok awal hanya dari hitungan nyata.</small></span></div>
            <div><ShieldCheck size={18} /><span><strong>Saldo awal nyata</strong><small>Kas dan rekening mengikuti saldo fisik/bank.</small></span></div>
            <div><ShieldCheck size={18} /><span><strong>Harga disetujui Owner</strong><small>Tidak ada harga fallback atau contoh.</small></span></div>
            <div><ShieldCheck size={18} /><span><strong>HPP historis terkunci</strong><small>Harga master baru tidak mengubah transaksi lama.</small></span></div>
          </div>
        </Card>

        <Card className="golive-migration-card" title="Status Sistem Inti" description="Status teknis hanya dibaca, tidak mengubah schema.">
          <div className="golive-migration-list">
            {Object.entries(health.migrations || {}).map(([key, ready]) => (
              <div key={key} className={ready ? "is-ready" : "is-pending"}>
                {ready ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                <span>{migrationLabel(key)}</span>
                <Badge tone={ready ? "success" : "warning"}>{ready ? "Aktif" : "Belum"}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
