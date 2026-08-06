import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  completeGoLiveFirstCycle,
  getGoLiveCycleBootstrap,
  startGoLiveFirstCycle,
} from "../../lib/api/actions";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import { openFocusRoute } from "../../lib/navigation/focusRouter";

const asArray = (value) => (Array.isArray(value) ? value : []);
const text = (value, fallback = "-") => String(value || "").trim() || fallback;
const num = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isAuthRequired = (result) => {
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || (message.includes("SESSION") && message.includes("TIDAK AKTIF"));
};

const statusTone = (status) => {
  const key = String(status || "").toUpperCase();
  if (key === "GREEN" || key === "PASS" || key === "READY") return "success";
  if (key === "IN_PROGRESS" || key === "WAITING") return "warning";
  if (key === "NOT_APPLICABLE") return "default";
  return "danger";
};

const statusLabel = (status) => {
  const labels = {
    NOT_STARTED: "Belum Dimulai",
    IN_PROGRESS: "Berjalan",
    GREEN: "GREEN",
    HOLD: "Ditahan",
    PASS: "Selesai",
    WAITING: "Menunggu",
    NOT_APPLICABLE: "Tidak Wajib",
  };
  return labels[String(status || "").toUpperCase()] || text(status);
};

export default function GoLiveFirstCyclePanel({ session, onSessionExpired, onChanged }) {
  const token = session?.sessionToken || "";
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const locations = useMemo(() => asArray(data?.locations), [data]);
  const selected = useMemo(
    () => locations.find((row) => row.location_id === selectedId) || locations[0] || null,
    [locations, selectedId]
  );
  const summary = data?.summary || {};
  const globalGate = data?.global_gate || {};
  const health = data?.health || {};

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getGoLiveCycleBootstrap(token, {});
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setData(null);
        setError(result?.message || "Go-Live Gate belum dapat dibaca.");
        return;
      }
      const next = result.data || {};
      setData(next);
      const rows = asArray(next.locations);
      if (rows.length && !rows.some((row) => row.location_id === selectedId)) {
        setSelectedId(rows[0].location_id);
      }
    } catch (err) {
      setData(null);
      setError(err?.message || "Go-Live Gate belum dapat dibaca.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    setReason("");
    setConfirmation("");
  }, [selectedId, selected?.cycle_status]);

  const runWrite = async (mode) => {
    if (!selected || busy) return;
    const isStart = mode === "start";
    const expected = isStart ? selected.start_confirmation : selected.complete_confirmation;
    if (confirmation.trim().toUpperCase() !== String(expected || "").toUpperCase()) {
      setError(`Ketik persis: ${expected}`);
      return;
    }
    if (!reason.trim()) {
      setError(isStart ? "Alasan mulai live wajib diisi." : "Catatan penyelesaian wajib diisi.");
      return;
    }

    const ok = window.confirm(
      isStart
        ? `Mulai siklus live pertama untuk ${selected.location_name}? Sistem tidak membuat transaksi contoh.`
        : `Kunci siklus ${selected.location_name} sebagai GREEN berdasarkan bukti transaksi hidup?`
    );
    if (!ok) return;

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = isStart
        ? await startGoLiveFirstCycle(token, {
            location_id: selected.location_id,
            reason: reason.trim(),
            confirmation: confirmation.trim(),
          })
        : await completeGoLiveFirstCycle(token, {
            cycle_id: selected.cycle?.cycle_id,
            reason: reason.trim(),
            confirmation: confirmation.trim(),
          });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        const blockers = asArray(result?.error?.details?.blockers);
        setError(
          blockers.length
            ? `${result?.message || "Tindakan ditolak."} ${blockers.join(" · ")}`
            : result?.message || "Tindakan Go-Live belum berhasil."
        );
        return;
      }
      setSuccess(result?.message || "Status Go-Live berhasil diperbarui.");
      setReason("");
      setConfirmation("");
      await load();
      onChanged?.();
    } catch (err) {
      setError(err?.message || "Tindakan Go-Live belum berhasil.");
    } finally {
      setBusy(false);
    }
  };

  const recentColumns = [
    { key: "cycle_date", label: "Tanggal" },
    { key: "cycle_no", label: "Cycle ID" },
    {
      key: "location_name",
      label: "Lokasi",
      render: (row) => `${text(row.location_name)} · ${text(row.location_code)}`,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>,
    },
    { key: "started_at", label: "Mulai" },
    { key: "completed_at", label: "Selesai" },
  ];

  const gateChecks = asArray(selected?.gate?.checks);
  const evidenceEvents = asArray(selected?.evidence?.events);
  const applicableEvidence = evidenceEvents.filter((item) => item.applicable);
  const passedEvidence = applicableEvidence.filter((item) => item.ready).length;

  return (
    <Card
      className="golive-cycle-card"
      title="Gerbang Operasional & Siklus Pertama"
      description="Buka siklus hanya setelah opening data siap. Bukti order, uang/piutang, closing, arsip, audit, dan setoran harus berasal dari transaksi nyata."
      action={(
        <Button variant="secondary" onClick={load} disabled={loading || busy}>
          <RefreshCw size={15} /> {loading ? "Membaca..." : "Refresh Gate"}
        </Button>
      )}
    >
      <div className="golive-cycle-health">
        <div className={health.ready ? "is-ready" : "is-pending"}>
          <ShieldCheck size={17} /><span>Migration 025</span><strong>{health.ready ? "Aktif" : "Belum"}</strong>
        </div>
        <div className={globalGate.health_ready ? "is-ready" : "is-pending"}>
          <ShieldCheck size={17} /><span>Data Health</span><strong>{num(globalGate.health_score)}/100</strong>
        </div>
        <div className={globalGate.backup_ready ? "is-ready" : "is-pending"}>
          <ShieldCheck size={17} /><span>Backup 24 Jam</span><strong>{globalGate.backup_ready ? "Siap" : "Belum"}</strong>
        </div>
        <div className="is-neutral">
          <ShieldCheck size={17} /><span>Transaksi Contoh</span><strong>Tidak Ada</strong>
        </div>
      </div>

      {error ? <div className="da-alert da-alert-danger golive-cycle-alert">{error}</div> : null}
      {success ? <div className="da-alert da-alert-success golive-cycle-alert">{success}</div> : null}

      <div className="golive-cycle-summary">
        <div className="is-ready"><span>Gate Siap</span><strong>{summary.gate_ready_count || 0}</strong><small>Boleh memulai siklus</small></div>
        <div className="is-warning"><span>Sedang Berjalan</span><strong>{summary.in_progress_count || 0}</strong><small>Menunggu bukti nyata</small></div>
        <div className="is-ready"><span>Sudah GREEN</span><strong>{summary.green_count || 0}</strong><small>Siklus sudah dikunci</small></div>
        <div className="is-danger"><span>Masih Diblokir</span><strong>{summary.blocked_count || 0}</strong><small>Opening data belum lengkap</small></div>
      </div>

      <div className="golive-cycle-tabs" role="tablist" aria-label="Pilih lokasi Go-Live">
        {locations.map((row) => {
          const active = selected?.location_id === row.location_id;
          const blockers = asArray(row.gate?.blockers).length;
          return (
            <button
              key={row.location_id}
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? "is-active" : ""}
              onClick={() => setSelectedId(row.location_id)}
            >
              <span><strong>{text(row.location_name)}</strong><small>{text(row.location_code)}</small></span>
              <Badge tone={row.gate?.ready ? "success" : "danger"}>{row.gate?.ready ? "Siap" : `${blockers} blocker`}</Badge>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="golive-cycle-workspace">
          <div className="golive-cycle-workspace-head">
            <div>
              <span className="golive-eyebrow">Lokasi Terpilih</span>
              <h3>{selected.location_name}</h3>
              <p>{selected.location_code} · {selected.location_type}</p>
            </div>
            <div className="golive-cycle-status">
              <Badge tone={statusTone(selected.cycle_status)}>{statusLabel(selected.cycle_status)}</Badge>
              <span>{passedEvidence}/{applicableEvidence.length} bukti live</span>
            </div>
          </div>

          <div className="golive-cycle-columns">
            <section className="golive-cycle-column">
              <div className="golive-cycle-column-head"><span>1</span><div><strong>Gerbang sebelum mulai</strong><small>Semua poin wajib siap.</small></div></div>
              <div className="golive-cycle-check-list">
                {gateChecks.map((check) => (
                  <button key={check.code} type="button" onClick={() => check.page_key && openFocusRoute({ pageKey: check.page_key })} disabled={!check.page_key}>
                    {check.ready ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    <span><strong>{check.label}</strong><small>{check.ready ? "Sudah siap" : "Perlu dilengkapi"}</small></span>
                    {check.page_key ? <ChevronRight size={17} /> : null}
                  </button>
                ))}
              </div>
            </section>

            <section className="golive-cycle-column">
              <div className="golive-cycle-column-head"><span>2</span><div><strong>Bukti transaksi pertama</strong><small>Muncul setelah siklus dimulai.</small></div></div>
              <div className="golive-cycle-check-list">
                {evidenceEvents.map((event) => (
                  <div key={event.code} className={event.ready ? "is-ready" : event.applicable ? "is-pending" : "is-neutral"}>
                    {event.ready ? <CheckCircle2 size={18} /> : event.applicable ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
                    <span><strong>{event.label}</strong><small>{event.source_id || statusLabel(event.status)}</small></span>
                    <Badge tone={statusTone(event.status)}>{statusLabel(event.status)}</Badge>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {!selected.gate?.ready && asArray(selected.gate?.blockers).length ? (
            <div className="golive-cycle-blocker">
              <AlertTriangle size={21} />
              <div><strong>Belum bisa dimulai</strong><p>{asArray(selected.gate.blockers).join(" · ")}</p></div>
              {selected.next_page_key ? (
                <Button variant="secondary" onClick={() => openFocusRoute({ pageKey: selected.next_page_key })}>
                  Buka {selected.next_step_label || "Modul Sumber"}
                </Button>
              ) : null}
            </div>
          ) : null}

          {selected.can_start ? (
            <div className="golive-cycle-form">
              <div className="golive-cycle-form-head"><PlayCircle size={21} /><div><strong>Mulai siklus live pertama</strong><small>Tidak membuat transaksi atau nominal contoh.</small></div></div>
              <div className="golive-cycle-form-grid">
                <label className="da-field golive-cycle-form-note">
                  <span>Alasan / catatan pembukaan</span>
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Contoh: Opening data sudah sesuai STO dan siap menjalankan transaksi nyata." />
                </label>
                <label className="da-field">
                  <span>Ketik persis: {selected.start_confirmation}</span>
                  <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
                </label>
              </div>
              <div className="golive-cycle-form-actions"><Button onClick={() => runWrite("start")} disabled={busy}>Mulai Siklus Live</Button></div>
            </div>
          ) : null}

          {selected.cycle_status === "IN_PROGRESS" ? (
            <div className="golive-cycle-form">
              <div className="golive-cycle-form-head"><PlayCircle size={21} /><div><strong>Cycle ID: {text(selected.cycle?.cycle_id)}</strong><small>Mulai {text(selected.cycle?.started_at)}</small></div></div>
              {!selected.evidence?.complete ? (
                <div className="da-alert da-alert-warning">Masih menunggu: {asArray(selected.evidence?.blockers).join(" · ")}</div>
              ) : (
                <div className="da-alert da-alert-success">Semua bukti lengkap. Siklus dapat dikunci GREEN.</div>
              )}
              <div className="golive-cycle-form-grid">
                <label className="da-field golive-cycle-form-note">
                  <span>Catatan penyelesaian</span>
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Catatan hasil transaksi, closing, dan setoran pertama." />
                </label>
                <label className="da-field">
                  <span>Ketik persis: {selected.complete_confirmation}</span>
                  <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
                </label>
              </div>
              <div className="golive-cycle-form-actions"><Button onClick={() => runWrite("complete")} disabled={busy || !selected.can_complete}>Kunci Siklus GREEN</Button></div>
            </div>
          ) : null}

          {selected.cycle_status === "GREEN" ? (
            <div className="golive-ready-box"><CheckCircle2 size={20} /><span>Siklus live pertama lokasi ini sudah GREEN. Operasional berikutnya berjalan normal.</span></div>
          ) : null}
        </div>
      ) : null}

      {asArray(data?.recent_cycles).length ? (
        <details className="golive-cycle-history">
          <summary>Riwayat Siklus Live ({asArray(data.recent_cycles).length})</summary>
          <div><DataTable columns={recentColumns} rows={asArray(data.recent_cycles)} getRowKey={(row) => row.cycle_id} /></div>
        </details>
      ) : null}
    </Card>
  );
}
