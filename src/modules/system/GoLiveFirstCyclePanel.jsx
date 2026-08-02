import { useEffect, useMemo, useState } from "react";
import {
  completeGoLiveFirstCycle,
  getGoLiveCycleBootstrap,
  startGoLiveFirstCycle,
} from "../../lib/api/actions";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import StatCard from "../../components/ui/StatCard";
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

  const columns = [
    {
      key: "location_name",
      label: "Lokasi",
      render: (row) => (
        <div>
          <strong>{text(row.location_name)}</strong>
          <div className="da-muted">{text(row.location_code)} · {text(row.location_type)}</div>
        </div>
      ),
    },
    {
      key: "gate",
      label: "Gerbang",
      render: (row) => (
        <Badge tone={row.gate?.ready ? "success" : "danger"}>
          {row.gate?.ready ? "Siap" : `${asArray(row.gate?.blockers).length} blocker`}
        </Badge>
      ),
    },
    {
      key: "cycle_status",
      label: "Siklus",
      render: (row) => <Badge tone={statusTone(row.cycle_status)}>{statusLabel(row.cycle_status)}</Badge>,
    },
    {
      key: "evidence",
      label: "Bukti Live",
      render: (row) => {
        const applicable = asArray(row.evidence?.events).filter((item) => item.applicable);
        const passed = applicable.filter((item) => item.ready).length;
        return <strong>{passed} / {applicable.length}</strong>;
      },
    },
    {
      key: "action",
      label: "Aksi",
      render: (row) => (
        <Button variant="secondary" onClick={() => setSelectedId(row.location_id)}>Lihat</Button>
      ),
    },
  ];

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

  return (
    <Card
      title="Gerbang Operasional & Siklus Live Pertama"
      description="Start hanya membuka periode pembuktian. Order, uang/piutang, closing, arsip, audit, dan setoran harus berasal dari transaksi nyata."
      action={(
        <Button variant="secondary" onClick={load} disabled={loading || busy}>
          {loading ? "Membaca..." : "Refresh Gate"}
        </Button>
      )}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Badge tone={health.ready ? "success" : "danger"}>Migration 025 {health.ready ? "Aktif" : "Belum Siap"}</Badge>
        <Badge tone={globalGate.health_ready ? "success" : "danger"}>Health {num(globalGate.health_score)} / 100</Badge>
        <Badge tone={globalGate.backup_ready ? "success" : "danger"}>Backup 24 Jam {globalGate.backup_ready ? "Siap" : "Belum"}</Badge>
        <Badge tone="default">Tanpa Transaksi Contoh</Badge>
      </div>

      {error ? <div className="da-alert da-alert-danger" style={{ marginBottom: 12 }}>{error}</div> : null}
      {success ? <div className="da-alert da-alert-success" style={{ marginBottom: 12 }}>{success}</div> : null}

      <div className="da-stat-grid" style={{ marginBottom: 14 }}>
        <StatCard label="Gate Siap" value={summary.gate_ready_count || 0} description="Lokasi yang boleh memulai siklus." tone="success" />
        <StatCard label="Sedang Berjalan" value={summary.in_progress_count || 0} description="Menunggu bukti transaksi nyata." tone="warning" />
        <StatCard label="Sudah GREEN" value={summary.green_count || 0} description="Siklus pertama sudah dikunci." tone="success" />
        <StatCard label="Masih Diblokir" value={summary.blocked_count || 0} description="Selesaikan opening data dari modul sumber." tone="danger" />
      </div>

      <DataTable columns={columns} rows={locations} getRowKey={(row) => row.location_id} />

      {selected ? (
        <div className="da-soft-panel" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong>{selected.location_name}</strong>
              <div className="da-muted">{selected.location_code} · {selected.location_type}</div>
            </div>
            <Badge tone={statusTone(selected.cycle_status)}>{statusLabel(selected.cycle_status)}</Badge>
          </div>

          <div style={{ marginTop: 14 }}>
            <strong>Gerbang sebelum mulai</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, marginTop: 8 }}>
              {asArray(selected.gate?.checks).map((check) => (
                <button
                  key={check.code}
                  type="button"
                  className="da-soft-panel"
                  onClick={() => check.page_key && openFocusRoute({ pageKey: check.page_key })}
                  style={{ textAlign: "left", cursor: check.page_key ? "pointer" : "default", border: "1px solid var(--da-line, #e5e7eb)" }}
                >
                  <Badge tone={check.ready ? "success" : "danger"}>{check.ready ? "Siap" : "Belum"}</Badge>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{check.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <strong>Bukti setelah siklus dimulai</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8, marginTop: 8 }}>
              {asArray(selected.evidence?.events).map((event) => (
                <div key={event.code} className="da-soft-panel">
                  <Badge tone={statusTone(event.status)}>{statusLabel(event.status)}</Badge>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{event.label}</div>
                  {event.source_id ? <div className="da-muted" style={{ marginTop: 4 }}>{event.source_id}</div> : null}
                </div>
              ))}
            </div>
          </div>

          {!selected.gate?.ready && asArray(selected.gate?.blockers).length ? (
            <div className="da-alert da-alert-warning" style={{ marginTop: 14 }}>
              <strong>Belum bisa dimulai:</strong>
              <div style={{ marginTop: 6 }}>{asArray(selected.gate.blockers).join(" · ")}</div>
              {selected.next_page_key ? (
                <Button
                  variant="secondary"
                  onClick={() => openFocusRoute({ pageKey: selected.next_page_key })}
                >
                  Buka {selected.next_step_label || "Modul Sumber"}
                </Button>
              ) : null}
            </div>
          ) : null}

          {selected.can_start ? (
            <div style={{ marginTop: 14 }}>
              <strong>Mulai siklus live pertama</strong>
              <div className="da-muted">Tidak membuat order atau nominal contoh. Setelah mulai, jalankan transaksi nyata dari Kasir.</div>
              <label className="da-field" style={{ marginTop: 10 }}>
                <span>Alasan / catatan pembukaan</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Contoh: Opening data sudah sesuai STO dan siap menjalankan transaksi nyata." />
              </label>
              <label className="da-field">
                <span>Ketik persis: {selected.start_confirmation}</span>
                <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
              </label>
              <Button onClick={() => runWrite("start")} disabled={busy}>Mulai Siklus Live</Button>
            </div>
          ) : null}

          {selected.cycle_status === "IN_PROGRESS" ? (
            <div style={{ marginTop: 14 }}>
              <strong>Cycle ID: {text(selected.cycle?.cycle_id)}</strong>
              <div className="da-muted">Mulai {text(selected.cycle?.started_at)}. Refresh Gate setelah transaksi nyata selesai.</div>
              {!selected.evidence?.complete ? (
                <div className="da-alert da-alert-warning" style={{ marginTop: 10 }}>
                  Masih menunggu: {asArray(selected.evidence?.blockers).join(" · ")}
                </div>
              ) : (
                <div className="da-alert da-alert-success" style={{ marginTop: 10 }}>
                  Semua bukti lengkap. Siklus dapat dikunci GREEN.
                </div>
              )}
              <label className="da-field" style={{ marginTop: 10 }}>
                <span>Catatan penyelesaian</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Catatan hasil transaksi, closing, dan setoran pertama." />
              </label>
              <label className="da-field">
                <span>Ketik persis: {selected.complete_confirmation}</span>
                <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
              </label>
              <Button onClick={() => runWrite("complete")} disabled={busy || !selected.can_complete}>
                Kunci Siklus GREEN
              </Button>
            </div>
          ) : null}

          {selected.cycle_status === "GREEN" ? (
            <div className="da-alert da-alert-success" style={{ marginTop: 14 }}>
              Siklus live pertama lokasi ini sudah GREEN. Transaksi berikutnya berjalan sebagai operasional harian biasa.
            </div>
          ) : null}
        </div>
      ) : null}

      {asArray(data?.recent_cycles).length ? (
        <div style={{ marginTop: 16 }}>
          <strong>Riwayat Siklus Live</strong>
          <div style={{ marginTop: 8 }}>
            <DataTable columns={recentColumns} rows={asArray(data.recent_cycles)} getRowKey={(row) => row.cycle_id} />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
