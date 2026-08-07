import { LogOut, MapPin, Menu, ShieldCheck } from "lucide-react";
import Button from "../components/ui/Button";

function initials(value = "") {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "DA";
  return parts.slice(0, 2).map((item) => item.charAt(0).toUpperCase()).join("");
}

export default function Topbar({
  session,
  onLogout,
  onOpenSidebar,
  pageTitle = "Dashboard Owner",
  groupTitle = "ERP Dimsum Aditya",
  pageDescription = "",
}) {
  const user = session?.user || {};
  const userName = user.name || user.username || "User";
  const locationName = user.location_name || user.location_id || "Lokasi belum terbaca";
  const roleName = user.role_name || user.role_id || "Role belum terbaca";

  return (
    <header className="da-topbar da-topbar-v2">
      <div className="da-topbar-left">
        <button
          type="button"
          className="da-mobile-menu-btn"
          aria-label="Buka menu"
          onClick={onOpenSidebar}
        >
          <Menu size={20} />
        </button>

        <div className="da-topbar-context">
          <div className="da-topbar-breadcrumb">
            <span>{groupTitle}</span>
            <span className="da-topbar-breadcrumb-separator">/</span>
            <strong>{pageTitle}</strong>
          </div>
          <div className="da-topbar-title-row">
            <div className="da-topbar-title">{pageTitle}</div>
            {pageDescription ? <div className="da-topbar-description">{pageDescription}</div> : null}
          </div>
        </div>
      </div>

      <div className="da-topbar-right">
        <div className="da-topbar-location" title={`${locationName} · ${roleName}`}>
          <MapPin size={15} />
          <span>{locationName}</span>
        </div>

        <div className="da-topbar-user">
          <div className="da-user-avatar" aria-hidden="true">
            {initials(userName)}
            <span className="da-user-online-dot" />
          </div>
          <div className="da-topbar-user-copy">
            <div className="da-user-name">{userName}</div>
            <div className="da-user-label">
              <ShieldCheck size={12} />
              {roleName}
            </div>
          </div>
        </div>

        <Button variant="ghost" onClick={onLogout} className="da-logout-button" title="Keluar dari ERP">
          <LogOut size={16} />
          <span>Keluar</span>
        </Button>
      </div>
    </header>
  );
}
