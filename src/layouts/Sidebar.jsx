import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ArrowDownCircle,
  Boxes,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Factory,
  BarChart3,
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
  X,
} from "lucide-react";
import { APP_BRAND } from "../config/theme.config";

const MENU_ICONS = {
  "papan-pusat": LayoutDashboard,
  "owner-control": Gauge,
  "arsip-digital": Archive,
  "closing-owner": BarChart3,
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
  "request-do": Truck,
  "uang-masuk": ArrowDownCircle,
  "kas-dompet": Wallet,
  "kas-keluar": Receipt,
  "hutang-nana": FileText,
  "kewajiban-owner": ClipboardList,
  "empat-amplop": Package,
  "laporan-harian": FileText,
  "setoran-cabang": Wallet,
  "hrd-dashboard": LayoutDashboard,
  "hrd-employees": Users,
  "hrd-attendance": CalendarDays,
  "hrd-loans": Wallet,
  "hrd-payroll": Wallet,
  "hrd-payroll-report": BarChart3,
  "master-produk": Package,
  "master-customer": Users,
  "master-supplier": Truck,
  "master-lokasi": Building2,
};

function initialOpenState(menuGroups = [], activePage = "") {
  const activeGroup = menuGroups.find((group) =>
    (group.items || []).some((item) => item.key === activePage)
  );
  return Object.fromEntries(
    menuGroups.map((group) => [
      group.key,
      Boolean(group.key === activeGroup?.key || (!activeGroup && group.key === "pusat-kendali")),
    ])
  );
}

export default function Sidebar({ menuGroups, activePage, onChangePage, open = false, onClose }) {
  const groupsSignature = useMemo(
    () => (menuGroups || []).map((group) => `${group.key}:${(group.items || []).map((item) => item.key).join(",")}`).join("|"),
    [menuGroups]
  );
  const [openGroups, setOpenGroups] = useState(() => initialOpenState(menuGroups, activePage));

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
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
    <aside className={`da-sidebar da-sidebar-v3 ${open ? "is-open" : ""}`}>
      <div className="da-sidebar-brand-v3">
        <div className="da-brand-mark-v3">
          {APP_BRAND.logoUrl ? <img src={APP_BRAND.logoUrl} alt={APP_BRAND.name} /> : <span>{APP_BRAND.shortName}</span>}
        </div>
        <div className="da-brand-copy-v3">
          <strong>{APP_BRAND.name}</strong>
          <span>Merchant Operations</span>
        </div>
        <button type="button" className="da-sidebar-close-v3" aria-label="Tutup menu" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="da-sidebar-live-v3">
        <span className="da-sidebar-live-dot-v3" />
        <div><strong>ERP Operasional</strong><small>PHP / MySQL aktif</small></div>
      </div>

      <nav className="da-sidebar-nav-v3" aria-label="Menu utama ERP">
        {(menuGroups || []).map((group) => {
          const expanded = Boolean(openGroups[group.key]);
          const activeInGroup = (group.items || []).some((item) => item.key === activePage);
          return (
            <section key={group.key} className={`da-sidebar-group-v3 ${activeInGroup ? "has-active" : ""} ${group.systemGroup ? "is-system" : ""}`}>
              <button type="button" className="da-sidebar-group-toggle-v3" onClick={() => toggleGroup(group.key)} aria-expanded={expanded}>
                <span>{group.title}</span>
                <ChevronDown size={14} className={expanded ? "is-open" : ""} />
              </button>
              <div className={`da-sidebar-group-items-v3 ${expanded ? "is-open" : ""}`}>
                {(group.items || []).map((item) => {
                  const active = item.key === activePage;
                  const Icon = MENU_ICONS[item.key] || (group.systemGroup ? Settings2 : Store);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`da-sidebar-item-v3 ${active ? "active" : ""}`}
                      onClick={() => onChangePage(item.key)}
                      title={item.description || item.label}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="da-sidebar-item-icon-v3"><Icon size={17} strokeWidth={2} /></span>
                      <span className="da-sidebar-item-copy-v3"><strong>{item.label}</strong></span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>

      <div className="da-sidebar-footer-v3">
        <ShieldCheck size={18} />
        <div><strong>Owner Workspace</strong><span>Produksi • Penjualan • Keuangan</span></div>
      </div>
    </aside>
  );
}
