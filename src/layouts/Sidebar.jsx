import {
  Activity,
  Archive,
  ArrowDownCircle,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardList,
  Factory,
  FileText,
  Gauge,
  LayoutDashboard,
  Package,
  PackageCheck,
  Printer,
  Receipt,
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

export default function Sidebar({
  menuGroups,
  activePage,
  onChangePage,
  open = false,
  onClose,
}) {
  return (
    <aside className={`da-sidebar ${open ? "is-open" : ""}`}>
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
        <span>Sistem Operasional</span>
      </div>

      <nav className="da-sidebar-nav" aria-label="Menu utama ERP">
        {menuGroups.map((group) => (
          <section key={group.key} className="da-sidebar-group">
            <div className="da-sidebar-group-title">{group.title}</div>

            {group.items.map((item) => {
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
          </section>
        ))}
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
