import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  CalendarDays,
  FileText,
  LogOut,
  MapPin,
  Menu,
  PackageSearch,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
  UsersRound,
  X,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import UniversalTransactionDetailModal from "../components/archive/UniversalTransactionDetailModal";
import { getArchiveUniversalDetail, globalSmartSearch } from "../lib/api/actions";
import { formatRupiah } from "../lib/format/money";
import { formatDate } from "../lib/format/date";

function initials(value = "") {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "DA";
  return parts.slice(0, 2).map((item) => item.charAt(0).toUpperCase()).join("");
}

function todayLabel() {
  try {
    return new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date());
  } catch {
    return "Hari ini";
  }
}

function resultIcon(type) {
  const props = { size: 17, strokeWidth: 1.9 };
  if (type === "customer") return <UserRound {...props} />;
  if (type === "product") return <PackageSearch {...props} />;
  if (type === "supplier") return <Truck {...props} />;
  if (type === "employee") return <UsersRound {...props} />;
  return <FileText {...props} />;
}

function isAuthError(result) {
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  return ["AUTH_REQUIRED", "UNAUTHORIZED", "SESSION_EXPIRED"].includes(code);
}

const GROUP_ORDER = ["customer", "product", "transaction", "supplier", "employee"];
const GROUP_LABELS = {
  customer: "Customer",
  product: "Produk",
  transaction: "Transaksi",
  supplier: "Supplier",
  employee: "Karyawan",
};

