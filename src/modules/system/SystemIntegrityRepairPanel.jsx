import { useEffect, useMemo, useState } from "react";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";
import {
  applySystemIntegritySafeBatch,
  getSystemIntegrityRepairBootstrap,
  scanSystemIntegrityCases,
  systemIntegrityRepairHealth,
} from "../../lib/api/actions";

function authError(result) {
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  return ["AUTH_REQUIRED", "UNAUTHORIZED", "SESSION_EXPIRED", "AUTH_SESSION_INVALID"].includes(code);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function n(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function operationId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
}

function caseTone(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "RESOLVED" || normalized === "AUTO_CLEARED") return "success";
  if (normalized === "OPEN") return "warning";
  return "danger";
}

function labelOf(row) {
  if (row.check_code === "RAW_MATERIAL_PRODUCT_REFERENCE") {
    return "Histori bahan baku RAW-AYAM";
  }
  if (row.check_code === "INACTIVE_LEGACY_PAYROLL_DRAFT") {
    return "Draft payroll legacy Rp0";
  }
  return row.label || row.check_code || "Temuan integritas";
}

function entitySummary(row) {
  const snapshot = parseJson(row.before_snapshot_json || row.snapshot);
  if (row.check_code === "RAW_MATERIAL_PRODUCT_REFERENCE") {
    return `${snapshot.item_name || snapshot.product_code || "RAW-AYAM"} · ${snapshot.qty || 0} ${snapshot.unit || ""} · ${snapshot.source_module || "-"}`;
  }
  if (row.check_code === "INACTIVE_LEGACY_PAYROLL_DRAFT") {
    return `${snapshot.employee_name || "Karyawan"} · ${snapshot.period || "-"} · THP Rp${n(snapshot.net_pay).toLocaleString("id-ID")}`;
  }
  return row.entity_id || "-";
}

