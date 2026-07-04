import { APP_BRAND } from "../config/theme.config";

export default function Sidebar({ menuGroups, activePage, onChangePage }) {
  return (
    <aside className="da-sidebar">
      <div className="da-sidebar-brand">
        <div className="da-brand-mark">{APP_BRAND.shortName}</div>
        <div>
          <div className="da-brand-title">{APP_BRAND.name}</div>
          <div className="da-brand-subtitle">Merchant OS</div>
        </div>
      </div>

      <nav className="da-sidebar-nav">
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
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
          </section>
        ))}
      </nav>
    </aside>
  );
}