export default function Topbar({
  session,
  onLogout,
  onSessionExpired,
  onOpenSidebar,
  onNavigate,
  pageTitle = "Dashboard Owner",
  groupTitle = "ERP Dimsum Aditya",
}) {
  const user = session?.user || {};
  const userName = user.name || user.username || "User";
  const locationName = user.location_name || user.location_id || "Lokasi";
  const roleName = user.role_name || user.role_id || "Role";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [masterDetail, setMasterDetail] = useState(null);
  const [transactionDetail, setTransactionDetail] = useState(null);
  const [transactionLoading, setTransactionLoading] = useState(false);

  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const requestSeq = useRef(0);

  const groupedResults = useMemo(() => {
    const groups = {};
    GROUP_ORDER.forEach((key) => { groups[key] = []; });
    results.forEach((item) => {
      const key = item?.result_type || "transaction";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [results]);

  useEffect(() => {
    const handleGlobalShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };
    const handlePointerDown = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleGlobalShortcut);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalShortcut);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearchLoading(false);
      setSearchError("");
      setActiveIndex(-1);
      return undefined;
    }

    const seq = ++requestSeq.current;
    setSearchLoading(true);
    setSearchError("");
    const timer = window.setTimeout(async () => {
      const result = await globalSmartSearch(session?.sessionToken, { q: term, limit: 10 });
      if (seq !== requestSeq.current) return;
      if (isAuthError(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setResults([]);
        setSearchError(result?.message || "Pencarian belum dapat dibuka.");
        setSearchLoading(false);
        return;
      }
      setResults(Array.isArray(result?.data?.items) ? result.data.items : []);
      setActiveIndex(-1);
      setSearchLoading(false);
    }, 240);

    return () => window.clearTimeout(timer);
  }, [query, session?.sessionToken, onSessionExpired]);

  async function openTransaction(itemOrId, moduleName = "") {
    const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
    const sourceModule = typeof itemOrId === "string" ? moduleName : itemOrId?.source_module;
    if (!id) return;
    setSearchOpen(false);
    setTransactionLoading(true);
    setTransactionDetail({ id, module: sourceModule || "", detail: null });
    const result = await getArchiveUniversalDetail(session?.sessionToken, {
      source_id: id,
      source_module: sourceModule || "",
      detail_mode: "fast",
      timeline_limit: 40,
      relation_limit: 80,
      audit_limit: 25,
    });
    if (isAuthError(result)) {
      onSessionExpired?.();
      return;
    }
    setTransactionDetail({
      id,
      module: sourceModule || "",
      detail: result?.success ? (result.data || {}) : {
        main: { source_id: id, source_module: sourceModule || "ARSIP", title: result?.message || "Detail belum tersedia.", status: "Perlu Dicek", amount: 0 },
        timeline: [], relation_ids: [], audit_trail: [],
      },
    });
    setTransactionLoading(false);
  }

  function handleResult(item) {
    if (!item) return;
    setSearchOpen(false);
    if (item.result_type === "transaction") {
      openTransaction(item);
      return;
    }
    setMasterDetail(item);
  }

  function handleInputKeyDown(event) {
    if (!searchOpen) setSearchOpen(true);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(results.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(-1, current - 1));
    } else if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      handleResult(results[activeIndex]);
    } else if (event.key === "Escape") {
      setSearchOpen(false);
      inputRef.current?.blur();
    }
  }

  function openAllResults() {
    const term = query.trim();
    setSearchOpen(false);
    if (term && typeof window !== "undefined") {
      window.sessionStorage.setItem("da:global-search-query", term);
    }
    onNavigate?.("arsip-digital");
  }

  function openMasterModule(item) {
    setMasterDetail(null);
    if (item?.page_key) onNavigate?.(item.page_key);
  }

  return (
    <>
      <header className="da-topbar da-topbar-v3">
        <div className="da-topbar-left-v3">
          <button type="button" className="da-mobile-menu-btn da-mobile-menu-btn-v3" aria-label="Buka menu" onClick={onOpenSidebar}>
            <Menu size={20} />
          </button>
          <div className="da-topbar-page-v3">
            <span>{groupTitle}</span>
            <strong>{pageTitle}</strong>
          </div>
        </div>

        <div className="da-topbar-tools-v3">
          <div className="da-smart-search-v7" ref={searchRef} data-open={searchOpen ? "true" : "false"}>
            <div className="da-smart-search-field-v7">
              <Search size={16} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={handleInputKeyDown}
                placeholder="Cari customer, produk, transaksi..."
                aria-label="Cari di ERP"
                autoComplete="off"
              />
              {searchLoading ? <Loader2 size={15} className="da-search-spin-v7" /> : query ? (
                <button type="button" className="da-smart-search-clear-v7" onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }} aria-label="Hapus pencarian"><X size={14} /></button>
              ) : <kbd>⌘ K</kbd>}
            </div>

            {searchOpen ? (
              <div className="da-smart-search-dropdown-v7">
                <div className="da-smart-search-mobile-head-v7">
                  <strong>Pencarian Cepat</strong>
                  <button type="button" onClick={() => setSearchOpen(false)}><X size={18} /></button>
                </div>

                {query.trim().length < 2 ? (
                  <div className="da-smart-search-hint-v7">
                    <Search size={20} />
                    <div><strong>Cari apa saja</strong><span>Ketik minimal 2 karakter: customer, produk, supplier, karyawan atau nomor transaksi.</span></div>
                  </div>
                ) : searchError ? (
                  <div className="da-smart-search-state-v7 is-error">{searchError}</div>
                ) : searchLoading && !results.length ? (
                  <div className="da-smart-search-state-v7"><Loader2 size={18} className="da-search-spin-v7" /> Mencari data...</div>
                ) : !results.length ? (
                  <div className="da-smart-search-hint-v7">
                    <Search size={20} />
                    <div><strong>Tidak ada hasil</strong><span>Coba nama lain, kode, nomor HP atau ID transaksi.</span></div>
                  </div>
                ) : (
                  <div className="da-smart-search-results-v7">
                    {GROUP_ORDER.map((groupKey) => {
                      const rows = groupedResults[groupKey] || [];
                      if (!rows.length) return null;
                      return (
                        <section key={groupKey} className="da-smart-search-group-v7">
                          <div className="da-smart-search-group-title-v7"><span>{GROUP_LABELS[groupKey] || groupKey}</span><b>{rows.length}</b></div>
                          {rows.map((item) => {
                            const absoluteIndex = results.indexOf(item);
                            return (
                              <button
                                type="button"
                                key={`${item.result_type}-${item.id}`}
                                className={`da-smart-search-item-v7 ${activeIndex === absoluteIndex ? "is-active" : ""}`}
                                onMouseEnter={() => setActiveIndex(absoluteIndex)}
                                onClick={() => handleResult(item)}
                              >
                                <span className={`da-smart-search-icon-v7 is-${item.result_type}`}>{resultIcon(item.result_type)}</span>
                                <span className="da-smart-search-copy-v7">
                                  <strong>{item.title || item.id}</strong>
                                  <small>{item.subtitle || item.group_label || "Data ERP"}</small>
                                </span>
                                <span className="da-smart-search-meta-v7">
                                  {item.result_type === "transaction" && Number(item.amount || 0) ? <b>{formatRupiah(item.amount)}</b> : null}
                                  <small>{item.meta || item.id}</small>
                                </span>
                                <ArrowRight size={15} />
                              </button>
                            );
                          })}
                        </section>
                      );
                    })}
                  </div>
                )}

                <button type="button" className="da-smart-search-all-v7" onClick={openAllResults} disabled={query.trim().length < 2}>
                  <Archive size={15} />
                  <span>Lihat semua hasil untuk “{query.trim() || "..."}”</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            ) : null}
          </div>

          <div className="da-topbar-date-v3"><CalendarDays size={15} /><span>{todayLabel()}</span></div>
          <div className="da-topbar-location-v3"><MapPin size={14} /><span>{locationName}</span></div>
          <div className="da-topbar-user-v3">
            <div className="da-user-avatar-v3">{initials(userName)}<span /></div>
            <div><strong>{userName}</strong><small><ShieldCheck size={11} /> {roleName}</small></div>
          </div>
          <Button variant="ghost" onClick={onLogout} className="da-logout-button-v3" title="Keluar"><LogOut size={16} /><span>Keluar</span></Button>
        </div>
      </header>

      <Modal
        open={Boolean(masterDetail)}
        size="md"
        title={masterDetail?.title || "Detail"}
        subtitle={`${masterDetail?.group_label || "Data"} · ${masterDetail?.meta || masterDetail?.id || ""}`}
        onClose={() => setMasterDetail(null)}
      >
        {masterDetail ? (
          <div className="da-search-master-detail-v7">
            <Card>
              <div className="da-search-master-hero-v7">
                <span className={`da-smart-search-icon-v7 is-${masterDetail.result_type}`}>{resultIcon(masterDetail.result_type)}</span>
                <div><span>{masterDetail.group_label}</span><strong>{masterDetail.title}</strong><small>{masterDetail.subtitle || "Data aktif ERP"}</small></div>
              </div>
              <div className="da-search-master-grid-v7">
                <div><span>ID / Kode</span><strong>{masterDetail.meta || masterDetail.id}</strong></div>
                <div><span>Status</span><strong>{masterDetail.status || "Aktif"}</strong></div>
                {masterDetail.location_id ? <div><span>Lokasi</span><strong>{masterDetail.location_id}</strong></div> : null}
              </div>
            </Card>
            <div className="da-search-master-actions-v7">
              <Button variant="secondary" onClick={() => setMasterDetail(null)}>Tutup</Button>
              <Button onClick={() => openMasterModule(masterDetail)}>Buka {masterDetail.group_label}</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <UniversalTransactionDetailModal
        open={Boolean(transactionDetail)}
        loading={transactionLoading}
        detail={transactionDetail?.detail}
        activeId={transactionDetail?.id}
        activeModule={transactionDetail?.module}
        sessionToken={session?.sessionToken || ""}
        onSessionExpired={onSessionExpired}
        onClose={() => setTransactionDetail(null)}
        onRefresh={() => transactionDetail?.id && openTransaction(transactionDetail.id, transactionDetail.module)}
        onOpenId={(id, moduleName) => openTransaction(id, moduleName)}
        onOpenArchive={() => { setTransactionDetail(null); onNavigate?.("arsip-digital"); }}
      />
    </>
  );
}
