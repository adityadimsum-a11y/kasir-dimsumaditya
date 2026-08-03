import { APP_BRAND } from "../config/theme.config";

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
          <div className="da-brand-subtitle">Merchant OS</div>
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

      <nav className="da-sidebar-nav" aria-label="Menu utama ERP">
        {menuGroups.map((group) => (
          <section key={group.key} className="da-sidebar-group">
            <div className="da-sidebar-group-title">{group.title}</div>

            {group.items.map((item) => {
              const active = item.key === activePage;

              return (
                <button
                  key={item.key}
                  type="button"
                  className={`da-sidebar-item ${active ? "active" : ""}`}
                  onClick={() => onChangePage(item.key)}
                  title={item.description || item.label}
                >
                  <span className="da-sidebar-item-text">{item.label}</span>
                </button>
              );
            })}
          </section>
        ))}
      </nav>
    </aside>
  );
}