export default function SystemIntegrityRepairPanel({
  sessionToken,
  onSessionExpired,
  onRepairComplete,
}) {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState({});
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState(
    "Klasifikasi histori bahan baku sah dan arsip draft payroll legacy Rp0 setelah audit Data Health."
  );
  const [detail, setDetail] = useState(null);

  const health = data.health || {};
  const summary = data.summary || {};
  const preview = asArray(data.preview);
  const cases = asArray(data.cases);
  const actions = asArray(data.actions);
  const guards = data.guards || {};
  const openCases = useMemo(
    () => cases.filter((row) => String(row.case_status || "").toUpperCase() === "OPEN"),
    [cases]
  );

  async function load() {
    if (!sessionToken) return;
    setLoading(true);
    setError("");
    try {
      const [healthResponse, bootstrapResponse] = await Promise.all([
        systemIntegrityRepairHealth(sessionToken, {}),
        getSystemIntegrityRepairBootstrap(sessionToken, {}),
      ]);
      if (authError(healthResponse) || authError(bootstrapResponse)) {
        onSessionExpired?.();
        return;
      }
      if (!healthResponse?.success) {
        throw new Error(healthResponse?.message || "Pusat Perbaikan Data belum siap.");
      }
      if (!bootstrapResponse?.success) {
        throw new Error(bootstrapResponse?.message || "Kasus integritas gagal dibaca.");
      }
      setData(bootstrapResponse.data || {});
    } catch (caught) {
      setError(caught?.message || "Pusat Perbaikan Data gagal dibaca.");
      setData({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  async function scan() {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const opId = operationId("INTEGRITY-SCAN");
      const response = await scanSystemIntegrityCases(sessionToken, {
        notes: "Scan manual Part 6B sebelum perbaikan.",
        operation_id: opId,
        request_id: opId,
        idempotency_key: opId,
      });
      if (authError(response)) {
        onSessionExpired?.();
        return;
      }
      if (!response?.success) {
        throw new Error(response?.message || "Temuan gagal ditarik.");
      }
      setNotice(response.message || "Temuan berhasil ditarik.");
      await load();
    } catch (caught) {
      setError(caught?.message || "Temuan gagal ditarik.");
    } finally {
      setWorking(false);
    }
  }

  async function applyRepair() {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const opId = operationId("INTEGRITY-REPAIR");
      const response = await applySystemIntegritySafeBatch(sessionToken, {
        confirmation,
        reason,
        operation_id: opId,
        request_id: opId,
        idempotency_key: opId,
      });
      if (authError(response)) {
        onSessionExpired?.();
        return;
      }
      if (!response?.success) {
        throw new Error(response?.message || "Perbaikan aman gagal diterapkan.");
      }
      setNotice(response.message || "Perbaikan aman selesai.");
      setConfirmation("");
      await load();
      await onRepairComplete?.();
    } catch (caught) {
      setError(caught?.message || "Perbaikan aman gagal diterapkan.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Part 6B · Owner Only</p>
            <h2>Pusat Perbaikan Data & Integritas</h2>
            <p className="da-muted">
              Tidak menghapus histori. Scan hanya mencatat kasus; repair baru berjalan setelah konfirmasi Owner.
            </p>
          </div>
          <div className="da-actions">
            <Badge tone={health.ready ? "success" : "warning"}>
              {health.ready ? "Repair Center Ready" : "Migration 024 Belum Siap"}
            </Badge>
            <Badge tone="success">No Delete</Badge>
            <Button variant="secondary" onClick={load} disabled={loading || working}>
              Refresh Repair
            </Button>
          </div>
        </div>

        {error ? <div className="da-form-error">{error}</div> : null}
        {notice ? <div className="da-form-success">{notice}</div> : null}

        <div className="da-grid da-grid-3">
          <StatCard label="Preview Temuan" value={n(summary.preview_total)} tone={n(summary.preview_total) ? "warning" : "success"} />
          <StatCard label="Kasus Open" value={n(summary.open_cases)} tone={n(summary.open_cases) ? "warning" : "success"} />
          <StatCard label="Sudah Diselesaikan" value={n(summary.resolved_cases)} tone="success" />
          <StatCard label="Backup 24 Jam" value={guards.backup_ready ? "Siap" : "Belum"} tone={guards.backup_ready ? "success" : "danger"} />
          <StatCard label="Snapshot 24 Jam" value={guards.snapshot_ready ? "Siap" : "Belum"} tone={guards.snapshot_ready ? "success" : "danger"} />
        </div>
      </Card>

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Preview Read-Only</p>
            <h2>Rencana Perbaikan Aman</h2>
            <p className="da-muted">
              Database saat ini diperkirakan memiliki {n(summary.preview_raw_material)} histori RAW-AYAM dan {n(summary.preview_legacy_payroll)} draft payroll legacy Rp0.
            </p>
          </div>
          <Button onClick={scan} disabled={working || loading || !health.ready}>
            {working ? "Memproses..." : "Tarik Temuan Terbaru"}
          </Button>
        </div>

        <div className="da-grid da-grid-2">
          <div className="da-soft-panel">
            <Badge tone="success">Tanpa Ubah Stok</Badge>
            <h3>Histori Bahan Baku RAW-AYAM</h3>
            <p className="da-muted">
              DROP ayam dan opening stock tetap memakai identitas bahan baku. Sistem hanya mencatat bahwa referensinya sah, bukan membuat produk jual baru.
            </p>
          </div>
          <div className="da-soft-panel">
            <Badge tone="warning">Blokir Bayar</Badge>
            <h3>Draft Payroll Legacy Rp0</h3>
            <p className="da-muted">
              Hanya draft V32 bernilai nol milik karyawan nonaktif/ending yang diubah menjadi ARCHIVED_LEGACY dan NOT_PAYABLE_LEGACY.
            </p>
          </div>
        </div>

        <div className="da-table-wrap">
          <table className="da-table">
            <thead>
              <tr>
                <th>Temuan</th>
                <th>Entity ID</th>
                <th>Ringkasan</th>
                <th>Aman</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {preview.length ? preview.map((row) => (
                <tr key={`${row.check_code}-${row.entity_id}`}>
                  <td><strong>{labelOf(row)}</strong><div className="da-muted">{row.check_code}</div></td>
                  <td>{row.entity_id}</td>
                  <td>{entitySummary(row)}</td>
                  <td><Badge tone={row?.eligibility?.safe ? "success" : "danger"}>{row?.eligibility?.safe ? "Safe" : "Manual Review"}</Badge></td>
                  <td><Button variant="secondary" onClick={() => setDetail(row)}>Lihat Detail</Button></td>
                </tr>
              )) : <tr><td colSpan="5">Tidak ada preview temuan pada sumber data saat ini.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Kasus Tercatat</p>
            <h2>Daftar Integrity Case</h2>
            <p className="da-muted">Kasus harus ditarik terlebih dahulu sebelum repair dapat diterapkan.</p>
          </div>
          <Badge tone={openCases.length ? "warning" : "success"}>{openCases.length} Open</Badge>
        </div>

        <div className="da-table-wrap">
          <table className="da-table">
            <thead><tr><th>Case ID</th><th>Temuan</th><th>Entity</th><th>Status</th><th>Klasifikasi</th><th>Aksi</th></tr></thead>
            <tbody>
              {cases.length ? cases.map((row) => (
                <tr key={row.case_id}>
                  <td>{row.case_id}</td>
                  <td><strong>{labelOf(row)}</strong><div className="da-muted">{row.check_code}</div></td>
                  <td>{row.entity_id}</td>
                  <td><Badge tone={caseTone(row.case_status)}>{row.case_status}</Badge></td>
                  <td>{row.classification || "Menunggu tindakan"}</td>
                  <td><Button variant="secondary" onClick={() => setDetail(row)}>Detail</Button></td>
                </tr>
              )) : <tr><td colSpan="6">Belum ada case. Klik Tarik Temuan Terbaru.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Konfirmasi Owner</p>
            <h2>Terapkan Perbaikan Aman</h2>
            <p className="da-muted">
              Sebelum menjalankan repair, simpan backup SQL dan manifest. Nominal, stok, HPP, serta histori closing tidak dihapus.
            </p>
          </div>
          <div className="da-actions">
            <Badge tone={guards.backup_ready ? "success" : "danger"}>Backup {guards.backup_ready ? "Siap" : "Belum"}</Badge>
            <Badge tone={guards.snapshot_ready ? "success" : "danger"}>Snapshot {guards.snapshot_ready ? "Siap" : "Belum"}</Badge>
            <Badge tone="danger">Irreversible Status Update</Badge>
          </div>
        </div>

        <div className="da-form-grid">
          <label className="da-field da-field-full">
            <span>Alasan Perbaikan</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
          </label>
          <label className="da-field da-field-full">
            <span>Ketik persis: RAPIHKAN DATA HEALTH</span>
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="RAPIHKAN DATA HEALTH" />
          </label>
        </div>
        <div className="da-actions">
          <Button
            onClick={applyRepair}
            disabled={working || openCases.length === 0 || confirmation !== "RAPIHKAN DATA HEALTH" || !reason.trim() || !guards.backup_ready || !guards.snapshot_ready}
          >
            {working ? "Merapikan..." : `Terapkan ${openCases.length} Perbaikan Aman`}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="da-section-header">
          <div><p className="da-kicker">Riwayat</p><h2>Tindakan Integrity Cleanup</h2></div>
          <Badge tone="success">Audit & Arsip</Badge>
        </div>
        <div className="da-table-wrap">
          <table className="da-table">
            <thead><tr><th>Waktu</th><th>Action ID</th><th>Case ID</th><th>Tindakan</th><th>Entity</th><th>Arsip</th></tr></thead>
            <tbody>
              {actions.length ? actions.map((row) => (
                <tr key={row.action_id}>
                  <td>{row.created_at}</td><td>{row.action_id}</td><td>{row.case_id}</td><td>{row.action_type}</td><td>{row.entity_id}</td><td>{row.archive_id || "-"}</td>
                </tr>
              )) : <tr><td colSpan="6">Belum ada tindakan repair.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={Boolean(detail)}
        title={detail ? labelOf(detail) : "Detail Temuan"}
        subtitle={detail?.entity_id || ""}
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <div className="da-page-stack">
            <div className="da-grid da-grid-2">
              <div className="da-detail-row"><span>Check Code</span><strong>{detail.check_code}</strong></div>
              <div className="da-detail-row"><span>Status</span><strong>{detail.case_status || detail.source_status || "PREVIEW"}</strong></div>
              <div className="da-detail-row"><span>Entity Table</span><strong>{detail.entity_table}</strong></div>
              <div className="da-detail-row"><span>Entity ID</span><strong>{detail.entity_id}</strong></div>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
              {JSON.stringify(parseJson(detail.before_snapshot_json || detail.snapshot), null, 2)}
            </pre>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
