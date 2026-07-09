import { useEffect, useMemo, useState } from "react";
import { getArchiveUniversalDetail } from "../../lib/api/actions";
import { openFocusRoute } from "../../lib/navigation/focusRouter";
import UniversalTransactionDetailModal from "../archive/UniversalTransactionDetailModal";
import {
  buildFallbackDetail,
  isAuthRequired,
  normalizeUniversalDetail,
  safeText,
} from "../../lib/archive/universalDetail";

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
      source: options.source || "frontend_part_5t_universal_detail_modal",
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

    setDetail(
      normalizeUniversalDetail(result.data, {
        sourceId: cleanId,
        sourceModule: cleanModule,
      })
    );
    setLoading(false);
  }

  useEffect(() => {
    if (!focusKey || !focusId || !session?.sessionToken) return;
    if (lastAutoKey === focusKey) return;

    setLastAutoKey(focusKey);
    loadDetail(focusId, sourceModule, { source: "frontend_part_5t_auto_focus_open" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, focusId, sourceModule, session?.sessionToken]);

  function closeModal() {
    setOpen(false);
    setLoading(false);
    setDetail(null);
  }

  const displayId = safeText(detail?.main?.source_id || activeId, "");
  const displayModule = safeText(detail?.main?.source_module || activeModule || sourceModule, "ARSIP");

  function openArchivePage() {
    openFocusRoute({
      pageKey: "arsip-digital",
      focusId: displayId || activeId,
      searchQuery: displayId || activeId,
      sourceModule: displayModule,
    });
  }

  return (
    <UniversalTransactionDetailModal
      open={open}
      loading={loading}
      detail={detail}
      activeId={activeId}
      activeModule={activeModule || sourceModule}
      onClose={closeModal}
      onRefresh={() => loadDetail(displayId || activeId, displayModule, { source: "frontend_part_5t_manual_refresh" })}
      onOpenArchive={openArchivePage}
      onOpenId={(nextId, nextModule) => loadDetail(nextId, nextModule || "", { source: "frontend_part_5t_related_id_click" })}
    />
  );
}
