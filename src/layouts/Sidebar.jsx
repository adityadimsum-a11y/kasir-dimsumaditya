import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ArrowDownCircle,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Factory,
  FileText,
  Gauge,
  LayoutDashboard,
  Package,
  PackageCheck,
  Printer,
  Receipt,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Snowflake,
  Store,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { APP_BRAND } from "../config/theme.config";

const MENU_ICONS = {
  "papan-pusat": LayoutDashboard,
  "owner-control": Gauge,
  "arsip-digital": Archive,
  "closing-owner": FileText,
  "system-health": Activity,
  "go-live-check": CheckCircle2,
  "permission-role-check": ShieldCheck,
  "print-backup": Printer,

  "drop-ayam": Truck,
  "stok-ayam": Boxes,
  "produksi-adukan": Factory,
  "barang-freezer": Snowflake,
  "stok-jadi": PackageCheck,

  "kasir-order": ShoppingCart,
  "antrian-po": ClipboardList,

  "uang-masuk": ArrowDownCircle,
  "kas-dompet": Wallet,
  "kas-keluar": Receipt,
  "hutang-nana": FileText,
  "kewajiban-owner": ClipboardList,
  "empat-amplop": Package,

  "laporan-harian": FileText,
  "setoran-cabang": Wallet,
  "request-do": Truck,

  "hrd-payroll": Users,

  "master-produk": Package,
  "master-customer": Users,
  "master-supplier": Truck,
  "master-lokasi": Building2,
};

function initialOpenState(menuGroups = [], activePage = "") {
  return Object.fromEntries(
    menuGroups.map((group) => [
      group.key,
      Boolean(group.defaultOpen || (group.items || []).some((item) => item.key === activePage)),
    ])
  );
}

export default function Sidebar({
  menuGroups,
  activePage,
  onChangePage,
  open = false,
  onClose,
}) {
  const groupsSignature = useMemo(
    () => (menuGroups || []).map((group) => `${group.key}:${(group.items || []).map((item) => item.key).join(",")}`).join("|"),
    [menuGroups]
  );
  const [openGroups, setOpenGroups] = useState(() => initialOpenState(menuGroups, activePage));

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...initialOpenState(menuGroups, activePage), ...current };
      const activeGroup = (menuGroups || []).find((group) =>
        (group.items || []).some((item) => item.key === activePage)
      );
      if (activeGroup) next[activeGroup.key] = true;
      return next;
    });
  }, [activePage, groupsSignature, menuGroups]);

  const toggleGroup = (groupKey) => {
    setOpenGroups((current) => ({ ...current, [groupKey]: !current[groupKey] }));
  };

  return (
    <aside className={`da-sidebar da-sidebar-v2 ${open ? "is-open" : ""}`}>
      <div className="da-sidebar-brand">
        <div className="da-brand-mark">
          {APP_BRAND.logoUrl ? (
            <img
              src={APP_BRAND.logoUrl}
              alt={APP_BRAND.name}
              className="da-brand-logo"
            />
          ) : (
            <div className="da-brand-fallback">{APP_BRAND.shortName}</div>
          )}
        </div>

        <div className="da-brand-copy">
          <div className="da-brand-title">{APP_BRAND.name}</div>
          <div className="da-brand-subtitle">Operations ERP</div>
        </div>

        <button
          type="button"
          className="da-sidebar-close"
          aria-label="Tutup menu"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="da-sidebar-system-note">
        <span className="da-sidebar-system-dot" />
        <span>Operasional Live</span>
      </div>

      <nav className="da-sidebar-nav" aria-label="Menu utama ERP">
        {(menuGroups || []).map((group) => {
          const expanded = Boolean(openGroups[group.key]);
          const activeInGroup = (group.items || []).some((item) => item.key === activePage);
          const GroupIcon = group.systemGroup ? Settings2 : null;

          return (
            <section
              key={group.key}
              className={`da-sidebar-group ${activeInGroup ? "has-active" : ""} ${group.systemGroup ? "is-system" : ""}`}
            >
              <button
                type="button"
                className="da-sidebar-group-toggle"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={expanded}
              >
                <span className="da-sidebar-group-title-wrap">
                  {GroupIcon ? <GroupIcon size={13} strokeWidth={2.2} /> : null}
                  <span className="da-sidebar-group-title">{group.title}</span>
                </span>
                <ChevronDown
                  size={14}
                  className={`da-sidebar-group-chevron ${expanded ? "is-open" : ""}`}
                />
              </button>

              <div className={`da-sidebar-group-items ${expanded ? "is-open" : ""}`}>
                {(group.items || []).map((item) => {
                  const active = item.key === activePage;
                  const Icon = MENU_ICONS[item.key] || Store;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`da-sidebar-item ${active ? "active" : ""}`}
                      onClick={() => onChangePage(item.key)}
                      title={item.description || item.label}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="da-sidebar-item-icon" aria-hidden="true">
                        <Icon size={17} strokeWidth={2.1} />
                      </span>
                      <span className="da-sidebar-item-text">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>

      <div className="da-sidebar-footer">
        <div className="da-sidebar-footer-mark">DA</div>
        <div>
          <strong>Dimsum Aditya</strong>
          <span>Produksi • Penjualan • Keuangan</span>
        </div>
      </div>
    </aside>
  );
}
