import { useEffect, useMemo, useState } from "react";
import { getArchiveUniversalDetail } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import DataTable from "../ui/DataTable";
import Modal from "../ui/Modal";
import { openFocusRoute } from "../../lib/navigation/focusRouter";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.error?.code || result?.code || "").toUpperCase();

  return (
    code.includes("AUTH_REQUIRED") ||
    message.includes("AUTH_REQUIRED") ||
    (message.includes("SESSION") && message.includes("TIDAK AKTIF"))
  );
}

function moduleLabel(value) {
  return safeText(String(value || "").replaceAll("_", " "));
}

function getToneByStatus(status) {
  const text = String(status || "").toUpperCase();
  if (
    text.includes("AMAN") ||
    text.includes("LUNAS") ||
    text.includes("POSTED") ||
    text.includes("CLOSED") ||
    text.includes("APPROVED") ||
    text.includes("SELESAI") ||
    text.includes("TERCATAT")
  ) {
    return "success";
  }

  if (
    text.includes("BELUM") ||
    text.includes("OPEN") ||
    text.includes("PARTIAL") ||
    text.includes("DRAFT") ||
    text.includes("PENDING") ||
    text.includes("PERLU")
  ) {
    return "warning";
  }

  if (
    text.includes("VOID") ||
    text.includes("CANCEL") ||
    text.includes("BATAL") ||
    text.includes("REJECT") ||
    text.includes("ERROR")
  ) {
    return "danger";
  }

  return "default";
}

function RawFields({ fields = {} }) {
  const entries = Object.entries(fields || {}).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    return String(value).trim() !== "";
  });

  if (!entries.length) {
    return <p className="da-muted">Belum ada field mentah yang terbaca.</p>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
      {entries.slice(0, 80).map(([key, value]) => (
        <div key={key} className="da-card" style={{ padding: 12, boxShadow: "none" }}>
          <div className="da-mini-title">{key}</div>
          <div style={{ marginTop: 6, fontWeight: 750, overflowWrap: "anywhere" }}>{String(value)}</div>
        </div>
      ))}
    </div>
  );
}

function buildFallbackDetail({ sourceId, sourceModule, message }) {
  return {
    main: {
      source_id: sourceId,
      source_module: sourceModule || "ARSIP",
      title: message || "Detail transaksi belum ditemukan di arsip universal.",
      description: message || "Detail transaksi belum ditemukan di arsip universal.",
      amount: 0,
      status: "Perlu Dicek",
      raw: {
        source_id: sourceId,
        source_module: sourceModule || "",
        note: "Cek apakah ID sudah masuk Arsip Digital, source_id, atau search index.",
      },
    },
    timeline: [],
    relation_ids: sourceId ? [sourceId] : [],
    audit_trail: [],
  };
}

