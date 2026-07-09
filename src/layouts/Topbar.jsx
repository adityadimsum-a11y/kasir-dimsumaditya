import Button from "../components/ui/Button";

export default function Topbar({ session, onLogout, onOpenSidebar }) {
  const user = session?.user || {};
  const locationName = user.location_name || user.location_id || "Lokasi belum terbaca";
  const roleName = user.role_name || user.role_id || "Role belum terbaca";

  return (
    <header className="da-topbar">
      <div className="da-topbar-left">
        <button
          type="button"
          className="da-mobile-menu-btn"
          aria-label="Buka menu"
          onClick={onOpenSidebar}
        >
          ☰
        </button>

        <div>
          <div className="da-topbar-title">ERP Dimsum Aditya</div>
          <div className="da-topbar-subtitle">
            {locationName} · {roleName}
          </div>
        </div>
      </div>

      <div className="da-topbar-user">
        <div className="da-topbar-user-copy">
          <div className="da-user-name">{user.name || user.username || "User"}</div>
          <div className="da-user-label">Sedang aktif</div>
        </div>

        <Button variant="ghost" onClick={onLogout}>
          Keluar
        </Button>
      </div>
    </header>
  );
}