export default function FocusDetailAutoOpen({ session, focusRequest, onSessionExpired }) {
  const focusId = safeText(focusRequest?.focusId || focusRequest?.searchQuery, "");
  const sourceModule = safeText(focusRequest?.sourceModule, "");

  const focusKey = useMemo(() => {
    if (!focusId) return "";
    return `${focusId}::${sourceModule}::${focusRequest?.createdAt || ""}`;
  }, [focusId, sourceModule, focusRequest?.createdAt]);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [activeId, setActiveId] = useState("");
  const [activeModule, setActiveModule] = useState("");
  const [lastAutoKey, setLastAutoKey] = useState("");

  const main = detail?.main || {};
  const timeline = asArray(detail?.timeline || detail?.related_records);
  const audit = asArray(detail?.audit_trail);
  const relationIds = asArray(detail?.relation_ids);

  async function loadDetail(sourceId, moduleName = "", options = {}) {
    const cleanId = safeText(sourceId, "");
    const cleanModule = safeText(moduleName, "");
    if (!cleanId || !session?.sessionToken) return;

    setOpen(true);
    setLoading(true);
    setDetail(null);
    setActiveId(cleanId);
    setActiveModule(cleanModule);

    const result = await getArchiveUniversalDetail(session.sessionToken, {
      source: options.source || "frontend_part_5s_auto_focus_detail",
      source_id: cleanId,
      source_module: cleanModule,
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setDetail(
        buildFallbackDetail({
          sourceId: cleanId,
          sourceModule: cleanModule,
          message: result.message || "Detail transaksi belum ditemukan di arsip universal.",
        })
      );
      setLoading(false);
      return;
    }

    setDetail(result.data || buildFallbackDetail({ sourceId: cleanId, sourceModule: cleanModule }));
    setLoading(false);
  }

  useEffect(() => {
    if (!focusKey || !focusId || !session?.sessionToken) return;
    if (lastAutoKey === focusKey) return;

    setLastAutoKey(focusKey);
    loadDetail(focusId, sourceModule, { source: "frontend_part_5s_auto_focus_open" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, focusId, sourceModule, session?.sessionToken]);

  if (!open) return null;

  const displayId = safeText(main.source_id || main.id || activeId);
  const displayModule = moduleLabel(main.source_label || main.source_module || activeModule || sourceModule || "Arsip Digital");

  function closeModal() {
    setOpen(false);
    setLoading(false);
    setDetail(null);
  }

  function openArchivePage() {
    openFocusRoute({
      pageKey: "arsip-digital",
      focusId: displayId,
      searchQuery: displayId,
      sourceModule: main.source_module || activeModule || sourceModule || "ARSIP",
    });
  }

  return (
    <Modal
      open={open}
      title={loading ? "Membuka detail transaksi..." : `Detail Fokus ${displayId}`}
      subtitle={loading ? "Membaca Arsip Digital dan rantai ID terkait." : displayModule}
      onClose={closeModal}
    >
      {loading ? (
        <Card>
          <Badge tone="warning">Auto Open Detail</Badge>
          <p className="da-muted" style={{ marginTop: 12 }}>
            Sistem sedang membuka ID fokus <strong>{safeText(activeId)}</strong>. Ini hanya baca data, tidak mengubah transaksi.
          </p>
        </Card>
      ) : (
        <>
          <div className="da-modal-summary">
            <div>
              <div className="da-mini-title">Transaksi Utama</div>
              <div className="da-big-text">{safeText(main.title || main.description || displayId)}</div>
              <p className="da-muted">
                {displayId} · {formatDate(main.date || main.created_at)}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <Badge tone={getToneByStatus(main.status)}>{safeText(main.status, "Tercatat")}</Badge>
              <div style={{ marginTop: 12, fontWeight: 900 }}>{formatRupiah(main.amount || 0)}</div>
            </div>
          </div>

          <div className="da-modal-note">
            Auto Open Detail membaca ID fokus dari URL / Action Hub / Arsip, lalu membuka rantai transaksi secara read-only. Perbaikan tetap dilakukan dari modul sumber, bukan dari modal ini.
          </div>

          <div className="da-form-actions" style={{ justifyContent: "flex-start", marginTop: 14 }}>
            <Button type="button" variant="secondary" onClick={() => loadDetail(displayId, main.source_module || activeModule || sourceModule, { source: "frontend_part_5s_manual_refresh" })}>
              Refresh Detail
            </Button>
            <Button type="button" variant="secondary" onClick={openArchivePage}>
              Buka di Arsip Digital
            </Button>
            <Button type="button" variant="secondary" onClick={closeModal}>
              Tutup Detail
            </Button>
          </div>

          <Card>
            <div className="da-mini-title">ID yang Terhubung</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {relationIds.length ? (
                relationIds.slice(0, 40).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="da-button da-button-ghost"
                    style={{ padding: "7px 10px", fontSize: 12 }}
                    onClick={() => loadDetail(id, "", { source: "frontend_part_5s_related_id_click" })}
                  >
                    {id}
                  </button>
                ))
              ) : (
                <span className="da-muted">Belum ada ID terkait.</span>
              )}
            </div>
          </Card>

          <Card>
            <div className="da-mini-title">Timeline / Benang Merah</div>
            <div style={{ marginTop: 12 }}>
              <DataTable
                columns={[
                  { key: "date", label: "Tanggal", render: (row) => formatDate(row.date || row.created_at) },
                  { key: "source_module", label: "Modul", render: (row) => moduleLabel(row.source_label || row.source_module) },
                  { key: "source_id", label: "ID", render: (row) => <strong>{safeText(row.source_id)}</strong> },
                  { key: "title", label: "Keterangan", render: (row) => safeText(row.title || row.description) },
                  { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
                  { key: "status", label: "Status", render: (row) => <Badge tone={getToneByStatus(row.status)}>{safeText(row.status, "Tercatat")}</Badge> },
                ]}
                rows={timeline}
                getRowKey={(row, index) => `${row.source_module || "MOD"}-${row.source_id || index}-${index}`}
                onRowClick={(row) => loadDetail(row.source_id, row.source_module, { source: "frontend_part_5s_timeline_click" })}
              />
            </div>
          </Card>

          <Card>
            <div className="da-mini-title">Field Transaksi Mentah</div>
            <div style={{ marginTop: 12 }}>
              <RawFields fields={main.raw || main.record || {}} />
            </div>
          </Card>

          <Card>
            <div className="da-mini-title">Audit / Jejak Edit</div>
            <div style={{ marginTop: 12 }}>
              <DataTable
                columns={[
                  { key: "created_at", label: "Waktu", render: (row) => formatDate(row.created_at || row.timestamp || row.date) },
                  { key: "action", label: "Aksi", render: (row) => safeText(row.action || row.event || row.activity) },
                  { key: "user", label: "User", render: (row) => safeText(row.user_name || row.user || row.created_by) },
                  { key: "note", label: "Catatan", render: (row) => safeText(row.note || row.description || row.message) },
                ]}
                rows={audit}
                getRowKey={(row, index) => `${row.audit_id || row.id || index}`}
              />
            </div>
          </Card>
        </>
      )}
    </Modal>
  );
}
